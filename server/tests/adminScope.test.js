const test = require("node:test");
const assert = require("node:assert/strict");
const Course = require("../Models/Course");
const User = require("../Models/User");
const Exam = require("../Models/Exam");
const Notification = require("../Models/Notification");
const allowRoles = require("../middleware/allowRoles");
const { clearCourseCache } = require("../services/catalogService");
const { courseScope, inScope } = require("../utils/adminScope");
const { courseProblem } = require("../utils/courseRules");
const { verifyStudent } = require("../controllers/userManagementController");
const { createExam } = require("../controllers/examController");

// Verifying rewrites the Admins' registration notices; no database in these tests.
Notification.updateMany = async () => ({});

const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; },
});

const CATALOG = [
  { code: "BSIT", department: "ICT", majors: [], active: true },
  { code: "BSCS", department: "ICT", majors: [], active: true },
  { code: "BSA", department: "BMA", majors: [], active: true },
  { code: "BSBA", department: "BMA", active: true },
  { code: "BSHM", department: "HTM", active: false },
];

const withCatalog = async (run) => {
  const original = Course.find;
  Course.find = () => ({ select: () => ({ lean: async () => CATALOG }) });
  clearCourseCache();
  try { await run(); } finally { Course.find = original; clearCourseCache(); }
};

const ictAdmin = { id: "admin-ict", role: "admin", department: "ICT" };
// Exams now always have a year, a capacity and at least one section with a proctor.
const SECTION_FIELDS = { courseYear: 1, capacity: 40, sections: [{ letter: "A", room: "Room 201", proctorId: "64b0000000000000000000c1" }] };
User.find = () => ({ select: () => ({ lean: async () => [{ _id: "64b0000000000000000000c1", name: "Teacher One", email: "t1@x" }] }) });
const realUserFindById = User.findById;
User.findById = (id) => (id === "64b0000000000000000000c1" ? { select: () => ({ lean: async () => null }) } : realUserFindById.call(User, id));

const bmaAdmin = { id: "admin-bma", role: "admin", department: "BMA" };

test("only the listed roles pass allowRoles", () => {
  const guard = allowRoles("admin");
  for (const role of ["student", "cashier", "teacher", "super_admin"]) {
    const res = response(); let passed = false;
    guard({ user: { role } }, res, () => { passed = true; });
    assert.equal(passed, false, role); assert.equal(res.statusCode, 403);
  }
  let passed = false;
  guard({ user: { role: "admin" } }, response(), () => { passed = true; });
  assert.equal(passed, true);
});

test("an Admin's scope is strictly its own department's courses", () => withCatalog(async () => {
  assert.equal(await inScope({ user: ictAdmin }, "BSIT"), true);
  assert.equal(await inScope({ user: ictAdmin }, "BSA"), false);
  // Older typed values match their official code regardless of case/spacing...
  assert.equal(await inScope({ user: ictAdmin }, "bs-it"), true);
  assert.equal(await inScope({ user: bmaAdmin }, "b.s.a"), true);
  assert.equal(await inScope({ user: ictAdmin }, "bsa"), false, "another department's course, typed differently");
  // ...but values matching no course are shown to no Admin.
  assert.equal(await inScope({ user: ictAdmin }, "bs info tech"), false);
  assert.equal(await inScope({ user: ictAdmin }, ""), false);
  assert.equal(await inScope({ user: ictAdmin }, "", { includeUnassigned: true }), true, "course-less exams stay claimable");
  assert.equal(await inScope({ user: { role: "admin" } }, "BSIT"), false, "no department sees nothing");
  const { course } = await courseScope({ user: ictAdmin });
  assert.equal(course.$in.length, 2);
  assert.ok(course.$in[0].test("bsit") && course.$in[0].test("B.S. IT") && !course.$in[0].test("BSITX"));
}));

