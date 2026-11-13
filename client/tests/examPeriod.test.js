import test from "node:test";
import assert from "node:assert/strict";
import { examPeriodForDate, examScheduleProblem } from "../src/utils/examPeriod.js";

// Nov 13, 2026, 10:00 AM Manila (Pre-Finals month).
const NOW = new Date("2026-11-13T02:00:00Z");
const manila = (day, time = "00:00") => new Date(`${day}T${time}:00+08:00`);

test("client rules match the server: past dates, passed start times, and term months", () => {
  assert.match(examScheduleProblem({ examDate: manila("2026-11-12"), examType: "PreFinal" }, NOW), /already passed/);
  assert.match(examScheduleProblem({ examDate: manila("2026-11-13"), examType: "PreFinal", startTime: "09:00" }, NOW), /9:00 AM start today has passed/);
  assert.equal(examScheduleProblem({ examDate: manila("2026-11-13"), examType: "PreFinal", startTime: "14:00" }, NOW), null);
  assert.match(examScheduleProblem({ examDate: manila("2026-11-20"), examType: "Midterm" }, NOW),
    /Pre-Finals period \(1st Semester, November\)\. A Midterm exam must be scheduled in October/);
  assert.equal(examScheduleProblem({ examDate: manila("2026-12-03"), examType: "Final" }, NOW), null);
  assert.match(examScheduleProblem({ examDate: manila("2027-08-03"), examType: "Prelim" }, NOW), /August has no exam period/);
  assert.match(examScheduleProblem({ examDate: manila("2027-06-03"), examType: "Prelim" }, NOW), /June has no exam period/);
});

test("periods by month", () => {
  assert.equal(examPeriodForDate(manila("2026-09-10")).term, "Prelim");
  assert.equal(examPeriodForDate(manila("2026-12-10")).term, "Final");
  assert.equal(examPeriodForDate(manila("2027-03-10")).term, "PreFinal");
  assert.equal(examPeriodForDate(manila("2027-03-10")).semester, "2nd Semester");
  assert.equal(examPeriodForDate(manila("2027-07-10")).kind, "none", "no Summer term");
  assert.equal(examPeriodForDate(manila("2026-08-10")).kind, "none");
});
