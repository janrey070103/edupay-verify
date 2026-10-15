const crypto = require("crypto");
const mongoose = require("mongoose");
const extractText = require("../services/ocrService");
const Payment = require("../Models/Payments");
const ExamPermit = require("../Models/ExamPermit");
const User = require("../Models/User");
const Notification = require("../Models/Notification");
const Ledger = require("../Models/Ledger");

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
      { upsert: true, new: true, session }
    );
  }
};

const createPayment = async (req, res) => {
  try {
    const account = await User.findById(req.user.id);
    if (!account || account.role !== "student") return res.status(403).json({ message: "Only students can submit receipts." });
    if (!req.file?.path) return res.status(400).json({ message: "Please upload your payment receipt." });
    const examCoverage = req.body.examCoverage;
    if (!TERMS.includes(examCoverage) || req.body.paymentDescription !== `Tuition - ${examCoverage}`) {
      return res.status(400).json({ message: "Select a valid tuition payment description." });
    }
    let text = "";
    try { text = await extractText(req.file.path); } catch { /* Cashier will review unreadable receipts. */ }
    const invoiceNumber = text.match(/INVOICE\s*NO[: ]+(\d+)/i)?.[1] || "";
    const extractedStudentId = text.match(/STUDENT\s*ID[: ]+([0-9\-]+)/i)?.[1] || "";
    if (extractedStudentId && extractedStudentId !== account.studentId) {
      return res.status(400).json({ message: "Receipt student ID does not match your account." });
    }
    const detected = extractText.extractAmountDetails(text);
    const dateValue = text.match(/DATE[: ]+([0-9/\-]+)/i)?.[1];
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue || "") ? new Date(dateValue) : null;
    const payment = await Payment.create({
      studentId: account.studentId,
      studentName: account.name,
      invoiceNumber,
      amount: detected.amount,
      amountStatus: detected.status,
      paymentDescription: `Tuition - ${examCoverage}`,
      examCoverage,
      receiptImage: req.file.path,
      receiptDate: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined,
      status: "Pending",
    });
    await Notification.create({ studentId: account.studentId, studentName: account.name,
      recipientRole: "cashier", title: "New Receipt Submitted",
      message: `${account.name} (${account.studentId}) submitted a receipt for review.` });
    return res.status(201).json(payment);
  } catch (error) { return sendError(res, error); }
};

const getPayments = async (req, res) => {
  try {
    const query = {};
    if (req.user.role === "student") {
      const account = await User.findById(req.user.id).select("studentId");
      if (!account) return res.status(404).json({ message: "Student not found." });
      query.studentId = account.studentId;
    } else if (!["cashier", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access Denied" });
    }
    return res.json(await Payment.find(query).sort({ createdAt: -1, _id: -1 }));
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
        { new: true, session, runValidators: true }
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
        { new: true, session, runValidators: true }
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

module.exports = { createPayment, getPayments, approvePayment, rejectPayment, createDirectPayment };
