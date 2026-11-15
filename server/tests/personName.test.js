const test = require("node:test");
const assert = require("node:assert/strict");
const { readNameParts, nameProblem, fullName, validStudentId, studentEmail } = require("../utils/personName");

test("names are capitalised word by word", () => {
  const parts = readNameParts({ lastName: "dELA cruz", firstName: "ma. clARA", middleName: "santos-REYES", nameExtension: "jr" });
  assert.deepEqual(parts, { lastName: "Dela Cruz", firstName: "Ma. Clara", middleName: "Santos-Reyes", nameExtension: "Jr." });
  assert.equal(fullName(parts), "Ma. Clara Santos-Reyes Dela Cruz Jr.");
});

test("middle name must be full, never an initial; blank is allowed", () => {
  const base = { firstName: "Juan", lastName: "Santos" };
  assert.equal(nameProblem(readNameParts({ ...base })), "");
  assert.equal(nameProblem(readNameParts({ ...base, middleName: "Santos" })), "");
  assert.match(nameProblem(readNameParts({ ...base, middleName: "S." })), /not an initial/);
  assert.match(nameProblem(readNameParts({ ...base, middleName: "S" })), /not an initial/);
  // A stored initial on an older account is not re-checked when another field changes.
  assert.equal(nameProblem(readNameParts({ ...base, middleName: "S" }), { middleName: "S" }), "");
});

test("extensions follow the Jr. / III format", () => {
  const ext = (value) => readNameParts({ firstName: "A", lastName: "B", nameExtension: value }).nameExtension;
  assert.equal(ext("sr."), "Sr.");
  assert.equal(ext("iii"), "III");
  assert.equal(ext("vi"), "VI");
  assert.equal(ext("ii"), "II");
  assert.equal(ext(""), "");
  assert.match(nameProblem({ firstName: "A", lastName: "B", nameExtension: "Junior." }), /extension/);
  assert.match(nameProblem({ firstName: "A", lastName: "B", nameExtension: "I" }), /extension/);
});

test("student ID format and institutional email", () => {
  assert.equal(validStudentId("12-3456-789"), true);
  assert.equal(validStudentId("123456789"), false);
  assert.equal(validStudentId("2024-00123"), false);
  assert.equal(studentEmail({ lastName: "Santos", nameExtension: "Jr.", studentId: "12-3456-789" }), "santosjr.456789@wnu.sti.edu.ph");
  assert.equal(studentEmail({ lastName: "Dela Cruz", studentId: "12-3456-789" }), "delacruz.456789@wnu.sti.edu.ph");
  assert.equal(studentEmail({ lastName: "Peña", nameExtension: "III", studentId: "22-0989-552" }), "penaiii.989552@wnu.sti.edu.ph");
  assert.equal(studentEmail({ lastName: "Santos", studentId: "12-3456" }), "");
});
