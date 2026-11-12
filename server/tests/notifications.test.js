const test = require("node:test");
const assert = require("node:assert/strict");
const Notification = require("../Models/Notification");
const User = require("../Models/User");
const Exam = require("../Models/Exam");
const Course = require("../Models/Course");
const { clearCourseCache } = require("../services/catalogService");
const { describe } = require("../utils/notificationMeta");
const { markMyNotificationsRead, markOneRead } = require("../controllers/notificationController");
const { insertOnce, adminDigests } = require("../services/reminderService");

const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; },
});
const CASHIER = { id: "64b000000000000000000001", role: "cashier" };
const ADMIN = { id: "64b000000000000000000002", role: "admin", department: "ICT" };

test("notifications get a category and the page they open", async () => {
  assert.deepEqual(describe("New Receipt Submitted", "cashier"), { category: "payments", link: "/verify-payments" });
  assert.deepEqual(describe("New Student Registration", "admin"), { category: "accounts", link: "/pending-students" });
  assert.deepEqual(describe("New Student Registration", "super_admin"), { category: "accounts", link: "/user-management" });
  assert.deepEqual(describe("Something new", "teacher"), { category: "general", link: "/teacher" });
  const doc = new Notification({ title: "Payment Rejected", message: "Blurry", recipientRole: "student" });
  await doc.validate();
  assert.equal(doc.category, "payments");
  assert.equal(doc.link, "/history");
  const linked = new Notification({ title: "New Receipt Submitted", message: "x", recipientRole: "cashier",
    link: "/verify-payments?review=abc" });
  await linked.validate();
  assert.equal(linked.link, "/verify-payments?review=abc", "an explicit link is kept");
});

test("one cashier marking all read does not mark them read for other cashiers", async () => {
  const original = Notification.updateMany;
  let update;
  Notification.updateMany = async (_filter, value) => { update = value; return {}; };
  try {
    await markMyNotificationsRead({ user: CASHIER }, response());
    assert.ok(update.$addToSet?.readBy, "shared feeds record the reader");
    assert.equal(String(update.$addToSet.readBy), CASHIER.id);
    assert.equal(update.read, undefined, "the shared read flag is not touched");
  } finally { Notification.updateMany = original; }
});

test("a notification outside the caller's feed cannot be marked read", async () => {
  const originals = { exists: Notification.exists, updateMany: Notification.updateMany };
  let updated = false;
  Notification.exists = async () => null;
  Notification.updateMany = async () => { updated = true; };
  try {
    const res = response();
    await markOneRead({ user: ADMIN, params: { id: "64b0000000000000000000ff" } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(updated, false);
  } finally { Notification.exists = originals.exists; Notification.updateMany = originals.updateMany; }
});

test("reminders already sent are skipped instead of failing", async () => {
  const original = Notification.insertMany;
  Notification.insertMany = async () => {
    const error = new Error("E11000 duplicate key");
    error.code = 11000; error.writeErrors = [{ code: 11000 }]; error.insertedDocs = [{}];
    throw error;
  };
  try {
    assert.equal(await insertOnce([{ dedupeKey: "a" }, { dedupeKey: "b" }]), 1);
  } finally { Notification.insertMany = original; }
});

test("each Admin gets at most one daily summary per kind, keyed by day", async () => {
  const originals = { find: User.find, countUsers: User.countDocuments, countExams: Exam.countDocuments,
    insert: Notification.insertMany, courses: Course.find };
  let inserted = [];
  Course.find = () => ({ select: () => ({ lean: async () => [{ code: "BSIT", department: "ICT", majors: [], active: true }] }) });
  clearCourseCache();
  User.find = () => ({ select: () => ({ lean: async () => [{ _id: "admin-1", department: "ICT" }] }) });
  Exam.countDocuments = async () => 2;
  User.countDocuments = async () => 0;
  Notification.insertMany = async (docs) => { inserted = docs; return docs; };
  try {
    await adminDigests(new Date("2026-10-20T02:00:00Z"));
    assert.equal(inserted.length, 1, "no 'waiting students' notice when nobody is waiting");
    assert.equal(inserted[0].title, "Exams Without Proctor");
    assert.equal(inserted[0].recipientUserId, "admin-1");
    assert.equal(inserted[0].dedupeKey, "no-proctor:admin-1:2026-10-20");
  } finally {
    User.find = originals.find; User.countDocuments = originals.countUsers; Exam.countDocuments = originals.countExams;
    Notification.insertMany = originals.insert; Course.find = originals.courses; clearCourseCache();
  }
});
