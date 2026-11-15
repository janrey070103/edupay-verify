import test from "node:test";
import assert from "node:assert/strict";
import {
  extensionProblem, formatExtension, formatName, formatNameInput, formatStudentId, middleNameProblem, studentEmail,
} from "../src/utils/studentIdentity.js";

test("student ID gets its dashes while typing", () => {
  assert.equal(formatStudentId("23"), "23");
  assert.equal(formatStudentId("231"), "23-1");
  assert.equal(formatStudentId("123456"), "12-3456");
  assert.equal(formatStudentId("1234567"), "12-3456-7");
  assert.equal(formatStudentId("12-3456-789999"), "12-3456-789");
  assert.equal(formatStudentId("ab12 34x56789"), "12-3456-789");
});

test("names: every word capitalised, digits and symbols removed", () => {
  assert.equal(formatNameInput("dELA cruz"), "Dela Cruz");
  assert.equal(formatNameInput("juan "), "Juan ", "trailing space kept while typing");
  assert.equal(formatName("  santos-REYES2 "), "Santos-Reyes");
  assert.equal(formatName("ma. clara", { allowPeriod: true }), "Ma. Clara");
  assert.equal(formatName("ma. clara"), "Ma Clara");
});

test("middle name: full name or blank, never an initial", () => {
  assert.equal(middleNameProblem(""), "");
  assert.equal(middleNameProblem("Santos"), "");
  assert.equal(middleNameProblem("De Los Santos"), "");
  assert.match(middleNameProblem("S."), /not an initial/);
  assert.match(middleNameProblem("S"), /not an initial/);
});

test("extensions", () => {
  assert.equal(formatExtension("jr"), "Jr.");
  assert.equal(formatExtension("SR."), "Sr.");
  assert.equal(formatExtension("iii"), "III");
  assert.equal(formatExtension("ii"), "II");
  assert.equal(extensionProblem("Jr."), "");
  assert.equal(extensionProblem("VI"), "");
  assert.match(extensionProblem("I"), /extension/);
  assert.match(extensionProblem("Junior."), /extension/);
});

test("institutional email", () => {
  assert.equal(studentEmail({ lastName: "Santos", nameExtension: "Jr.", studentId: "12-3456-789" }), "santosjr.456789@wnu.sti.edu.ph");
  assert.equal(studentEmail({ lastName: "Dela Cruz", nameExtension: "", studentId: "12-3456-789" }), "delacruz.456789@wnu.sti.edu.ph");
  assert.equal(studentEmail({ lastName: "Santos", studentId: "12-3456-7" }), "", "empty until the ID is complete");
});
