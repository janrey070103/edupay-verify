const crypto = require("crypto");
const mongoose = require("mongoose");
const { analyzeReceipt } = require("../services/ocr/receiptAnalyzer");
const { referenceKey } = require("../services/ocr/receiptParser");
const Payment = require("../Models/Payments");
const ExamPermit = require("../Models/ExamPermit");
const User = require("../Models/User");
const Notification = require("../Models/Notification");
const Ledger = require("../Models/Ledger");
const { paginate, readDateRange, readPaging, readSort } = require("../utils/pagination");
const { CHANNEL_KEYS, PAYMENT_CHANNELS, channelFilter } = require("../config/paymentChannels");

const TERMS = ["Prelim", "Midterm", "PreFinal", "Final"];
const COVERAGE_FIELD = { Prelim: "prelim", Midterm: "midterm", PreFinal: "preFinal", Final: "final" };
const validAmount = (amount) => Number.isFinite(Number(amount)) && Number(amount) > 0;
const peso = (amount) => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP",
}).format(amount);

const sendError = (res, error) => {
  if (/Transaction numbers are only allowed|replica set/i.test(error?.message || "")) {
    return res.status(503).json({ message: "Payment processing requires MongoDB transaction support." });
  }
  if (error?.code === 11000 || error?.code === 112 || error?.hasErrorLabel?.("TransientTransactionError")) {
    return res.status(409).json({ message: "Payment changed during review. Refresh and try again." });
  }
  return res.status(500).json({ message: error.message });
};

const updateLedgerAndPermits = async (payment, session) => {
  let ledger = await Ledger.findOne({ studentId: payment.studentId }).session(session);
  if (!ledger) {
    ledger = new Ledger({ studentId: payment.studentId });
  }
  ledger.paidAmount += Number(payment.amount);
  ledger.remainingBalance = Math.max(0, ledger.totalTuition - ledger.paidAmount);
  ledger.fullyPaid = ledger.remainingBalance === 0;
  if (ledger.fullyPaid) TERMS.forEach((term) => { ledger[COVERAGE_FIELD[term]] = true; });
  if (payment.examCoverage) ledger[COVERAGE_FIELD[payment.examCoverage]] = true;
  await ledger.save({ session });

  // Full payment already grants all four ledger flags in the existing policy.
  // Reconcile permits with those flags so a valid ledger check has a usable QR.
  const coveredTerms = ledger.fullyPaid ? TERMS : payment.examCoverage ? [payment.examCoverage] : [];
  for (const examType of coveredTerms) {
    await ExamPermit.findOneAndUpdate(
      { studentId: payment.studentId, examType },
      { $set: { studentName: payment.studentName, paymentId: payment._id, permitStatus: "Valid" },
        $setOnInsert: { qrToken: crypto.randomBytes(24).toString("hex") } },
      { upsert: true, returnDocument: "after", session }
    );
  }
};

