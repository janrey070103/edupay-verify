const test = require("node:test");
const assert = require("node:assert/strict");
const Exam = require("../Models/Exam");
const Course = require("../Models/Course");
const { clearCourseCache } = require("../services/catalogService");
const { examPeriodWindow, examPeriodProblem } = require("../config/examWindows");
const { createExam, updateExam } = require("../controllers/examController");

const manila = (day) => new Date(`${day}T00:00:00+08:00`);

test("the period is 4 days from the earliest regular exam", () => {
  assert.equal(examPeriodWindow([]), null);
  assert.deepEqual(examPeriodWindow(["2026-11-20", "2026-11-22"]),
    { start: "2026-11-20", end: "2026-11-23", specialFrom: "2026-11-24" });
});

test("regular exams: the first starts the period; later ones must stay within 4 days", () => {
  const exam = (day) => ({ examDate: manila(day), examType: "PreFinal" });
  assert.equal(examPeriodProblem(exam("2026-11-20"), []), null, "first exam: day 1");
  assert.equal(examPeriodProblem(exam("2026-11-23"), ["2026-11-20"]), null, "day 4 is inside");
  assert.match(examPeriodProblem(exam("2026-11-24"), ["2026-11-20"]),
    /Pre-Finals exam period is 4 days: Nov 20–Nov 23, 2026, .* Special exam from Nov 24/);
  // An earlier date is fine only if every regular exam still fits in 4 days.
  assert.equal(examPeriodProblem(exam("2026-11-19"), ["2026-11-20", "2026-11-22"]), null);
  assert.match(examPeriodProblem(exam("2026-11-18"), ["2026-11-20", "2026-11-22"]), /4 days/);
});

test("special exams: only after the 4-day period, and only once regular exams exist", () => {
  const special = (day) => ({ examDate: manila(day), examType: "PreFinal", examKind: "Special" });
  assert.match(examPeriodProblem(special("2026-11-25"), []), /Schedule the regular Pre-Finals exams first/);
  assert.match(examPeriodProblem(special("2026-11-23"), ["2026-11-20"]), /after the Pre-Finals exam period .* Pick Nov 24 or later/);
  assert.equal(examPeriodProblem(special("2026-11-24"), ["2026-11-20"]), null);
  assert.equal(examPeriodProblem(special("2026-11-28"), ["2026-11-20"]), null);
});

// --- Through the controller (stubbed models) -------------------------------
const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } });

const withExamStubs = async (t, regularDays, run) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-13T02:00:00Z") });
  const saved = { course: Course.find, find: Exam.find, findOne: Exam.findOne, create: Exam.create, findById: Exam.findById };
  Course.find = () => ({ select: () => ({ lean: async () => [{ code: "BSIT", name: "BS IT", department: "ICT", majors: [], active: true }] }) });
  clearCourseCache();
  const queries = [];
  Exam.find = (query) => { queries.push(query); return { select: () => ({ lean: async () => regularDays.map((day) => ({ examDate: manila(day) })) }) }; };
  Exam.findOne = async () => null;
  let created = null;
  Exam.create = async (values) => { created = values; return values; };
  try { await run({ queries, created: () => created }); } finally {
    Object.assign(Course, { find: saved.course }); Object.assign(Exam, { find: saved.find, findOne: saved.findOne, create: saved.create, findById: saved.findById });
    clearCourseCache();
  }
};
const admin = { id: "64b0000000000000000000a1", role: "admin", department: "ICT" };
const body = (overrides) => ({ examDate: manila("2026-11-20").toISOString(), examType: "PreFinal", subject: "Networks",
  subjectCode: "IT301", course: "BSIT", schedule: "8-10", ...overrides });

test("create: a regular exam outside the period and an early special exam are refused", async (t) => {
  await withExamStubs(t, ["2026-11-20"], async ({ queries, created }) => {
    const outside = response();
    await createExam({ user: admin, body: body({ examDate: manila("2026-11-25").toISOString() }) }, outside);
    assert.equal(outside.statusCode, 400);
    assert.match(outside.body.message, /4 days: Nov 20–Nov 23/);
    // Only this term's regular, non-cancelled exams count.
    assert.equal(queries[0].examType, "PreFinal");
    assert.deepEqual(queries[0].examKind, { $ne: "Special" });
    assert.deepEqual(queries[0].status, { $ne: "Cancelled" });

    const earlySpecial = response();
    await createExam({ user: admin, body: body({ examDate: manila("2026-11-22").toISOString(), examKind: "Special" }) }, earlySpecial);
    assert.equal(earlySpecial.statusCode, 400);
    assert.match(earlySpecial.body.message, /Pick Nov 24 or later/);

    const special = response();
    await createExam({ user: admin, body: body({ examDate: manila("2026-11-24").toISOString(), examKind: "Special" }) }, special);
    assert.equal(special.statusCode, 201);
    assert.equal(created().examKind, "Special");
  });
});

test("update: turning an exam inside the period into a Special exam is refused", async (t) => {
  await withExamStubs(t, ["2026-11-20"], async () => {
    const exam = { _id: "64b0000000000000000000e1", examDate: manila("2026-11-21"), examType: "PreFinal", examKind: "Regular",
      subjectCode: "IT301", course: "BSIT", save: async () => {} };
    Exam.findById = async () => exam;
    const res = response();
    await updateExam({ user: admin, params: { id: exam._id }, body: { examKind: "Special" } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /after the Pre-Finals exam period/);
  });
});
