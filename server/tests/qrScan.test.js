const test = require("node:test");
const assert = require("node:assert/strict");
const ExamPermit = require("../Models/ExamPermit");
const User = require("../Models/User");
const Exam = require("../Models/Exam");
const Course = require("../Models/Course");
const Notification = require("../Models/Notification");
const { clearCourseCache } = require("../services/catalogService");
const { scanPermit } = require("../controllers/qrController");
const { examStatus } = require("../controllers/studentExamController");

const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; },
});

const TEACHER = "64b0000000000000000000a1";
const EXAM_ID = "64b0000000000000000000e1";
const OTHER_EXAM_ID = "64b0000000000000000000e2";
const TODAY = new Date("2026-08-20T01:00:00Z"); // Aug 20, 9:00 AM Manila - inside the 1st-sem Prelim month

const makeExam = (overrides = {}) => ({ _id: EXAM_ID, subject: "Networking 1", subjectCode: "IT201", examType: "Prelim",
  course: "BSIT", courseYear: 2, room: "301", schedule: "8:00-10:00", examDate: new Date("2026-08-20T00:00:00Z"),
  status: "Scheduled", proctorId: TEACHER, ...overrides });

/** Stubs the models and simulates the atomic "not yet verified for this exam" lock. */
const setup = (t, { exams = { [EXAM_ID]: makeExam() }, student = {} } = {}) => {
  t.mock.timers.enable({ apis: ["Date"], now: TODAY });
  const permit = { _id: "permit-1", studentId: "22-0989-552", examType: "Prelim", permitStatus: "Valid", scans: [] };
  const saved = { Exam: Exam.findById, findOne: ExamPermit.findOne, findById: ExamPermit.findById, updateOne: ExamPermit.updateOne,
    userOne: User.findOne, userById: User.findById, course: Course.find, notify: Notification.create };
  Exam.findById = async (id) => exams[String(id)] || null;
  ExamPermit.findOne = async () => permit;
  ExamPermit.findById = () => ({ select: async () => permit });
  ExamPermit.updateOne = async (filter, update) => {
    const already = permit.scans.some((scan) => String(scan.examId) === String(filter["scans.examId"].$ne));
    if (already) return { matchedCount: 0 };
    permit.scans.push(update.$push.scans);
    return { matchedCount: 1 };
  };
  User.findOne = () => ({ select: async () => ({ name: "Student", studentId: "22-0989-552", course: "BSIT", yearLevel: 2,
    semester: "1st Semester", schoolYear: "2026-2027", isActive: true, verificationStatus: "verified", ...student }) });
  User.findById = () => ({ select: async () => ({ name: "Prof. Cruz" }) });
  Course.find = () => ({ select: () => ({ lean: async () => [{ code: "BSIT", department: "ICT", majors: [], active: true },
    { code: "BSA", department: "BMA", majors: [], active: true }] }) });
  clearCourseCache();
  const notices = [];
  Notification.create = async (doc) => { notices.push(doc); return doc; };
  t.after(() => {
    Exam.findById = saved.Exam; ExamPermit.findOne = saved.findOne; ExamPermit.findById = saved.findById;
    ExamPermit.updateOne = saved.updateOne; User.findOne = saved.userOne; User.findById = saved.userById;
    Course.find = saved.course; Notification.create = saved.notify; clearCourseCache();
  });
  return { permit, notices };
};
const scan = async (examId = EXAM_ID, teacher = TEACHER) => {
  const res = response();
  await scanPermit({ body: { token: "valid-token", examId }, user: { id: teacher, role: "teacher" } }, res);
  return res;
};

