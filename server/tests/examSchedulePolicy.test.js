const test = require("node:test");
const assert = require("node:assert/strict");
const { examScheduleProblem, examPeriodForDate, termDateProblem } = require("../config/examWindows");

// Nov 13, 2026, 10:00 AM Manila (Pre-Finals month of the 1st Semester).
//   1st Semester: Prelim Sep · Midterm Oct · Pre-Finals Nov · Finals Dec
//   2nd Semester: Prelim Jan · Midterm Feb · Pre-Finals Mar · Finals Apr
const NOW = new Date("2026-11-13T02:00:00Z");
const manila = (day, time = "00:00") => new Date(`${day}T${time}:00+08:00`);

test("a past date cannot be scheduled; today and later can", () => {
  assert.match(examScheduleProblem({ examDate: manila("2026-11-12"), examType: "PreFinal" }, NOW), /already passed/);
  assert.equal(examScheduleProblem({ examDate: manila("2026-11-13"), examType: "PreFinal" }, NOW), null);
  assert.equal(examScheduleProblem({ examDate: manila("2026-11-20"), examType: "PreFinal" }, NOW), null);
});

test("today: a start time that has already passed is refused", () => {
  assert.match(examScheduleProblem({ examDate: manila("2026-11-13"), examType: "PreFinal", startTime: "09:30" }, NOW),
    /9:30 AM start today has passed/);
  assert.match(examScheduleProblem({ examDate: manila("2026-11-13"), examType: "PreFinal", startTime: "10:00" }, NOW), /has passed/);
  assert.equal(examScheduleProblem({ examDate: manila("2026-11-13"), examType: "PreFinal", startTime: "13:00" }, NOW), null);
  assert.equal(examScheduleProblem({ examDate: manila("2026-11-14"), examType: "PreFinal", startTime: "07:00" }, NOW), null);
});

test("the term must match the month: Prelim Sep, Midterm Oct, Pre-Finals Nov, Finals Dec", () => {
  const problem = examScheduleProblem({ examDate: manila("2026-11-20"), examType: "Midterm" }, NOW);
  assert.match(problem, /Pre-Finals period \(1st Semester, November\)/);
  assert.match(problem, /Midterm exam must be scheduled in October/);
  assert.equal(examScheduleProblem({ examDate: manila("2026-12-10"), examType: "Final" }, NOW), null, "Finals in December");
  assert.match(examScheduleProblem({ examDate: manila("2026-12-10"), examType: "PreFinal" }, NOW), /Finals period \(1st Semester, December\)/);
  assert.match(examScheduleProblem({ examDate: manila("2027-01-15"), examType: "Final" }, NOW), /Prelim period \(2nd Semester, January\).*April/);
  assert.equal(examScheduleProblem({ examDate: manila("2027-02-10"), examType: "Midterm" }, NOW), null);
});

test("May to August have no exam period (no Summer term)", () => {
  assert.match(examScheduleProblem({ examDate: manila("2027-08-05"), examType: "Prelim" }, NOW),
    /August has no exam period\. 1st Semester exams run September \(Prelim\) to December \(Finals\)/);
  assert.match(examScheduleProblem({ examDate: manila("2027-06-10"), examType: "Midterm" }, NOW), /June has no exam period/);
  assert.deepEqual(examPeriodForDate(manila("2027-05-10")), { kind: "none" });
  assert.deepEqual(examPeriodForDate(manila("2026-09-01")), { kind: "term", semester: "1st Semester", term: "Prelim" });
  assert.deepEqual(examPeriodForDate(manila("2026-12-01")), { kind: "term", semester: "1st Semester", term: "Final" });
});

test("month boundaries use Philippine time", () => {
  // Nov 30, 11:30 PM Manila is still Pre-Finals; Dec 1, 12:30 AM Manila (Nov 30 in UTC) is Finals.
  assert.equal(examPeriodForDate(manila("2026-11-30", "23:30")).term, "PreFinal");
  assert.equal(examPeriodForDate(manila("2026-12-01", "00:30")).term, "Final");
});

test("checkPast: false allows correcting the term of a past exam", () => {
  assert.equal(examScheduleProblem({ examDate: manila("2026-11-02"), examType: "PreFinal" }, NOW, { checkPast: false }), null);
  assert.match(examScheduleProblem({ examDate: manila("2026-11-02"), examType: "Prelim" }, NOW, { checkPast: false }), /Pre-Finals period/);
});

test("publishing a term date: not past, and inside that term's month", () => {
  const base = { semester: "1st Semester", schoolYear: "2026-2027" };
  assert.match(termDateProblem({ ...base, examType: "PreFinal", examDate: "2026-11-10" }, NOW), /already passed/);
  assert.equal(termDateProblem({ ...base, examType: "PreFinal", examDate: "2026-11-20" }, NOW), null);
  assert.equal(termDateProblem({ ...base, examType: "Final", examDate: "2026-12-14" }, NOW), null);
  assert.match(termDateProblem({ ...base, examType: "Midterm", examDate: "2026-11-20" }, NOW), /Midterm date .* must be in October 2026/);
  assert.equal(termDateProblem({ ...base, semester: "2nd Semester", examType: "Prelim", examDate: "2027-01-12" }, NOW), null);
  assert.match(termDateProblem({ ...base, schoolYear: "2025-2026", examType: "PreFinal", examDate: "2026-11-20" }, NOW),
    /School year 2025-2026 has already ended. Choose 2026-2027 or later/);
  assert.match(termDateProblem({ ...base, semester: "2nd Semester", examType: "Final", examDate: "2027-03-20" }, NOW), /Finals date .* must be in April 2027/);
});
