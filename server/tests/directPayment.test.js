const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../Models/User");
const Ledger = require("../Models/Ledger");
const Payment = require("../Models/Payments");
const { searchStudents } = require("../controllers/userManagementController");
const { getStudentPaymentOverview } = require("../controllers/paymentController");

const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; },
});

test("student search needs 2 characters and treats typed text literally", async () => {
  const original = User.find;
  let filter;
  User.find = (value) => { filter = value; const q = { select: () => q, sort: () => q, limit: async () => [] }; return q; };
  try {
    const short = response();
    await searchStudents({ query: { query: "a" } }, short);
    assert.equal(short.statusCode, 400);
    const res = response();
    await searchStudents({ query: { query: "BS(IT" } }, res);
    assert.equal(res.statusCode, 200);
    const pattern = filter.$or[0].studentId;
    assert.ok(pattern.test("bs(it-1"), "parenthesis is matched as text");
    assert.ok(!pattern.test("BSIT"));
  } finally { User.find = original; }
});

test("the cashier overview shows balance, cleared terms and pending receipts", async () => {
  const originals = { findOne: User.findOne, ledger: Ledger.findOne, count: Payment.countDocuments, find: Payment.find };
  User.findOne = () => ({ select: () => ({ lean: async () => ({ studentId: "S1", isActive: true, verificationStatus: "verified" }) }) });
  Ledger.findOne = () => ({ lean: async () => ({ totalTuition: 20000, paidAmount: 5000, remainingBalance: 15000,
    fullyPaid: false, prelim: true, midterm: false, preFinal: false, final: false }) });
  Payment.countDocuments = async () => 1;
  Payment.find = () => ({ sort: () => ({ limit: () => ({ select: () => ({ lean: async () => [] }) }) }) });
  try {
    const res = response();
    await getStudentPaymentOverview({ params: { studentId: "S1" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.canPay, true);
    assert.equal(res.body.ledger.remainingBalance, 15000);
    assert.deepEqual(res.body.ledger.terms, { Prelim: true, Midterm: false, PreFinal: false, Final: false });
    assert.equal(res.body.pendingReceipts, 1);

    User.findOne = () => ({ select: () => ({ lean: async () => ({ studentId: "S2", isActive: false, verificationStatus: "verified" }) }) });
    const archived = response();
    await getStudentPaymentOverview({ params: { studentId: "S2" } }, archived);
    assert.equal(archived.body.canPay, false);
  } finally {
    User.findOne = originals.findOne; Ledger.findOne = originals.ledger;
    Payment.countDocuments = originals.count; Payment.find = originals.find;
  }
});

test("receipt uploads must say how the student paid (Palawan, online or bank)", async () => {
  const { createPayment } = require("../controllers/paymentController");
  const original = User.findById;
  User.findById = async () => ({ role: "student", studentId: "S1", name: "Student" });
  try {
    const base = { user: { id: "u1" }, file: { path: "https://example.invalid/receipt.jpg" },
      body: { examCoverage: "Prelim", paymentDescription: "Tuition - Prelim" } };
    const missing = response();
    await createPayment(base, missing);
    assert.equal(missing.statusCode, 400);
    assert.match(missing.body.message, /how you paid/);
    const unknown = response();
    await createPayment({ ...base, body: { ...base.body, paymentChannel: "cash" } }, unknown);
    assert.equal(unknown.statusCode, 400);
  } finally { User.findById = original; }
});

test("receipt uploads need the amount sent and the reference number; duplicates are flagged, not blocked", async () => {
  const { createPayment } = require("../controllers/paymentController");
  const analyzer = require("../services/ocr/receiptAnalyzer");
  const Notification = require("../Models/Notification");
  const originals = { findById: User.findById, find: Payment.find, create: Payment.create, notify: Notification.create, analyze: analyzer.analyzeReceipt, ledger: Ledger.findOne };
  User.findById = async () => ({ role: "student", studentId: "22-0989-552", name: "Student", schoolYear: "2026-2027" });
  Ledger.findOne = () => ({ lean: async () => null }); // no payments yet
  const base = { user: { id: "u1" }, file: { path: "https://example.invalid/r.jpg" },
    body: { examCoverage: "Prelim", paymentDescription: "Tuition - Prelim", paymentChannel: "palawan" } };
  try {
    const noAmount = response();
    await createPayment({ ...base, body: { ...base.body, referenceNumber: "ABM-20-72278-VPN" } }, noAmount);
    assert.equal(noAmount.statusCode, 400);
    assert.match(noAmount.body.message, /amount you sent/);
    const noRef = response();
    await createPayment({ ...base, body: { ...base.body, claimedAmount: "8927" } }, noRef);
    assert.equal(noRef.statusCode, 400);
    assert.match(noRef.body.message, /reference/);

    // The controller holds its own reference to analyzeReceipt, so stub the
    // OCR engine underneath it instead (no network or Tesseract in tests).
    const prep = require("../services/ocr/imagePrep");
    const engine = require("../services/ocr/ocrEngine");
    const prepOriginals = { download: prep.downloadImage, standard: prep.standardImage, ink: prep.inkIsolatedImage, recognize: engine.recognize };
    prep.downloadImage = async () => Buffer.from("x");
    prep.standardImage = async (b) => b;
    prep.inkIsolatedImage = async (b) => b;
    engine.recognize = async () => ({ text: "PALAWAN EXPRESS\nAMOUNT 8,927.00\nABM-20-72278-VPN\n220989552 VPN STI", confidence: 80 });
    let created;
    Payment.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ studentId: "19-1111-222", createdAt: new Date("2026-10-01"), status: "Approved" }] }) }) }) });
    Payment.create = async (doc) => { created = doc; return { _id: "p1", ...doc }; };
    Notification.create = async () => ({});
    try {
      const ok = response();
      await createPayment({ ...base, body: { ...base.body, claimedAmount: "8927", referenceNumber: " abm-20-72278-vpn " } }, ok);
      assert.equal(ok.statusCode, 201, JSON.stringify(ok.body));
      assert.equal(created.claimedAmount, 8927);
      assert.equal(created.referenceKey, "ABM2072278VPN");
      assert.equal(created.amount, 8927, "pre-filled for the cashier");
      assert.ok(created.ocr.flags.some((f) => f.code === "duplicate_reference"), "used by another student -> flagged");
      assert.equal(created.ocr.text, undefined, "full receipt text is never stored");
    } finally {
      prep.downloadImage = prepOriginals.download; prep.standardImage = prepOriginals.standard;
      prep.inkIsolatedImage = prepOriginals.ink; engine.recognize = prepOriginals.recognize;
    }
  } finally {
    User.findById = originals.findById; Payment.find = originals.find; Payment.create = originals.create;
    Notification.create = originals.notify; analyzer.analyzeReceipt = originals.analyze; Ledger.findOne = originals.ledger;
  }
});