test("a verified QR shows subject, room and proctor, notifies the student, and is locked for that subject", async (t) => {
  const { permit, notices } = setup(t, { exams: { [EXAM_ID]: makeExam(), [OTHER_EXAM_ID]: makeExam({ _id: OTHER_EXAM_ID, subjectCode: "IT202", subject: "Database 1", room: "302" }) } });
  const first = await scan();
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.exam.subjectCode, "IT201");
  assert.equal(first.body.exam.room, "301");
  assert.equal(first.body.verifiedBy.name, "Prof. Cruz");
  assert.equal(permit.scans.length, 1);
  assert.match(notices[0].message, /IT201.*Room 301.*Prof\. Cruz/);

  const again = await scan();
  assert.equal(again.statusCode, 409);
  assert.equal(again.body.locked, true);
  assert.match(again.body.message, /Already verified for IT201 .* by Prof\. Cruz/);
  assert.equal(permit.scans.length, 1, "a second scan for the same subject is not recorded");

  const otherSubject = await scan(OTHER_EXAM_ID);
  assert.equal(otherSubject.statusCode, 200, "the same QR still works for the student's other subject");
  assert.equal(permit.scans.length, 2);
});

test("strict: a student from another year level or course cannot be verified", async (t) => {
  setup(t, { student: { yearLevel: 1 } });
  const wrongYear = await scan();
  assert.equal(wrongYear.statusCode, 403);
  assert.match(wrongYear.body.message, /IT201 is for 2nd-year students; 22-0989-552 is in 1st-year/);
});

test("strict: wrong course is refused", async (t) => {
  setup(t, { student: { course: "BSA" } });
  const wrongCourse = await scan();
  assert.equal(wrongCourse.statusCode, 403);
  assert.match(wrongCourse.body.message, /for BSIT students; 22-0989-552 is enrolled in BSA/);
});

test("strict: only the assigned proctor, only on the exam day, only for the permit's term", async (t) => {
  setup(t, { exams: {
    [EXAM_ID]: makeExam({ examDate: new Date("2026-08-21T00:00:00Z") }),
    [OTHER_EXAM_ID]: makeExam({ _id: OTHER_EXAM_ID, examType: "Midterm" }),
  } });
  assert.equal((await scan(EXAM_ID, "64b0000000000000000000ff")).statusCode, 403, "not this exam's proctor");
  const wrongDay = await scan();
  assert.equal(wrongDay.statusCode, 403);
  assert.match(wrongDay.body.message, /only be verified on the exam day/);
  const wrongTerm = await scan(OTHER_EXAM_ID);
  assert.equal(wrongTerm.statusCode, 403);
  assert.match(wrongTerm.body.message, /Prelim permit/);
  assert.equal((await scan("not-an-id")).statusCode, 400);
});

test("calendar status: verified, today, upcoming, missed, cancelled", () => {
  const now = new Date("2026-08-20T03:00:00Z");
  const exam = (date, status = "Scheduled") => ({ examDate: new Date(date), status });
  assert.equal(examStatus(exam("2026-08-19T00:00:00Z"), { verifiedAt: now }, now), "verified");
  assert.equal(examStatus(exam("2026-08-20T00:00:00Z"), null, now), "today");
  assert.equal(examStatus(exam("2026-08-25T00:00:00Z"), null, now), "upcoming");
  assert.equal(examStatus(exam("2026-08-10T00:00:00Z"), null, now), "missed");
  assert.equal(examStatus(exam("2026-08-25T00:00:00Z", "Cancelled"), null, now), "cancelled");
});

test("teacher calendar status: today, upcoming, finished, cancelled", () => {
  const { proctorStatus } = require("../controllers/studentExamController");
  const now = new Date("2026-08-20T03:00:00Z");
  const exam = (date, status = "Scheduled") => ({ examDate: new Date(date), status });
  assert.equal(proctorStatus(exam("2026-08-20T00:00:00Z"), now), "today");
  assert.equal(proctorStatus(exam("2026-08-25T00:00:00Z"), now), "upcoming");
  assert.equal(proctorStatus(exam("2026-08-10T00:00:00Z"), now), "finished");
  assert.equal(proctorStatus(exam("2026-08-25T00:00:00Z", "Cancelled"), now), "cancelled");
});