test("an Admin cannot verify a student from another department", () => withCatalog(async () => {
  const originals = { findById: User.findById, create: Notification.create };
  let saved = false;
  User.findById = async () => ({ role: "student", course: "BSA", verificationStatus: "pending",
    save: async () => { saved = true; }, toObject: () => ({}) });
  Notification.create = async () => ({});
  try {
    const res = response();
    await verifyStudent({ params: { id: "student-1" }, user: ictAdmin }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(saved, false);
  } finally { User.findById = originals.findById; Notification.create = originals.create; }
}));

test("an Admin can verify a student in its department", () => withCatalog(async () => {
  const originals = { findById: User.findById, create: Notification.create };
  const student = { role: "student", course: "BSIT", verificationStatus: "pending",
    save: async () => {}, toObject: () => ({}) };
  User.findById = async () => student;
  Notification.create = async () => ({});
  try {
    const res = response();
    await verifyStudent({ params: { id: "student-1" }, user: ictAdmin }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(student.verificationStatus, "verified");
  } finally { User.findById = originals.findById; Notification.create = originals.create; }
}));

test("exams can only be created for a course in the Admin's department", (t) => { t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-13T02:00:00Z") }); return withCatalog(async () => {
  const originals = { findOne: Exam.findOne, create: Exam.create, find: Exam.find };
  let created;
  Exam.findOne = async () => null;
  Exam.find = () => ({ select: () => ({ lean: async () => [] }) }); // no other exams in the term yet
  Exam.create = async (values) => { created = values; return values; };
  const body = { examDate: "2026-11-20", examType: "PreFinal", subject: "Networks", subjectCode: "IT101", schedule: "8-10", ...SECTION_FIELDS };
  try {
    const denied = response();
    await createExam({ user: ictAdmin, body: { ...body, course: "BSA" } }, denied);
    assert.equal(denied.statusCode, 400);
    assert.equal(created, undefined);
    const ok = response();
    await createExam({ user: ictAdmin, body: { ...body, course: "BSIT" } }, ok);
    assert.equal(ok.statusCode, 201);
    assert.equal(created.course, "BSIT");
  } finally { Exam.findOne = originals.findOne; Exam.create = originals.create; Exam.find = originals.find; }
}); });

test("students must pick an active catalogue course", () => withCatalog(async () => {
  assert.equal(await courseProblem("BSIT"), null);
  assert.match(await courseProblem("BS IT"), /Choose a course/);
  assert.equal(await courseProblem("BSBA"), null, "no major is asked for");
  assert.match(await courseProblem("BSHM"), /Choose a course/, "retired courses cannot be chosen");
}));

test("verifying a student stores the official course code for an older typed value", () => withCatalog(async () => {
  const originals = { findById: User.findById, create: Notification.create };
  const student = { role: "student", course: "bs-it", verificationStatus: "pending",
    save: async () => {}, toObject: () => ({}) };
  User.findById = async () => student;
  Notification.create = async () => ({});
  try {
    const res = response();
    await verifyStudent({ params: { id: "student-1" }, user: ictAdmin }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(student.course, "BSIT");
  } finally { User.findById = originals.findById; Notification.create = originals.create; }
}));

test("exam times: picked times are saved; bad or reversed times are refused", (t) => { t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-13T02:00:00Z") }); return withCatalog(async () => {
  const originals = { findOne: Exam.findOne, create: Exam.create, find: Exam.find };
  let created;
  Exam.findOne = async () => null;
  Exam.find = () => ({ select: () => ({ lean: async () => [] }) }); // no other exams in the term yet
  Exam.create = async (values) => { created = values; return values; };
  const body = { examDate: "2026-11-20", examType: "PreFinal", subject: "Networks", subjectCode: "IT101", course: "BSIT", schedule: "9:00 AM – 11:00 AM", ...SECTION_FIELDS };
  try {
    const ok = response();
    await createExam({ user: ictAdmin, body: { ...body, startTime: "09:00", endTime: "11:00" } }, ok);
    assert.equal(ok.statusCode, 201);
    assert.equal(created.startTime, "09:00");
    assert.equal(created.endTime, "11:00");
    const reversed = response();
    await createExam({ user: ictAdmin, body: { ...body, startTime: "11:00", endTime: "09:00" } }, reversed);
    assert.equal(reversed.statusCode, 400);
    const manual = response();
    await createExam({ user: ictAdmin, body: { ...body, schedule: "After lunch, TBA", startTime: "", endTime: "" } }, manual);
    assert.equal(manual.statusCode, 201);
    assert.equal(created.startTime, undefined, "typed schedule: no picked times");
  } finally { Exam.findOne = originals.findOne; Exam.create = originals.create; Exam.find = originals.find; }
}); });
