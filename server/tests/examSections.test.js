const test = require("node:test");
const assert = require("node:assert/strict");
const Exam = require("../Models/Exam");
const User = require("../Models/User");
const { readSections, resolveSectionProctors, forTeacher, examProctorIds } = require("../services/examSections");

test("sections: named from course and year plus one letter; room and proctor required; at least one", () => {
  const ctx = { course: "BSIT", courseYear: "1" };
  const ok = readSections([{ letter: "a", room: "Rm 201", proctorId: "t1" }, { letter: "B", room: "Rm 202", proctorId: "t2" }], ctx);
  assert.deepEqual(ok.sections.map((s) => s.name), ["BSIT-1A", "BSIT-1B"]);
  assert.equal(readSections([{ letter: "A", room: "R", proctorId: "t1" }], { course: "BECEd", courseYear: 2 }).sections[0].name, "BECEd-2A",
    "the course code is kept as written");
  assert.match(readSections([], ctx).error, /at least one section/);
  assert.match(readSections([{ letter: "AB", room: "R", proctorId: "t1" }], ctx).error, /one letter/);
  assert.match(readSections([{ letter: "1", room: "R", proctorId: "t1" }], ctx).error, /one letter/);
  assert.match(readSections([{ letter: "A", proctorId: "t1" }], ctx).error, /room for section BSIT-1A/);
  assert.match(readSections([{ letter: "A", room: "R" }], ctx).error, /proctor for section BSIT-1A/);
  assert.match(readSections([{ letter: "A", room: "R", proctorId: "t1" }, { letter: "a", room: "S", proctorId: "t2" }], ctx).error, /listed twice/);
  assert.match(readSections([{ letter: "A", room: "R", proctorId: "t1" }, { letter: "B", room: "S", proctorId: "t1" }], ctx).error, /only one section at a time/);
  assert.match(readSections([{ letter: "A", room: "R", proctorId: "t1" }], { course: "BSIT" }).error, /course year/);
  assert.equal(readSections(undefined, ctx).sections, undefined, "not sent = leave sections unchanged");
});

test("a section proctor cannot already proctor another exam at the same time", async (t) => {
  const originals = { userFind: User.find, examFind: Exam.find };
  t.after(() => { User.find = originals.userFind; Exam.find = originals.examFind; });
  User.find = () => ({ select: () => ({ lean: async () => [{ _id: "t1", name: "Ana Cruz", email: "a@x" }, { _id: "t2", name: "Ben Lim", email: "b@x" }] }) });
  const other = { subjectCode: "IT101", schedule: "9:00 AM – 11:00 AM", startTime: "09:00", endTime: "11:00", proctorId: null,
    sections: [{ name: "BSIT-2A", proctorId: "t2" }] };
  Exam.find = () => ({ select: () => ({ lean: async () => [other] }) });
  const exam = { examDate: new Date("2026-11-20T00:00:00+08:00"), startTime: "10:00", endTime: "12:00" };

  const clash = await resolveSectionProctors([{ name: "BSIT-1A", proctorId: "t1" }, { name: "BSIT-1B", proctorId: "t2" }], exam);
  assert.match(clash.error, /Ben Lim already proctors IT101/);

  const later = await resolveSectionProctors([{ name: "BSIT-1A", proctorId: "t1" }, { name: "BSIT-1B", proctorId: "t2" }],
    { ...exam, startTime: "13:00", endTime: "15:00" });
  assert.equal(later.error, undefined);
  assert.equal(later.sections[1].proctorName, "Ben Lim");
});

test("a teacher sees only their own section's room and name", () => {
  const exam = { subjectCode: "CC101", room: "Main", proctorId: null, sections: [
    { name: "BSIT-1A", room: "Rm 201", proctorId: "t1", proctorName: "Ana Cruz" },
    { name: "BSIT-1B", room: "Rm 202", proctorId: "t2", proctorName: "Ben Lim" }] };
  const mine = forTeacher(exam, "t2");
  assert.equal(mine.courseSection, "BSIT-1B");
  assert.equal(mine.room, "Rm 202");
  assert.equal(mine.proctorName, "Ben Lim");
  assert.deepEqual(examProctorIds(exam), ["t1", "t2"]);
  assert.equal(forTeacher({ ...exam, sections: [] }, "t1").room, "Main", "exams without sections are unchanged");
});