const createPayment = async (req, res) => {
  try {
    const account = await User.findById(req.user.id);
    if (!account || account.role !== "student") return res.status(403).json({ message: "Only students can submit receipts." });
    if (!req.file?.path) return res.status(400).json({ message: "Please upload your payment receipt." });
    const examCoverage = req.body.examCoverage;
    const paymentChannel = String(req.body.paymentChannel || "");
    if (!CHANNEL_KEYS.includes(paymentChannel)) {
      return res.status(400).json({ message: "Select how you paid (Palawan, M Lhuillier, online, or bank)." });
    }
    const isFullTuition = req.body.paymentType === "Full Tuition";
    if (isFullTuition) {
      if (examCoverage || req.body.paymentDescription !== "Full Tuition Payment") {
        return res.status(400).json({ message: "A full tuition payment does not select an exam term." });
      }
    } else if (!TERMS.includes(examCoverage) || req.body.paymentDescription !== `Tuition - ${examCoverage}`) {
      return res.status(400).json({ message: "Select a valid tuition payment description." });
    }
    // Full tuition: only while a balance remains, and one waiting at a time.
    let remainingBalance = null;
    if (isFullTuition) {
      const ledger = await Ledger.findOne({ studentId: account.studentId }).lean();
      remainingBalance = ledger ? Number(ledger.remainingBalance) : Number(new Ledger().remainingBalance);
      if (ledger?.fullyPaid || !(remainingBalance > 0)) {
        return res.status(409).json({ message: "Your tuition is already fully paid." });
      }
      if (await Payment.exists({ studentId: account.studentId, paymentType: "Full Tuition", status: { $in: ["Pending", "Need Review"] } })) {
        return res.status(409).json({ message: "You already have a full tuition payment waiting for cashier review." });
      }
    }
    // The student states the amount sent and the receipt's reference; the OCR
    // then confirms them against the image (it does not have to guess).
    const claimedAmount = Math.round(Number(req.body.claimedAmount) * 100) / 100;
    if (!Number.isFinite(claimedAmount) || claimedAmount <= 0 || claimedAmount > 1000000) {
      return res.status(400).json({ message: "Enter the amount you sent to the school (excluding any service fee)." });
    }
    const referenceNumber = String(req.body.referenceNumber || "").replace(/\s+/g, " ").trim().slice(0, 40);
    const refKey = referenceKey(referenceNumber);
    if (refKey.length < 4) {
      return res.status(400).json({ message: "Enter the reference or transaction number printed on your receipt." });
    }

    const ocr = await analyzeReceipt(req.file.path,
      { amount: claimedAmount, reference: referenceNumber, studentId: account.studentId, channel: paymentChannel },
      { schoolYear: account.schoolYear });

    // Possible duplicate receipt: the same reference on another payment that was
    // not rejected (re-uploading after a rejection is normal). Flag, never block.
    const earlier = await Payment.find({ referenceKey: refKey, status: { $ne: "Rejected" } })
      .select("studentId createdAt status").sort({ createdAt: 1 }).limit(3).lean();
    if (earlier.length) {
      const other = earlier.find((item) => item.studentId !== account.studentId);
      const first = earlier[0];
      ocr.flags = [{ code: "duplicate_reference", severity: "warning",
        message: other
          ? `Reference ${referenceNumber} was already used by another student (${other.studentId}) on ${new Date(other.createdAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}.`
          : `This student already submitted reference ${referenceNumber} on ${new Date(first.createdAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })} (${first.status}).` },
      ...(ocr.flags || [])];
    }

    // A full tuition payment should equal the remaining balance; warn the cashier otherwise.
    if (isFullTuition && Math.abs(claimedAmount - remainingBalance) >= 0.5) {
      ocr.flags = [...(ocr.flags || []), { code: "full_tuition_amount", severity: "warning",
        message: claimedAmount < remainingBalance
          ? `Marked as a full tuition payment, but ${peso(claimedAmount)} is less than the remaining balance of ${peso(remainingBalance)}. Approving it will not clear all terms.`
          : `Marked as a full tuition payment, but ${peso(claimedAmount)} is more than the remaining balance of ${peso(remainingBalance)}.` }];
    }

    const verified = ocr.amount?.status === "matched";
    const payment = await Payment.create({
      studentId: account.studentId,
      studentName: account.name,
      invoiceNumber: referenceNumber,
      referenceNumber,
      referenceKey: refKey,
      claimedAmount,
      // Pre-filled for the cashier; the cashier confirms the real amount on approval.
      amount: claimedAmount,
      amountStatus: verified ? "Detected" : "Needs Review",
      ocrAmount: ocr.detectedAmount?.amount ?? undefined,
      ocr,
      paymentDescription: isFullTuition ? "Full Tuition Payment" : `Tuition - ${examCoverage}`,
      paymentType: isFullTuition ? "Full Tuition" : "Term",
      paymentChannel,
      examCoverage: isFullTuition ? undefined : examCoverage,
      receiptImage: req.file.path,
      receiptDate: ocr.receiptDate ? new Date(ocr.receiptDate) : undefined,
      status: "Pending",
    });
    const flagCount = (ocr.flags || []).length;
    await Notification.create({ studentId: account.studentId, studentName: account.name,
      recipientRole: "cashier", title: "New Receipt Submitted", link: `/verify-payments?review=${payment._id}`,
      message: `${account.studentId} - ${account.name} submitted a receipt for review (paid via ${PAYMENT_CHANNELS[paymentChannel]})`
        + `${flagCount ? ` · ${flagCount} warning${flagCount === 1 ? "" : "s"} to check` : ""}.` });
    return res.status(201).json(payment);
  } catch (error) { return sendError(res, error); }
};

const STATUSES = ["Pending", "Approved", "Rejected", "Need Review", "Direct Payment"];
const readStatuses = (value) => String(value || "")
  .split(",")
  .map((status) => status.trim())
  .filter((status) => STATUSES.includes(status));

// Returns the filter for the caller's payment scope, or null when the response
// has already been sent (unknown student / forbidden role).
const scopedPaymentFilter = async (req, res) => {
  if (req.user.role === "student") {
    const account = await User.findById(req.user.id).select("studentId");
    if (!account) {
      res.status(404).json({ message: "Student not found." });
      return null;
    }
    return { studentId: account.studentId };
  }
  if (!["cashier", "super_admin"].includes(req.user.role)) {
    res.status(403).json({ message: "Access Denied" });
    return null;
  }
  return {};
};

