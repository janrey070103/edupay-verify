const test = require("node:test");
const assert = require("node:assert/strict");
const { currentSchoolYear } = require("../config/schoolYear");

test("the school year is the current one (June to May, Philippine time)", () => {
  assert.equal(currentSchoolYear(new Date("2026-11-13T02:00:00Z")), "2026-2027");
  assert.equal(currentSchoolYear(new Date("2027-05-31T15:59:00Z")), "2026-2027", "May 31, 11:59 PM Manila");
  assert.equal(currentSchoolYear(new Date("2027-05-31T16:00:00Z")), "2027-2028", "June 1, 12:00 AM Manila");
  assert.equal(currentSchoolYear(new Date("2027-01-10T02:00:00Z")), "2026-2027", "2nd Semester is still the same school year");
});
