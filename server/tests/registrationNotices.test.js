const test = require("node:test");
const assert = require("node:assert/strict");
const Course = require("../Models/Course");
const User = require("../Models/User");
const Notification = require("../Models/Notification");
const { clearCourseCache } = require("../services/catalogService");
const { verifyStudent, rejectStudent } = require("../controllers/userManagementController");

const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; },
});

const setup = (t, { failUpdate = false } = {}) => {
  const originals = { courseFind: Course.find, findById: User.findById, create: Notification.create, updateMany: Notification.updateMany };
  t.after(() => { Object.assign(Course, { find: originals.courseFind }); User.findById = originals.findById;
    Notification.create = originals.create; Notification.updateMany = originals.updateMany; clearCourseCache(); });
  Course.find = () => ({ select: () => ({ lean: async () => [{ code: "BSIT", department: "ICT", active: true }] }) });
  clearCourseCache();
  const student = { studentId: "26-2775-656", name: "Juan Miguel Ramirez Dela Cruz Jr.", role: "student", course: "BSIT",
    verificationStatus: "pending", save: async () => {}, toObject: () => ({}) };
  // First call loads the student; the second loads who acted.
  User.findById = (id) => (id === "student-1" ? Promise.resolve(student)
    : { select: () => ({ lean: async () => ({ name: "Ana Reyes", role: "admin" }) }) });
  Notification.create = async () => ({});
  const updates = [];
  Notification.updateMany = async (filter, update) => { if (failUpdate) throw new Error("db down"); updates.push({ filter, update }); return {}; };
  return { student, updates };
};

const admin = { id: "admin-1", role: "admin", department: "ICT" };

test("verifying a student turns the Admin and Super Admin registration notices into 'User is verified'", async (t) => {
  const { student, updates } = setup(t);
  const res = response();
  await verifyStudent({ params: { id: "student-1" }, user: admin }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(student.verificationStatus, "verified");
  assert.deepEqual(updates.map((u) => u.filter), [
    { title: "New Student Registration", studentId: "26-2775-656", recipientRole: "admin" },
    { title: "New Student Registration", studentId: "26-2775-656", recipientRole: "super_admin" },
  ]);
  const [forAdmin, forSuperAdmin] = updates.map((u) => u.update.$set);
  assert.equal(forAdmin.title, "User is verified");
  assert.equal(forAdmin.message, "26-2775-656 - Juan Miguel Ramirez Dela Cruz Jr. (BSIT) was verified by Ana Reyes. No action needed.");
  assert.equal(forAdmin.link, "/admin", "no longer points to Pending Students");
  assert.equal(forSuperAdmin.link, "/user-management");
});

test("rejecting a student turns them into 'User is rejected'", async (t) => {
  const { updates } = setup(t);
  const res = response();
  await rejectStudent({ params: { id: "student-1" }, body: {}, user: admin }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(updates[0].update.$set.title, "User is rejected");
});

test("a failed notice update never undoes the verification", async (t) => {
  const { student } = setup(t, { failUpdate: true });
  const res = response();
  t.mock.method(console, "error", () => {});
  await verifyStudent({ params: { id: "student-1" }, user: admin }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(student.verificationStatus, "verified");
});

test("loading notifications settles notices of students verified earlier (e.g. before this rule, or on another device)", async (t) => {
  const { reconcileRegistrationNotices } = require("../services/registrationNotices");
  const originals = { distinct: Notification.distinct, find: User.find, updateMany: Notification.updateMany };
  t.after(() => { Notification.distinct = originals.distinct; User.find = originals.find; Notification.updateMany = originals.updateMany; });
  Notification.distinct = async () => ["26-1234-555", "24-8711-233"];
  let studentQuery;
  User.find = (query) => ({ select: () => ({ lean: async () => {
    if (query.role === "student") {
      studentQuery = query;
      return [{ studentId: "26-1234-555", name: "Marnie Saugon", course: "BSIT", verificationStatus: "verified", verifiedBy: "a1" }];
    }
    return [{ _id: "a1", name: "Laura Talavera", role: "admin" }];
  } }) });
  const updates = [];
  Notification.updateMany = async (filter, update) => { updates.push({ filter, update }); return {}; };

  assert.equal(await reconcileRegistrationNotices(), 1);
  assert.deepEqual(studentQuery.verificationStatus, { $in: ["verified", "rejected"] }, "pending students keep their notice");
  assert.equal(updates.length, 2);
  assert.equal(updates[0].filter.studentId, "26-1234-555");
  assert.equal(updates[0].update.$set.message, "26-1234-555 - Marnie Saugon (BSIT) was verified by Laura Talavera. No action needed.");
});
