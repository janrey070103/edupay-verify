const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const extractText = require("../services/ocrService");
const User = require("../Models/User");
const Payment = require("../Models/Payments");
const Ledger = require("../Models/Ledger");
const ExamPermit = require("../Models/ExamPermit");
const Notification = require("../Models/Notification");
const protect = require("../middleware/protect");
const ownEligibility = require("../middleware/ownEligibility");
const TermSchedule = require("../Models/TermSchedule");
const Exam = require("../Models/Exam");
const { scanPermit } = require("../controllers/qrController");
const { publish, mine } = require("../controllers/termScheduleController");
const { approvePayment, rejectPayment, createDirectPayment } = require("../controllers/paymentController");

const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; },
});

test("OCR only accepts an unambiguous labelled transaction amount", () => {
  assert.deepEqual(extractText.extractAmountDetails("REFERENCE 12345678\nDATE 10/08/2026\nAMOUNT PAID: PHP 2,500.00"),
    { amount: 2500, status: "Detected" });
  assert.deepEqual(extractText.extractAmountDetails("REFERENCE 2500\nACCOUNT 123456"),
    { amount: null, status: "Needs Review" });
  assert.deepEqual(extractText.extractAmountDetails("AMOUNT PAID: 2,500.00\nTOTAL PAID: 3,000.00"),
    { amount: null, status: "Needs Review" });
});

test("protected routes reject deactivated accounts and stale role claims", async () => {
  const oldFind = User.findById;
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-secret";
  const token = jwt.sign({ id: "user-1", role: "super_admin" }, process.env.JWT_SECRET);
  try {
    User.findById = () => ({ select: async () => ({ id: "user-1", role: "cashier", isActive: false }) });
    const denied = response();
    await protect({ headers: { authorization: `Bearer ${token}` } }, denied, () => assert.fail("Access granted"));
    assert.equal(denied.statusCode, 401);
    User.findById = () => ({ select: async () => ({ id: "user-1", role: "cashier", isActive: true }) });
    const changed = response();
    await protect({ headers: { authorization: `Bearer ${token}` } }, changed, () => assert.fail("Stale role accepted"));
    assert.equal(changed.statusCode, 401);
    const currentToken = jwt.sign({ id: "user-1", role: "cashier" }, process.env.JWT_SECRET);
    const allowed = response(); const req = { headers: { authorization: `Bearer ${currentToken}` } };
    let called = false;
    await protect(req, allowed, () => { called = true; });
    assert.equal(called, true);
    assert.equal(req.user.role, "cashier");
  } finally { User.findById = oldFind; process.env.JWT_SECRET = oldSecret; }
});

test("approval counts a payment once and rejects a duplicate transition", async () => {
  const originals = { startSession: mongoose.startSession, findPayment: Payment.findOneAndUpdate,
    findLedger: Ledger.findOne, upsertPermit: ExamPermit.findOneAndUpdate, notify: Notification.create,
    findStudent: User.findOne };
  const ledger = { studentId: "student-1", paidAmount: 0, totalTuition: 20000,
    remainingBalance: 20000, fullyPaid: false, prelim: false,
    save: async () => {} };
  let pending = true;
  let approvalNotification;
  mongoose.startSession = async () => ({ withTransaction: async (callback) => callback(), endSession: async () => {} });
  Payment.findOneAndUpdate = async () => {
    if (!pending) return null;
    pending = false;
    return { _id: "payment-1", studentId: "student-1", studentName: "Student",
      amount: 2500, examCoverage: "Prelim", paymentDescription: "Tuition - Prelim" };
  };
  Ledger.findOne = () => ({ session: async () => ledger });
  User.findOne = () => ({ session: async () => ({ isActive: true, verificationStatus: "verified" }) });
  ExamPermit.findOneAndUpdate = async () => ({});
  Notification.create = async (values) => { approvalNotification = values[0]; return [{}]; };
  try {
    const first = response();
    await approvePayment({ params: { id: "payment-1" }, body: { amount: 2500 }, user: { id: "cashier-1" } }, first);
    assert.equal(first.statusCode, 200);
    assert.equal(ledger.paidAmount, 2500);
    assert.equal(ledger.prelim, true);
    assert.match(approvalNotification.message, /₱2,500\.00/);
    assert.doesNotMatch(approvalNotification.message, /₱null/);
    const second = response();
    await approvePayment({ params: { id: "payment-1" }, body: { amount: 2500 }, user: { id: "cashier-1" } }, second);
    assert.equal(second.statusCode, 409);
    assert.equal(ledger.paidAmount, 2500);
  } finally {
    mongoose.startSession = originals.startSession; Payment.findOneAndUpdate = originals.findPayment;
    Ledger.findOne = originals.findLedger; ExamPermit.findOneAndUpdate = originals.upsertPermit;
    Notification.create = originals.notify;
    User.findOne = originals.findStudent;
  }
});

