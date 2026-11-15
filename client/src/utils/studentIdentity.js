// Student identity rules shared by Sign-up and User Management.
// The server applies the same rules (server/utils/personName.js).
//
// - Student ID: 2-4-3 digits, e.g. 12-3456-789 (dashes are added automatically).
// - Names: every word starts with a capital, the rest is lowercase ("Dela Cruz").
// - Middle name: optional, but must be the full name, never an initial ("A.").
// - Extension: Jr., Sr., III, IV, V, VI, or another suffix in the same format.
// - Student email: lastname + extension + "." + ID without its first 3 digits
//   + "@wnu.sti.edu.ph", e.g. Santos Jr. / 12-3456-789 -> santosjr.456789@wnu.sti.edu.ph

export const STUDENT_ID_PATTERN = /^\d{2}-\d{4}-\d{3}$/;
export const STUDENT_EMAIL_DOMAIN = "wnu.sti.edu.ph";
export const NAME_EXTENSIONS = ["Jr.", "Sr.", "III", "IV", "V", "VI"];

/** Keeps digits only and inserts the dashes: "123456789" -> "12-3456-789". */
export const formatStudentId = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 9);
  return [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6)].filter(Boolean).join("-");
};

/**
 * Formats a name while it is typed: only letters, spaces, hyphens and
 * apostrophes (plus periods when allowed, e.g. "Ma."), one space between words,
 * and every word capitalised. Trailing space is kept so the next word can be typed.
 */
export const formatNameInput = (value, { allowPeriod = false } = {}) => {
  const allowed = allowPeriod ? /[^\p{L}\s'.-]/gu : /[^\p{L}\s'-]/gu;
  return String(value ?? "")
    .replace(allowed, "")
    .replace(/\s+/g, " ")
    .replace(/^\s+/, "")
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (match, before, letter) => before + letter.toUpperCase());
};

/** Final form of a name part (no trailing space). */
export const formatName = (value, options) => formatNameInput(value, options).trim();

/** Returns an error message when the middle name is an initial; blank is allowed. */
export const middleNameProblem = (value) => {
  const name = String(value ?? "").trim();
  if (!name) return "";
  if (/\./.test(name) || name.split(/[\s-]+/).some((word) => word.replace(/'/g, "").length < 2)) {
    return "Enter your full middle name, not an initial (e.g. Santos, not S.).";
  }
  return "";
};

const ROMAN = /^(X{0,3})(IX|IV|V?I{0,3})$/;

/** "jr" -> "Jr.", "iii" -> "III", "sr." -> "Sr.". */
export const formatExtension = (value) => {
  const text = String(value ?? "").replace(/[^\p{L}.]/gu, "");
  if (!text) return "";
  const letters = text.replace(/\./g, "");
  if (!letters) return "";
  if (ROMAN.test(letters.toUpperCase())) return letters.toUpperCase();
  return `${letters.charAt(0).toUpperCase()}${letters.slice(1).toLowerCase()}.`;
};

/** Returns an error message when the extension is not a valid suffix. */
export const extensionProblem = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const roman = ROMAN.test(text) && text !== "I";
  const abbreviation = /^[A-Z][a-z]{1,3}\.$/.test(text);
  return roman || abbreviation ? "" : "Use a name extension like Jr., Sr., III or IV.";
};

const emailPart = (value) => String(value ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z]/g, "");

/** Builds the institutional email; empty until the last name and full ID are known. */
export const studentEmail = ({ lastName, nameExtension, studentId }) => {
  const last = emailPart(lastName);
  const digits = String(studentId ?? "").replace(/\D/g, "");
  if (!last || !STUDENT_ID_PATTERN.test(String(studentId ?? ""))) return "";
  return `${last}${emailPart(nameExtension)}.${digits.slice(3)}@${STUDENT_EMAIL_DOMAIN}`;
};
