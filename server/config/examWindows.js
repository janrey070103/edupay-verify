// When each term's exam permit (QR) may be generated and scanned, even if the
// term is already paid. A window is one whole calendar month, Philippine time.
//
//   1st Semester: Prelim Aug · Midterm Sep · Pre-Finals Oct · Finals Nov  (first year of the school year)
//   2nd Semester: Prelim Jan · Midterm Feb · Pre-Finals Mar · Finals Apr  (second year of the school year)
//   Summer:       no window set; a paid term's permit is usable any time.
const TERM_MONTHS = {
  "1st Semester": { yearOffset: 0, months: { Prelim: 8, Midterm: 9, PreFinal: 10, Final: 11 } },
  "2nd Semester": { yearOffset: 1, months: { Prelim: 1, Midterm: 2, PreFinal: 3, Final: 4 } },
};
const UNRESTRICTED_SEMESTERS = ["Summer"];
const TERM_LABELS = { Prelim: "Prelim", Midterm: "Midterm", PreFinal: "Pre-Finals", Final: "Finals" };

const validSchoolYear = (value) => /^\d{4}-\d{4}$/.test(String(value || "")) &&
  Number(String(value).slice(5)) === Number(String(value).slice(0, 4)) + 1;
const pad = (value) => String(value).padStart(2, "0");

/**
 * The permit window for a student's term:
 *   { kind: "window", start, end }  start/end are Date objects (Manila month bounds)
 *   { kind: "anytime" }             e.g. Summer
 *   { kind: "unknown" }             semester or school year missing / invalid
 */
const termWindow = (semester, schoolYear, term) => {
  if (UNRESTRICTED_SEMESTERS.includes(semester)) return { kind: "anytime" };
  const config = TERM_MONTHS[semester];
  if (!config || !validSchoolYear(schoolYear) || !config.months[term]) return { kind: "unknown" };
  const year = Number(String(schoolYear).slice(0, 4)) + config.yearOffset;
  const month = config.months[term];
  const start = new Date(`${year}-${pad(month)}-01T00:00:00+08:00`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(new Date(`${nextYear}-${pad(nextMonth)}-01T00:00:00+08:00`).getTime() - 1);
  return { kind: "window", start, end };
};

/** "open" | "upcoming" | "closed" | "anytime" | "unknown" */
const windowState = (window, now = new Date()) => {
  if (window.kind !== "window") return window.kind;
  if (now < window.start) return "upcoming";
  if (now > window.end) return "closed";
  return "open";
};

const phDate = (date) => date.toLocaleDateString("en-PH", {
  timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

/** Why a permit cannot be used right now, or null when it can. */
const windowProblem = (student, term, now = new Date()) => {
  const window = termWindow(student?.semester, student?.schoolYear, term);
  const state = windowState(window, now);
  const label = TERM_LABELS[term] || term;
  if (state === "unknown") {
    return "The student's semester and school year are not set, so the exam permit period cannot be determined. Ask the Admin to update the account.";
  }
  if (state === "upcoming") return `The ${label} permit can only be used from ${phDate(window.start)} to ${phDate(window.end)}.`;
  if (state === "closed") return `The ${label} permit period ended on ${phDate(window.end)}.`;
  return null;
};

/** JSON-friendly window for API responses. */
const describeWindow = (student, term, now = new Date()) => {
  const window = termWindow(student?.semester, student?.schoolYear, term);
  return {
    state: windowState(window, now),
    start: window.start ? window.start.toISOString() : null,
    end: window.end ? window.end.toISOString() : null,
  };
};

module.exports = { TERM_MONTHS, termWindow, windowState, windowProblem, describeWindow };
