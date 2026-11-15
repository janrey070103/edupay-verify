// Names are stored as separate parts; `name` stays as the derived full name
// ("First Middle Last Ext.") because payments, notifications and permits copy it.
//
// Rules (the client applies the same ones in client/src/utils/studentIdentity.js):
// - every word of a name starts with a capital, the rest is lowercase ("Dela Cruz");
// - the middle name is optional but must be the full name, never an initial;
// - the extension is Jr., Sr., III, IV, V, VI or another suffix in that format;
// - a student ID is 2-4-3 digits (12-3456-789);
// - a student's email is lastname + extension + "." + ID without its first
//   3 digits + "@wnu.sti.edu.ph" (santosjr.456789@wnu.sti.edu.ph).

const NAME_FIELDS = ["firstName", "middleName", "lastName", "nameExtension"];
const STUDENT_ID_PATTERN = /^\d{2}-\d{4}-\d{3}$/;
const STUDENT_EMAIL_DOMAIN = "wnu.sti.edu.ph";
const ROMAN = /^(X{0,3})(IX|IV|V?I{0,3})$/;

const formatName = (value, { allowPeriod = false } = {}) => String(value ?? "")
  .replace(allowPeriod ? /[^\p{L}\s'.-]/gu : /[^\p{L}\s'-]/gu, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 60)
  .toLowerCase()
  .replace(/(^|[\s-])(\p{L})/gu, (match, before, letter) => before + letter.toUpperCase());

const formatExtension = (value) => {
  const letters = String(value ?? "").replace(/[^\p{L}]/gu, "").slice(0, 6);
  if (!letters) return "";
  if (ROMAN.test(letters.toUpperCase())) return letters.toUpperCase();
  return `${letters.charAt(0).toUpperCase()}${letters.slice(1).toLowerCase()}.`;
};

const hasNameParts = (body = {}) => NAME_FIELDS.some((field) => body[field] !== undefined);

const readNameParts = (body = {}, fallback = {}) => {
  const pick = (field) => (body[field] !== undefined ? body[field] : fallback[field]);
  return {
    firstName: formatName(pick("firstName"), { allowPeriod: true }),
    middleName: formatName(pick("middleName")),
    lastName: formatName(pick("lastName")),
    nameExtension: formatExtension(pick("nameExtension")),
  };
};

const validNameParts = ({ firstName, lastName }) => Boolean(firstName && lastName);

const middleNameProblem = (value) => {
  const name = String(value ?? "").trim();
  if (!name) return "";
  return /\./.test(name) || name.split(/[\s-]+/).some((word) => word.replace(/'/g, "").length < 2)
    ? "Enter the full middle name, not an initial (e.g. Santos, not S.)." : "";
};

const extensionProblem = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return (ROMAN.test(text) && text !== "I") || /^[A-Z][a-z]{1,3}\.$/.test(text)
    ? "" : "Use a name extension like Jr., Sr., III or IV.";
};

/**
 * Problems with name parts that were sent. Values equal to `previous`
 * (already stored on an older account) are not re-checked.
 */
const nameProblem = (parts, previous = {}) => {
  if (!validNameParts(parts)) return "Last name and first name are required.";
  if (parts.middleName !== (previous.middleName || "")) {
    const problem = middleNameProblem(parts.middleName);
    if (problem) return problem;
  }
  return extensionProblem(parts.nameExtension);
};

const fullName = ({ firstName, middleName, lastName, nameExtension }) =>
  [firstName, middleName, lastName, nameExtension].filter(Boolean).join(" ");

const emailPart = (value) => String(value ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z]/g, "");

const validStudentId = (value) => STUDENT_ID_PATTERN.test(String(value ?? ""));

const studentEmail = ({ lastName, nameExtension, studentId }) => {
  const last = emailPart(lastName);
  if (!last || !validStudentId(studentId)) return "";
  return `${last}${emailPart(nameExtension)}.${String(studentId).replace(/\D/g, "").slice(3)}@${STUDENT_EMAIL_DOMAIN}`;
};

module.exports = {
  NAME_FIELDS, STUDENT_ID_PATTERN, STUDENT_EMAIL_DOMAIN,
  hasNameParts, readNameParts, validNameParts, nameProblem, middleNameProblem, extensionProblem,
  formatName, formatExtension, fullName, validStudentId, studentEmail,
};
