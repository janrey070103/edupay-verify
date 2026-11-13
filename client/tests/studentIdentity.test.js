import test from "node:test";
import assert from "node:assert/strict";
import {
  extensionProblem, formatExtension, formatName, formatNameInput, formatStudentId, middleNameProblem, studentEmail,
} from "../src/utils/studentIdentity.js";

test("student ID gets its dashes while typing", () => {
  assert.equal(formatStudentId("23"), "23");
  assert.equal(formatStudentId("231"), "23-1");
  assert.equal(formatStudentId("231681"), "23-1681");
  assert.equal(formatStudentId("2316814"), "23-1681-4");
  assert.equal(formatStudentId("23-1681-428999"), "23-1681-428");
  assert.equal(formatStudentId("ab23 16x81428"), "23-1681-428");
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
  assert.equal(studentEmail({ lastName: "Varca", nameExtension: "Jr.", studentId: "23-1681-428" }), "varcajr.681428@wnu.sti.edu.ph");
  assert.equal(studentEmail({ lastName: "Dela Cruz", nameExtension: "", studentId: "23-1681-428" }), "delacruz.681428@wnu.sti.edu.ph");
  assert.equal(studentEmail({ lastName: "Varca", studentId: "23-1681-4" }), "", "empty until the ID is complete");
});
