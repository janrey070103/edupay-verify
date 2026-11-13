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

// Catalogue stub: BSIT belongs to ICT, BSA to BMA.
const Course = require("../Models/Course");
const { clearCourseCache } = require("../services/catalogService");
const withCatalog = async (run) => {
  const original = Course.find;
  Course.find = () => ({ select: () => ({ lean: async () => [
    { code: "BSIT", department: "ICT", majors: [], active: true },
    { code: "BSA", department: "BMA", majors: [], active: true },
  ] }) });
  clearCourseCache();
  try { await run(); } finally { Course.find = original; clearCourseCache(); }
};

// Exam-day QR scanning is covered in tests/qrScan.test.js.

test("an Admin publishes a term for its own department and notifies only that department's students", (t) => { t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-13T02:00:00Z") }); return withCatalog(async () => {
  const originals = { exists: TermSchedule.exists, create: TermSchedule.create,
    find: User.find, notify: Notification.insertMany, startSession: mongoose.startSession };
  let stored; let studentQuery; const inserted = [];
  TermSchedule.exists = async () => null;
  mongoose.startSession = async () => ({ withTransaction: async (callback) => callback(), endSession: async () => {} });
  TermSchedule.create = async (values) => { stored = values[0]; return [{ _id: "schedule-1", ...values[0] }]; };
  User.find = (query) => {
    if (query.role === "student") studentQuery = query;
    return { select: () => (query.role === "student"
      ? { session: async () => [{ studentId: "student-1", name: "Student" }] }
      : Promise.resolve([{ _id: "admin-2" }])) };
  };
  Notification.insertMany = async (value) => { inserted.push(value); };
  try {
    const res = response();
    await publish({ user: { id: "admin-1", role: "admin", department: "ICT" }, body: { examDate: "2026-11-20",
      semester: "1st Semester", schoolYear: "2026-2027", examType: "PreFinal" } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(stored.examType, "PreFinal");
    assert.equal(stored.department, "ICT");
    // Students are limited to ICT courses (BSIT matches, BSA does not).
    const pattern = studentQuery.course.$in[0];
    assert.ok(pattern.test("BSIT") && !pattern.test("BSA"));
    assert.equal(inserted[0].length, 1);
    assert.equal(inserted[0][0].studentId, "student-1");
    // The other department's Admin is told about it.
    assert.equal(inserted[1][0].recipientUserId, "admin-2");
    assert.equal(inserted[1][0].title, "Term Schedule Published");

    const noDepartment = response();
    await publish({ user: { id: "admin-3", role: "admin" }, body: {} }, noDepartment);
    assert.equal(noDepartment.statusCode, 403);
  } finally {
    TermSchedule.exists = originals.exists; TermSchedule.create = originals.create;
    User.find = originals.find; Notification.insertMany = originals.notify;
    mongoose.startSession = originals.startSession;
  }
}); });

test("a student's schedule uses their department's date over the school-wide one", () => withCatalog(async () => {
  const originals = { findUser: User.findById, findSchedules: TermSchedule.find, findExams: Exam.find };
  let query;
  const schoolWide = { examType: "Prelim", examDate: new Date("2026-10-19"), toObject() { return { ...this, toObject: undefined }; } };
  const ictPrelim = { examType: "Prelim", department: "ICT", examDate: new Date("2026-10-20"), toObject() { return { ...this, toObject: undefined }; } };
  const schoolMidterm = { examType: "Midterm", examDate: new Date("2026-12-01"), toObject() { return { ...this, toObject: undefined }; } };
  User.findById = async () => ({ role: "student", course: "bsit", semester: "2nd Semester", schoolYear: "2026-2027", yearLevel: 2 });
  TermSchedule.find = (value) => { query = value; return { sort: async () => [schoolWide, ictPrelim, schoolMidterm] }; };
  Exam.find = () => ({ select: async () => [] });
  try {
    const res = response();
    await mine({ user: { id: "student-1" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(query.semester, "2nd Semester");
    assert.equal(query.schoolYear, "2026-2027");
    assert.deepEqual(query.$or, [{ department: { $in: [null] } }, { department: "ICT" }]);
    assert.equal(res.body.length, 2);
    assert.equal(res.body.find((row) => row.examType === "Prelim").department, "ICT");
    assert.equal(res.body.find((row) => row.examType === "Midterm").department, undefined);
  } finally {
    User.findById = originals.findUser; TermSchedule.find = originals.findSchedules; Exam.find = originals.findExams;
  }
}));