test("rejection requires meaningful remarks", async () => {
  const result = response();
  await rejectPayment({ body: { remarks: "   " } }, result);
  assert.equal(result.statusCode, 400);
});

test("rejection stores trimmed remarks without changing the ledger", async () => {
  const originals = { startSession: mongoose.startSession, findPayment: Payment.findOneAndUpdate,
    notify: Notification.create, findLedger: Ledger.findOne };
  let update; let ledgerRead = false;
  mongoose.startSession = async () => ({ withTransaction: async (callback) => callback(), endSession: async () => {} });
  Payment.findOneAndUpdate = async (_filter, value) => { update = value; return { studentId: "student-1", studentName: "Student" }; };
  Notification.create = async () => [{}];
  Ledger.findOne = () => { ledgerRead = true; return null; };
  try {
    const res = response();
    await rejectPayment({ params: { id: "payment-1" }, body: { remarks: "  Blurry image  " } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(update.$set.remarks, "Blurry image");
    assert.equal(update.$set.status, "Rejected");
    assert.equal(ledgerRead, false);
  } finally {
    mongoose.startSession = originals.startSession; Payment.findOneAndUpdate = originals.findPayment;
    Notification.create = originals.notify; Ledger.findOne = originals.findLedger;
  }
});

test("a direct payment without exam coverage still updates the approved ledger total", async () => {
  const originals = { startSession: mongoose.startSession, findStudent: User.findOne,
    createPayment: Payment.create, findLedger: Ledger.findOne, notify: Notification.create };
  const ledger = { paidAmount: 0, totalTuition: 20000, remainingBalance: 20000, fullyPaid: false,
    save: async () => {} };
  mongoose.startSession = async () => ({ withTransaction: async (callback) => callback(), endSession: async () => {} });
  User.findOne = () => ({ session: async () => ({ name: "Student" }) });
  Payment.create = async (values) => [{ _id: "payment-1", ...values[0] }];
  Ledger.findOne = () => ({ session: async () => ledger });
  Notification.create = async () => [{}];
  try {
    const res = response();
    await createDirectPayment({ user: { id: "cashier-1" }, body: { studentId: "student-1", amount: 1250 } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(ledger.paidAmount, 1250);
    assert.equal(ledger.remainingBalance, 18750);
  } finally {
    mongoose.startSession = originals.startSession; User.findOne = originals.findStudent;
    Payment.create = originals.createPayment; Ledger.findOne = originals.findLedger;
    Notification.create = originals.notify;
  }
});

test("students cannot read another student's eligibility", async () => {
  const oldFind = User.findById;
  User.findById = () => ({ select: async () => ({ studentId: "own-id" }) });
  try {
    const res = response();
    await ownEligibility({ user: { id: "user-1", role: "student" }, params: { studentId: "other-id" } },
      res, () => assert.fail("Unauthorized eligibility access"));
    assert.equal(res.statusCode, 403);
  } finally { User.findById = oldFind; }
});

test("the same correct-term QR can be scanned by multiple teachers", async () => {
  const originals = { findPermit: ExamPermit.findOne, updatePermit: ExamPermit.updateOne, findStudent: User.findOne,
    findTeacher: User.findById, findSchedules: TermSchedule.find, findExams: Exam.find };
  const permit = { _id: "permit-1", studentId: "student-1", examType: "Prelim", scans: [],
    save: async () => {} };
  ExamPermit.findOne = async () => permit;
  ExamPermit.updateOne = async (_filter, update) => { permit.scans.push(update.$push.scans); return { matchedCount: 1 }; };
  User.findOne = () => ({ select: async () => ({ name: "Student", studentId: "student-1", course: "BSIT",
    yearLevel: 1, semester: "1st Semester", schoolYear: "2026-2027", isActive: true,
    verificationStatus: "verified" }) });
  User.findById = () => ({ select: async () => ({ name: "Teacher" }) });
  TermSchedule.find = () => ({ sort: async () => [] });
  Exam.find = () => ({ select: () => ({ sort: () => ({ limit: async () => [] }) }) });
  try {
    for (const id of ["teacher-1", "teacher-2"]) {
      const res = response();
      await scanPermit({ body: { token: "valid-token", examType: "Prelim" }, user: { id } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.verificationStatus, "VERIFIED");
      assert.ok(res.body.scannedAt);
    }
    assert.equal(permit.scans.length, 2);
    assert.deepEqual(permit.scans.map((scan) => scan.teacherId), ["teacher-1", "teacher-2"]);
    const wrongTerm = response();
    await scanPermit({ body: { token: "valid-token", examType: "Midterm" }, user: { id: "teacher-1" } }, wrongTerm);
    assert.equal(wrongTerm.statusCode, 403);
    assert.equal(permit.scans.length, 2);
  } finally {
    ExamPermit.findOne = originals.findPermit; ExamPermit.updateOne = originals.updatePermit; User.findOne = originals.findStudent;
    User.findById = originals.findTeacher; TermSchedule.find = originals.findSchedules;
    Exam.find = originals.findExams;
  }
});

test("publishing a term stores it and notifies only matching students", async () => {
  const originals = { exists: TermSchedule.exists, create: TermSchedule.create,
    find: User.find, notify: Notification.insertMany, startSession: mongoose.startSession };
  let stored; let notified;
  TermSchedule.exists = async () => null;
  mongoose.startSession = async () => ({ withTransaction: async (callback) => callback(), endSession: async () => {} });
  TermSchedule.create = async (values) => { stored = values[0]; return [{ _id: "schedule-1", ...values[0] }]; };
  User.find = () => ({ select: () => ({ session: async () => [{ studentId: "student-1", name: "Student" }] }) });
  Notification.insertMany = async (value) => { notified = value; };
  try {
    const res = response();
    await publish({ user: { id: "admin-1" }, body: { examDate: "2026-10-20",
      semester: "1st Semester", schoolYear: "2026-2027", examType: "Prelim" } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(stored.examType, "Prelim");
    assert.equal(notified.length, 1);
    assert.equal(notified[0].studentId, "student-1");
  } finally {
    TermSchedule.exists = originals.exists; TermSchedule.create = originals.create;
    User.find = originals.find; Notification.insertMany = originals.notify;
    mongoose.startSession = originals.startSession;
  }
});

test("student schedules are queried by their own semester and school year", async () => {
  const originals = { findUser: User.findById, findSchedules: TermSchedule.find, findExams: Exam.find };
  let query;
  User.findById = async () => ({ role: "student", semester: "2nd Semester", schoolYear: "2026-2027", yearLevel: 2 });
  TermSchedule.find = (value) => { query = value; return { sort: async () => [] }; };
  try {
    const res = response();
    await mine({ user: { id: "student-1" } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(query, { semester: "2nd Semester", schoolYear: "2026-2027" });
  } finally {
    User.findById = originals.findUser; TermSchedule.find = originals.findSchedules; Exam.find = originals.findExams;
  }
});
