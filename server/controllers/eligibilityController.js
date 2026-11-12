const Ledger = require("../Models/Ledger");
const Payment = require("../Models/Payments");
const User = require("../Models/User");
const ExamPermit = require("../Models/ExamPermit");
const { schedulesForStudent } = require("../services/termScheduleService");
const { describeWindow } = require("../config/examWindows");

const TERMS = [
  { key: "Prelim", field: "prelim" },
  { key: "Midterm", field: "midterm" },
  { key: "PreFinal", field: "preFinal" },
  { key: "Final", field: "final" },
];
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const getEligibility =
async (req, res) => {

  const ledger =
    await Ledger.findOne({
      studentId:
      req.params.studentId,
    });

  if (!ledger) {
    return res.json({
      prelim: false,
      midterm: false,
      preFinal: false,
      final: false,
    });
  }

  res.json({
    prelim:
      ledger.prelim,

    midterm:
      ledger.midterm,

    preFinal:
      ledger.preFinal,

    final:
      ledger.final,
  });

};

/**
 * One status per exam term, most advanced first:
 *   permit_ready  cleared and a valid exam permit exists
 *   revoked       cleared but the permit was revoked
 *   approved      cleared, permit not created yet (made when the student opens Exam Permit)
 *   pending       a receipt for the term is waiting for the cashier
 *   rejected      the latest receipt for the term was rejected
 *   payment_due   the term's exam date is published but nothing is paid
 *   not_open      the term's exam date is not published yet
 * Cleared terms outside their QR month (config/examWindows.js) become:
 *   opens_later       paid, but the permit month has not started
 *   period_ended      paid, but the permit month is over
 *   semester_missing  paid, but the account has no semester / school year
 */
const buildEligibility = (terms, { termPayments = [], permits = [], schedules = [], student = null, now = new Date() } = {}) => TERMS.map(({ key }) => {
  const schedule = schedules.find((item) => item.examType === key);
  const permit = permits.find((item) => item.examType === key);
  const latest = termPayments.find((item) => item.examCoverage === key); // newest first
  const waiting = termPayments.some((item) => item.examCoverage === key && ["Pending", "Need Review"].includes(item.status));
  let status = "not_open";
  if (terms[key] && permit?.permitStatus === "Valid") status = "permit_ready";
  else if (terms[key] && permit?.permitStatus === "Revoked") status = "revoked";
  else if (terms[key]) status = "approved";
  else if (waiting) status = "pending";
  else if (latest?.status === "Rejected") status = "rejected";
  else if (schedule) status = "payment_due";
  // A cleared term's QR is only usable during its own month.
  const window = describeWindow(student, key, now);
  if (["permit_ready", "approved"].includes(status)) {
    if (window.state === "upcoming") status = "opens_later";
    else if (window.state === "closed") status = "period_ended";
    else if (window.state === "unknown") status = "semester_missing";
  }
  return { term: key, status, examDate: schedule?.examDate || null, window };
});

/**
 * Everything the student's Tuition Ledger chart needs, computed from live data:
 * - paid / remaining from the ledger;
 * - tentative: receipts uploaded but not yet approved (amount read from the
 *   receipt; receipts whose amount could not be read are counted separately);
 * - nextPayment: the next progress payment, assuming tuition is split evenly
 *   over the four terms (tentative until per-course tuition rates exist).
 */
const buildLedgerView = (ledger, pendingReceipts = [], related = {}) => {
  const total = Math.max(0, Number(ledger.totalTuition) || 0);
  const paid = Math.max(0, Number(ledger.paidAmount) || 0);
  const remaining = Math.max(0, Number(ledger.remainingBalance ?? total - paid) || 0);
  const terms = Object.fromEntries(TERMS.map(({ key, field }) => [key, Boolean(ledger[field])]));

  const known = pendingReceipts.filter((item) => Number.isFinite(Number(item.amount)) && Number(item.amount) > 0);
  const tentativeAmount = round2(Math.min(remaining, known.reduce((sum, item) => sum + Number(item.amount), 0)));

  let nextPayment = null;
  const nextIndex = TERMS.findIndex(({ key }) => !terms[key]);
  if (remaining > 0 && nextIndex !== -1 && total > 0) {
    const cumulativeTarget = (total / TERMS.length) * (nextIndex + 1);
    const due = cumulativeTarget - paid;
    const installment = total / TERMS.length;
    nextPayment = { term: TERMS[nextIndex].key, amount: round2(Math.min(remaining, due > 0 ? due : installment)) };
  }

  return {
    studentId: ledger.studentId,
    hasLedger: Boolean(ledger._id),
    totalTuition: round2(total),
    paidAmount: round2(paid),
    remainingBalance: round2(remaining),
    fullyPaid: remaining === 0 && total > 0,
    terms,
    // Kept for pages that read the original ledger flags (e.g. My Exams).
    prelim: terms.Prelim, midterm: terms.Midterm, preFinal: terms.PreFinal, final: terms.Final,
    tentative: {
      amount: tentativeAmount,
      count: pendingReceipts.length,
      unreadCount: pendingReceipts.length - known.length,
    },
    nextPayment,
    eligibility: buildEligibility(terms, related),
    updatedAt: new Date().toISOString(),
  };
};

// GET /api/eligibility/me/ledger (students only)
const getMyLedger = async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Access Denied" });
    const student = await User.findById(req.user.id).select("studentId course semester schoolYear");
    if (!student) return res.status(404).json({ message: "Student not found" });
    const [ledger, pendingReceipts, termPayments, permits, termSchedules] = await Promise.all([
      Ledger.findOne({ studentId: student.studentId }).lean(),
      Payment.find({ studentId: student.studentId, status: { $in: ["Pending", "Need Review"] } })
        .select("amount").lean(),
      Payment.find({ studentId: student.studentId, examCoverage: { $in: TERMS.map(({ key }) => key) } })
        .sort({ createdAt: -1, _id: -1 }).select("examCoverage status").lean(),
      ExamPermit.find({ studentId: student.studentId }).select("examType permitStatus").lean(),
      schedulesForStudent(student).catch(() => ({ schedules: [] })),
    ]);
    const view = ledger || new Ledger({ studentId: student.studentId }).toObject();
    if (!ledger) delete view._id;
    return res.json(buildLedgerView(view, pendingReceipts,
      { termPayments, permits, schedules: termSchedules.schedules, student }));
  } catch (error) {
    return res.status(500).json({ message: "Could not load your tuition ledger." });
  }
};

module.exports = {
  getEligibility,
  getMyLedger,
  buildLedgerView,
  buildEligibility,
};