test("full tuition payment: needs a balance, one at a time, short amounts flagged, full approval clears all terms", async () => {
  const mongoose = require("mongoose");
  const { createPayment, approvePayment } = require("../controllers/paymentController");
  const Ledger = require("../Models/Ledger");
  const ExamPermit = require("../Models/ExamPermit");
  const Notification = require("../Models/Notification");
  const prep = require("../services/ocr/imagePrep");
  const engine = require("../services/ocr/ocrEngine");
  const saved = { findById: User.findById, userOne: User.findOne, ledgerOne: Ledger.findOne, exists: Payment.exists, find: Payment.find,
    create: Payment.create, fou: Payment.findOneAndUpdate, permit: ExamPermit.findOneAndUpdate, notify: Notification.create,
    session: mongoose.startSession, download: prep.downloadImage, standard: prep.standardImage, ink: prep.inkIsolatedImage, recognize: engine.recognize };
  User.findById = async () => ({ role: "student", studentId: "S1", name: "Student", schoolYear: "2026-2027" });
  prep.downloadImage = async () => Buffer.from("x"); prep.standardImage = async (b) => b; prep.inkIsolatedImage = async (b) => b;
  engine.recognize = async () => ({ text: "PALAWAN EXPRESS AMOUNT 15,000.00 REF ABM-1", confidence: 80 });
  Payment.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Notification.create = async () => ({});
  const body = { paymentType: "Full Tuition", paymentDescription: "Full Tuition Payment", paymentChannel: "palawan",
    claimedAmount: "15000", referenceNumber: "ABM-1" };
  const req = { user: { id: "u1" }, file: { path: "https://example.invalid/r.jpg" }, body };
  try {
    // Already fully paid -> refused.
    Ledger.findOne = () => ({ lean: async () => ({ remainingBalance: 0, fullyPaid: true }) });
    let res = response(); await createPayment(req, res);
    assert.equal(res.statusCode, 409); assert.match(res.body.message, /already fully paid/);

    // A full tuition receipt already waiting -> refused.
    Ledger.findOne = () => ({ lean: async () => ({ remainingBalance: 20000, fullyPaid: false }) });
    Payment.exists = async () => true;
    res = response(); await createPayment(req, res);
    assert.equal(res.statusCode, 409); assert.match(res.body.message, /waiting for cashier review/);

    // Short of the 20,000 balance -> accepted but flagged for the cashier.
    Payment.exists = async () => null;
    let created; Payment.create = async (doc) => { created = doc; return { _id: "p1", ...doc }; };
    res = response(); await createPayment(req, res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    assert.equal(created.paymentType, "Full Tuition");
    assert.equal(created.examCoverage, undefined);
    assert.equal(created.paymentDescription, "Full Tuition Payment");
    assert.ok(created.ocr.flags.some((f) => f.code === "full_tuition_amount" && /less than the remaining balance/.test(f.message)));

    // Approving the whole balance clears every term and readies four permits.
    const ledger = { studentId: "S1", totalTuition: 20000, paidAmount: 0, remainingBalance: 20000, fullyPaid: false,
      prelim: false, midterm: false, preFinal: false, final: false, save: async () => {} };
    const permits = [];
    mongoose.startSession = async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} });
    Payment.findOneAndUpdate = async () => ({ _id: "p1", studentId: "S1", studentName: "Student", amount: 20000,
      paymentType: "Full Tuition", paymentDescription: "Full Tuition Payment" });
    User.findOne = () => ({ session: async () => ({ isActive: true, verificationStatus: "verified" }) });
    Ledger.findOne = () => ({ session: async () => ledger });
    ExamPermit.findOneAndUpdate = async (filter) => { permits.push(filter.examType); return {}; };
    Notification.create = async () => [{}];
    res = response(); await approvePayment({ params: { id: "p1" }, body: { amount: 20000 }, user: { id: "c1" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(ledger.fullyPaid, true);
    assert.deepEqual([ledger.prelim, ledger.midterm, ledger.preFinal, ledger.final], [true, true, true, true]);
    assert.deepEqual(permits.sort(), ["Final", "Midterm", "PreFinal", "Prelim"]);
  } finally {
    User.findById = saved.findById; User.findOne = saved.userOne; Ledger.findOne = saved.ledgerOne; Payment.exists = saved.exists;
    Payment.find = saved.find; Payment.create = saved.create; Payment.findOneAndUpdate = saved.fou;
    ExamPermit.findOneAndUpdate = saved.permit; Notification.create = saved.notify; mongoose.startSession = saved.session;
    prep.downloadImage = saved.download; prep.standardImage = saved.standard; prep.inkIsolatedImage = saved.ink; engine.recognize = saved.recognize;
  }
});

test("a fully paid student cannot upload another receipt, and a cleared term cannot be paid again", async () => {
  const { createPayment } = require("../controllers/paymentController");
  const originals = { findById: User.findById, ledger: Ledger.findOne };
  User.findById = async () => ({ role: "student", studentId: "S1", name: "Student" });
  const body = { examCoverage: "Prelim", paymentDescription: "Tuition - Prelim", paymentChannel: "palawan", claimedAmount: "5000", referenceNumber: "ABC12345" };
  const req = (extra = {}) => ({ user: { id: "u1" }, file: { path: "https://example.invalid/r.jpg" }, body: { ...body, ...extra } });
  try {
    Ledger.findOne = () => ({ lean: async () => ({ fullyPaid: true, remainingBalance: 0, prelim: true, midterm: true, preFinal: true, final: true }) });
    const paid = response();
    await createPayment(req(), paid);
    assert.equal(paid.statusCode, 409);
    assert.match(paid.body.message, /already fully paid/);
    const fullTuition = response();
    await createPayment(req({ paymentType: "Full Tuition", paymentDescription: "Full Tuition Payment", examCoverage: "" }), fullTuition);
    assert.equal(fullTuition.statusCode, 409);

    Ledger.findOne = () => ({ lean: async () => ({ fullyPaid: false, remainingBalance: 15000, prelim: true }) });
    const cleared = response();
    await createPayment(req(), cleared);
    assert.equal(cleared.statusCode, 409);
    assert.match(cleared.body.message, /already cleared for Prelim/);
  } finally { User.findById = originals.findById; Ledger.findOne = originals.ledger; }
});

test("the cashier overview cannot record a payment for a fully paid student", async () => {
  const originals = { findOne: User.findOne, ledger: Ledger.findOne, count: Payment.countDocuments, find: Payment.find };
  User.findOne = () => ({ select: () => ({ lean: async () => ({ studentId: "S1", isActive: true, verificationStatus: "verified" }) }) });
  Ledger.findOne = () => ({ lean: async () => ({ totalTuition: 20000, paidAmount: 20000, remainingBalance: 0, fullyPaid: true,
    prelim: true, midterm: true, preFinal: true, final: true }) });
  Payment.countDocuments = async () => 0;
  Payment.find = () => ({ sort: () => ({ limit: () => ({ select: () => ({ lean: async () => [] }) }) }) });
  try {
    const res = response();
    await getStudentPaymentOverview({ params: { studentId: "S1" } }, res);
    assert.equal(res.body.canPay, false);
    assert.equal(res.body.ledger.fullyPaid, true);
  } finally {
    User.findOne = originals.findOne; Ledger.findOne = originals.ledger;
    Payment.countDocuments = originals.count; Payment.find = originals.find;
  }
});
