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
const normalizeStudentId = (value) => String(value || "").replace(/[^0-9]/g, "");
const normalizeInvoiceKey = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const termTuitionField = { Prelim: "prelim", Midterm: "midterm", PreFinal: "preFinal", Final: "final" };
const materiallyDiffers = (actual, expected) =>
  Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) > Math.max(100, expected * 0.1);

const getReceiptHash = async (file) => {
  const providerHash = file?.etag || file?.hash;
  if (providerHash) return `provider:${providerHash}`;
  if (!file?.path || typeof fetch !== "function") return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(file.path, { signal: controller.signal });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const parseReceiptDate = (dateText) => {
  if (!dateText) return null;
  const value = String(dateText).trim();
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(value)) {
    const [year, month, day] = value.split(/[-/.]/).map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const slashParts = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (slashParts) {
    const [, month, day, year] = slashParts.map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
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
  const hasConfiguredTotal = ledger.tuitionConfigured === true
    && Number.isFinite(Number(ledger.totalTuition))
    && Number(ledger.totalTuition) > 0;
  if (hasConfiguredTotal) {
    ledger.remainingBalance = Math.max(0, Number(ledger.totalTuition) - ledger.paidAmount);
    ledger.fullyPaid = ledger.remainingBalance === 0;
  } else if (payment.paymentType === "Full Tuition") {
    ledger.remainingBalance = 0;
    ledger.fullyPaid = true;
  } else {
    ledger.remainingBalance = null;
    ledger.fullyPaid = false;
  }
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
    const paymentType = req.body.paymentType || "Term";
    const examCoverage = req.body.examCoverage || undefined;
    const isFullTuition = paymentType === "Full Tuition";
    const validTermPayment = paymentType === "Term"
      && TERMS.includes(examCoverage)
      && req.body.paymentDescription === `Tuition - ${examCoverage}`;
    const validFullPayment = isFullTuition
      && !examCoverage
      && req.body.paymentDescription === "Full Tuition Payment";
    if (!validTermPayment && !validFullPayment) {
      return res.status(400).json({ message: "Select a valid tuition payment description." });
    }
    if (!account.semester || !account.schoolYear) {
      return res.status(400).json({ message: "Your semester and school year must be configured before submitting a payment." });
    }
    const receiptHash = await getReceiptHash(req.file);
    let text = "";
    let ocrData;
    try {
      const result = await extractText.extractDetailed(req.file.path, { mimeType: req.file.mimetype });
      text = result.text;
      ocrData = result.ocr;
    } catch {
      ocrData = {
        status: "Failed",
        rawText: "",
        confidence: null,
        amountCandidates: [],
        fields: { invoiceNumber: "", studentId: "", dateText: "" },
        reviewReason: "OCR could not read the receipt.",
        engineVersion: extractText.OCR_ENGINE_VERSION,
        processedAt: new Date(),
        error: "OCR processing failed",
      };
    }
    const invoiceNumber = ocrData.fields?.invoiceNumber || "";
    const invoiceKey = normalizeInvoiceKey(invoiceNumber);
    const extractedStudentId = ocrData.fields?.studentId || "";
    if (extractedStudentId && normalizeStudentId(extractedStudentId) !== normalizeStudentId(account.studentId)) {
      return res.status(400).json({ message: "Receipt student ID does not match your account." });
    }

    const activeStatuses = ["Pending", "Need Review", "Approved", "Direct Payment"];
    const ledger = await Ledger.findOne({ studentId: account.studentId });
    const duplicateInvoice = invoiceKey
      ? await Payment.findOne({ studentId: account.studentId,
        $or: [{ invoiceKey }, { invoiceNumber }], status: { $in: activeStatuses } })
      : null;
    const duplicateImage = receiptHash
      ? await Payment.findOne({ studentId: account.studentId, receiptHash })
      : null;
    const duplicateFullTuition = isFullTuition
      ? await Payment.findOne({ studentId: account.studentId, paymentType: "Full Tuition",
        semester: account.semester, schoolYear: account.schoolYear, status: { $in: activeStatuses } })
      : null;
    const alreadyFullyPaid = isFullTuition && ledger?.tuitionConfigured === true && ledger?.fullyPaid;
    if (duplicateInvoice || duplicateImage || duplicateFullTuition || alreadyFullyPaid) {
      return res.status(409).json({
        message: duplicateImage
          ? "This receipt image was already submitted. Check Payment History before uploading it again."
          : duplicateFullTuition || alreadyFullyPaid
            ? "A full tuition payment already exists for this semester and school year."
          : "This invoice or reference number was already submitted and is still active.",
      });
    }

    const detected = extractText.extractAmountDetails(text, ocrData.confidence);
    const parsedDate = parseReceiptDate(ocrData.fields?.dateText);
    const hasConfiguredTotal = ledger?.tuitionConfigured === true
      && Number.isFinite(Number(ledger.totalTuition))
      && Number(ledger.totalTuition) > 0;
    const remainingBalance = hasConfiguredTotal ? Number(ledger.remainingBalance) : NaN;
    const configuredTermAmount = Number(ledger?.termTuition?.[termTuitionField[examCoverage]]);
    const expectedAmount = isFullTuition
      ? remainingBalance
      : configuredTermAmount;
    const candidateValues = [...new Set((ocrData.amountCandidates || []).map((candidate) => Number(candidate.value))
      .filter((value) => Number.isFinite(value) && value > 0))];
    const ocrAmount = candidateValues.length === 1 ? candidateValues[0] : null;
    const comparisonAmount = detected.amount || ocrAmount;
    const amountMismatch = Number.isFinite(comparisonAmount) && (
      (Number.isFinite(expectedAmount) && expectedAmount > 0 && materiallyDiffers(comparisonAmount, expectedAmount)) ||
      (Number.isFinite(remainingBalance) && remainingBalance >= 0 && comparisonAmount > remainingBalance + 0.01)
    );
    const repeatedTerm = !isFullTuition && Boolean(await Payment.findOne({
      studentId: account.studentId,
      examCoverage,
      status: { $in: activeStatuses },
    }));
    const reviewReasons = [ocrData.reviewReason, amountMismatch
      ? (isFullTuition
        ? "Detected amount differs materially from the remaining tuition balance for full payment."
        : Number.isFinite(expectedAmount) && expectedAmount > 0
          ? `Detected amount differs from the configured ${examCoverage} tuition amount.`
        : "Detected amount exceeds the student's remaining balance.")
      : "", repeatedTerm ? "Another active payment already exists for this exam term." : ""]
      .filter(Boolean);
    ocrData.reviewReason = [...new Set(reviewReasons)].join(" ");
    const payment = await Payment.create({
      studentId: account.studentId,
      studentName: account.name,
      invoiceNumber,
      invoiceKey,
      paymentType,
      semester: account.semester,
      schoolYear: account.schoolYear,
      amount: detected.amount,
      amountStatus: amountMismatch ? "Needs Review" : detected.status,
      ocr: ocrData,
      receiptHash: receiptHash || undefined,
      validation: {
        duplicate: false,
        repeatedTerm,
        amountMismatch,
        expectedAmount: Number.isFinite(expectedAmount) ? expectedAmount : undefined,
        remainingBalance: Number.isFinite(remainingBalance) ? remainingBalance : undefined,
        reviewReasons,
        checkedAt: new Date(),
      },
      paymentDescription: isFullTuition ? "Full Tuition Payment" : `Tuition - ${examCoverage}`,
      examCoverage: isFullTuition ? undefined : examCoverage,
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
      const approvalDescription = payment.paymentType === "Full Tuition"
        ? "full tuition payment; all examination terms are now eligible"
        : payment.paymentDescription || "payment";
      await Notification.create([{ studentId: payment.studentId, studentName: payment.studentName,
        recipientRole: "student", title: "Payment Approved",
        message: `Your payment of ${peso(confirmedAmount)} for ${approvalDescription} has been approved.` }], { session });
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
      const rejectionTitle = payment.paymentType === "Full Tuition"
        ? "Full Tuition Payment Rejected"
        : "Rejected Exam Permit";
      const rejectionMessage = payment.paymentType === "Full Tuition"
        ? `Your full tuition payment was rejected. Remarks: ${remarks}`
        : `Your ${payment.examCoverage || "exam"} permit request was rejected. Remarks: ${remarks}`;
      await Notification.create([{ studentId: payment.studentId, studentName: payment.studentName,
        recipientRole: "student", title: rejectionTitle, message: rejectionMessage }], { session });
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
  const normalizedDescription = paymentDescription || "Direct Payment";
  const isFullTuition = !examCoverage && normalizedDescription === "Full Tuition Payment";
  if (!studentId || !validAmount(amount) || (examCoverage && !TERMS.includes(examCoverage)) || (!examCoverage && !isFullTuition && normalizedDescription !== "Direct Payment")) {
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
      const ledger = await Ledger.findOne({ studentId }).session(session);
      if (isFullTuition && ledger?.tuitionConfigured === true && ledger?.fullyPaid) {
        const conflict = new Error("This student is already fully paid for the current ledger."); conflict.status = 409; throw conflict;
      }
      [payment] = await Payment.create([{ studentId, studentName: student.name, amount: Number(amount),
        amountStatus: "Confirmed by Cashier", paymentDescription: normalizedDescription,
        paymentType: isFullTuition ? "Full Tuition" : "Term",
        semester: student.semester, schoolYear: student.schoolYear,
        examCoverage: examCoverage || undefined, status: "Approved", paymentMethod: "direct",
        approvedBy: req.user.id, approvedAt: new Date() }], { session });
      await updateLedgerAndPermits(payment, session);
      await Notification.create([{ studentId, studentName: student.name, recipientRole: "student",
        title: isFullTuition ? "Full Tuition Recorded" : "Direct Payment Recorded",
        message: `A direct payment of ₱${payment.amount} has been recorded by the cashier.` }], { session });
    });
    return res.status(201).json({ message: "Direct payment created successfully.", payment });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    return sendError(res, error);
  } finally { await session.endSession(); }
};

module.exports = { createPayment, getPayments, approvePayment, rejectPayment, createDirectPayment };