const getPayments = async (req, res) => {
  try {
    const query = await scopedPaymentFilter(req, res);
    if (!query) return undefined;
    // Opening a single payment from a notification link.
    if (mongoose.isValidObjectId(req.query.id)) query._id = req.query.id;
    const statuses = readStatuses(req.query.status);
    if (statuses.length) query.status = { $in: statuses };
    if (TERMS.includes(req.query.examCoverage)) query.examCoverage = req.query.examCoverage;
    if (["direct", "receipt"].includes(req.query.method)) query.paymentMethod = req.query.method;
    Object.assign(query, channelFilter(req.query.channel));
    const range = readDateRange(req.query);
    if (range) query.createdAt = range;
    const paging = readPaging(req.query, { limit: 20 });
    const sort = readSort(req.query, ["createdAt", "amount", "studentName", "status"]);
    return res.json(await paginate(Payment, query, paging, sort));
  } catch (error) { return sendError(res, error); }
};

// Dashboard counters live on the server; a paginated list can no longer be
// counted in the browser.
const getPaymentSummary = async (req, res) => {
  try {
    const query = await scopedPaymentFilter(req, res);
    if (!query) return undefined;
    const todayStart = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date())}T00:00:00+08:00`);
    const [grouped, today, reviewByChannel] = await Promise.all([
      Payment.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 },
          amount: { $sum: { $ifNull: ["$amount", 0] } },
          noAmount: { $sum: { $cond: [{ $gt: ["$amount", 0] }, 0, 1] } },
          receipts: { $sum: { $cond: [{ $eq: ["$paymentMethod", "direct"] }, 0, 1] } },
          terms: { $addToSet: "$examCoverage" },
          oldest: { $min: "$createdAt" } } },
      ]),
      Payment.aggregate([
        { $match: { ...query, status: "Approved", approvedAt: { $gte: todayStart } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: { $ifNull: ["$amount", 0] } } } },
      ]),
      // Receipts waiting for review, by where the student paid.
      Payment.aggregate([
        { $match: { ...query, status: { $in: ["Pending", "Need Review"] } } },
        { $group: { _id: { $ifNull: ["$paymentChannel", "unspecified"] }, count: { $sum: 1 } } },
      ]),
    ]);
    const summary = { total: 0, pending: 0, approved: 0, rejected: 0, needReview: 0, directPayment: 0 };
    const key = { Pending: "pending", Approved: "approved", Rejected: "rejected",
      "Need Review": "needReview", "Direct Payment": "directPayment" };
    // Per-status detail for specific dashboard cards: peso amount, exam terms
    // involved, receipts vs cashier-recorded, and the oldest item's date.
    const TERM_ORDER = ["Prelim", "Midterm", "PreFinal", "Final"];
    const details = {};
    grouped.forEach((row) => {
      if (key[row._id]) summary[key[row._id]] = row.count;
      summary.total += row.count;
      if (key[row._id]) {
        details[key[row._id]] = { count: row.count, amount: row.amount, noAmount: row.noAmount, receipts: row.receipts,
          terms: TERM_ORDER.filter((term) => row.terms.includes(term)), oldest: row.oldest };
      }
    });
    summary.details = details;
    summary.receiptsSubmitted = grouped.reduce((sum, row) => sum + row.receipts, 0);
    summary.approvedToday = { count: today[0]?.count || 0, amount: today[0]?.amount || 0 };
    summary.reviewByChannel = Object.fromEntries(reviewByChannel.map((row) => [row._id, row.count]));
    return res.json(summary);
  } catch (error) { return sendError(res, error); }
};

const approvePayment = async (req, res) => {
  if (!validAmount(req.body.amount)) return res.status(400).json({ message: "Enter a verified payment amount greater than zero." });
  const confirmedAmount = Number(req.body.amount);
  const session = await mongoose.startSession();
  try {
    let approved;
    await session.withTransaction(async () => {
      const payment = await Payment.findOneAndUpdate(
        { _id: req.params.id, status: { $in: ["Pending", "Need Review"] } },
        { $set: { status: "Approved", amount: confirmedAmount, amountStatus: "Confirmed by Cashier",
          approvedBy: req.user.id, approvedAt: new Date() } },
        { returnDocument: "after", session, runValidators: true }
      );
      if (!payment) { const conflict = new Error("Only pending receipts can be approved."); conflict.status = 409; throw conflict; }
      const student = await User.findOne({ studentId: payment.studentId, role: "student" }).session(session);
      if (!student || student.isActive === false || student.verificationStatus !== "verified") {
        const conflict = new Error("Student account is not active and verified."); conflict.status = 409; throw conflict;
      }
      await updateLedgerAndPermits(payment, session);
      await Notification.create([{ studentId: payment.studentId, studentName: payment.studentName,
        recipientRole: "student", title: "Payment Approved",
        message: `Your payment of ${peso(confirmedAmount)} for ${payment.paymentDescription || "payment"} has been approved.` }], { session });
      approved = payment;
    });
    return res.json({ message: "Approved", payment: approved });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    return sendError(res, error);
  } finally { await session.endSession(); }
};

const rejectPayment = async (req, res) => {
  const remarks = String(req.body.remarks || "").trim();
  if (!remarks) return res.status(400).json({ message: "Rejection remarks are required." });
  const session = await mongoose.startSession();
  try {
    let rejected;
    await session.withTransaction(async () => {
      const payment = await Payment.findOneAndUpdate(
        { _id: req.params.id, status: { $in: ["Pending", "Need Review"] } },
        { $set: { status: "Rejected", remarks,
          rejectionReason: req.body.rejectionReason || "other" } },
        { returnDocument: "after", session, runValidators: true }
      );
      if (!payment) { const conflict = new Error("Only pending receipts can be rejected."); conflict.status = 409; throw conflict; }
      await Notification.create([{ studentId: payment.studentId, studentName: payment.studentName,
        recipientRole: "student", title: "Payment Rejected", message: remarks }], { session });
      rejected = payment;
    });
    return res.json({ message: "Rejected", payment: rejected });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    return sendError(res, error);
  } finally { await session.endSession(); }
};

const createDirectPayment = async (req, res) => {
  const { studentId, amount, paymentDescription, examCoverage } = req.body;
  if (!studentId || !validAmount(amount) || (examCoverage && !TERMS.includes(examCoverage))) {
    return res.status(400).json({ message: "Select a student, valid amount, and valid exam coverage." });
  }
  const session = await mongoose.startSession();
  try {
    let payment;
    await session.withTransaction(async () => {
      const student = await User.findOne({ studentId, role: "student", isActive: { $ne: false } }).session(session);
      if (!student || ["pending", "rejected"].includes(student.verificationStatus)) {
        const missing = new Error("Verified student not found."); missing.status = 404; throw missing;
      }
      [payment] = await Payment.create([{ studentId, studentName: student.name, amount: Number(amount),
        amountStatus: "Confirmed by Cashier", paymentDescription: paymentDescription || "Direct Payment",
        examCoverage: examCoverage || undefined, status: "Approved", paymentMethod: "direct",
        approvedBy: req.user.id, approvedAt: new Date() }], { session });
      await updateLedgerAndPermits(payment, session);
      await Notification.create([{ studentId, studentName: student.name, recipientRole: "student",
        title: "Direct Payment Recorded",
        message: `A direct payment of ₱${payment.amount} has been recorded by the cashier.` }], { session });
    });
    return res.status(201).json({ message: "Direct payment created successfully.", payment });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    return sendError(res, error);
  } finally { await session.endSession(); }
};

// Cashier view of one student for the Direct Payment form: account status,
// live ledger (balance and cleared terms), receipts still waiting for review,
// and the latest payments, so the cashier never records a payment blind.
const getStudentPaymentOverview = async (req, res) => {
  try {
    const studentId = String(req.params.studentId || "").trim();
    const student = await User.findOne({ studentId, role: "student" })
      .select("studentId name firstName middleName lastName email course yearLevel semester schoolYear isActive verificationStatus").lean();
    if (!student) return res.status(404).json({ message: "Student not found." });
    const [ledger, pendingReceipts, recentPayments] = await Promise.all([
      Ledger.findOne({ studentId }).lean(),
      Payment.countDocuments({ studentId, status: { $in: ["Pending", "Need Review"] } }),
      Payment.find({ studentId }).sort({ createdAt: -1, _id: -1 }).limit(5)
        .select("amount status examCoverage paymentDescription paymentMethod createdAt approvedAt").lean(),
    ]);
    const empty = new Ledger({ studentId }).toObject();
    const view = ledger || empty;
    return res.json({
      student,
      canPay: student.isActive !== false && student.verificationStatus === "verified",
      ledger: { totalTuition: view.totalTuition, paidAmount: view.paidAmount, remainingBalance: view.remainingBalance,
        fullyPaid: view.fullyPaid, terms: { Prelim: view.prelim, Midterm: view.midterm, PreFinal: view.preFinal, Final: view.final },
        exists: Boolean(ledger) },
      pendingReceipts,
      recentPayments,
    });
  } catch (error) { return sendError(res, error); }
};

module.exports = {
  getStudentPaymentOverview,
  createPayment, getPayments, getPaymentSummary, approvePayment, rejectPayment, createDirectPayment,
};
