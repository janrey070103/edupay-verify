// When each term's exam permit (QR) may be generated and scanned, even if the
// term is already paid. A window is one whole calendar month, Philippine time.
//
//   1st Semester: Prelim Sep · Midterm Oct · Pre-Finals Nov · Finals Dec  (first year of the school year)
//   2nd Semester: Prelim Jan · Midterm Feb · Pre-Finals Mar · Finals Apr  (second year of the school year)
//   STI West Negros University has no Summer term.
const TERM_MONTHS = {
  "1st Semester": { yearOffset: 0, months: { Prelim: 9, Midterm: 10, PreFinal: 11, Final: 12 } },
  "2nd Semester": { yearOffset: 1, months: { Prelim: 1, Midterm: 2, PreFinal: 3, Final: 4 } },
};
const UNRESTRICTED_SEMESTERS = []; // no Summer term at STI WNU
const TERM_LABELS = { Prelim: "Prelim", Midterm: "Midterm", PreFinal: "Pre-Finals", Final: "Finals" };

const validSchoolYear = (value) => /^\d{4}-\d{4}$/.test(String(value || "")) &&
  Number(String(value).slice(5)) === Number(String(value).slice(0, 4)) + 1;
const pad = (value) => String(value).padStart(2, "0");

/**
 * The permit window for a student's term:
 *   { kind: "window", start, end }  start/end are Date objects (Manila month bounds)
 *   { kind: "anytime" }             a semester without set months (none at present)
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

// ---------------------------------------------------------------------------
// Scheduling rules: an exam is placed on a date that has not passed, and its
// term must be the one whose month that date falls in (the same months the
// permits use), so a Midterm cannot be put in the Finals month.
//   May-August: no exam period (there is no Summer term).
// ---------------------------------------------------------------------------
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];
const MONTH_TERMS = {};
Object.entries(TERM_MONTHS).forEach(([semester, config]) => Object.entries(config.months)
  .forEach(([term, month]) => { MONTH_TERMS[month] = { semester, term }; }));

const manilaParts = (value) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, month: Number(parts.month), time: `${parts.hour}:${parts.minute}` };
};
const to12h = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
};

/** The exam period a date belongs to: { kind: "term", semester, term } | { kind: "none" }. */
const examPeriodForDate = (date) => {
  const { month } = manilaParts(date);
  if (MONTH_TERMS[month]) return { kind: "term", ...MONTH_TERMS[month] };
  return { kind: "none" };
};

/**
 * Why an exam cannot be scheduled like this, or null when it can.
 * checkPast: false skips the "already passed" rules (e.g. only the term of an
 * existing exam is being corrected).
 */
const examScheduleProblem = ({ examDate, examType, startTime }, now = new Date(), { checkPast = true } = {}) => {
  const date = new Date(examDate);
  if (Number.isNaN(date.getTime())) return "Choose a valid exam date.";
  const exam = manilaParts(date);
  const today = manilaParts(now);
  if (checkPast) {
    if (exam.day < today.day) return `${phDate(date)} has already passed. Exams can only be scheduled for today or a later date.`;
    if (exam.day === today.day && startTime && startTime <= today.time) {
      return `It is already ${to12h(today.time)}, so a ${to12h(startTime)} start today has passed. Pick a later time or another day.`;
    }
  }
  const period = examPeriodForDate(date);
  const monthName = MONTH_NAMES[exam.month - 1];
  if (period.kind === "none") {
    return `${monthName} has no exam period. 1st Semester exams run September (Prelim) to December (Finals); 2nd Semester exams run January to April.`;
  }
  if (period.kind === "term" && examType && examType !== period.term) {
    const rightMonth = MONTH_NAMES[TERM_MONTHS[period.semester].months[examType] - 1];
    return `${phDate(date)} is in the ${TERM_LABELS[period.term]} period (${period.semester}, ${monthName}). ` +
      `A ${TERM_LABELS[examType] || examType} exam must be scheduled in ${rightMonth}.`;
  }
  return null;
};

/** Publishing a term date: not in the past, and inside that term's month for the semester and school year. */
const termDateProblem = ({ examDate, semester, schoolYear, examType }, now = new Date()) => {
  // Only the current school year (June to May, Philippine time) or a later one.
  const today = manilaParts(now);
  const currentStart = Number(today.day.slice(0, 4)) - (today.month >= 6 ? 0 : 1);
  if (Number(String(schoolYear).slice(0, 4)) < currentStart) {
    return `School year ${schoolYear} has already ended. Choose ${currentStart}-${currentStart + 1} or later.`;
  }
  const date = new Date(`${examDate}T00:00:00+08:00`);
  if (manilaParts(date).day < manilaParts(now).day) return `${phDate(date)} has already passed. Choose today or a later date.`;
  const window = termWindow(semester, schoolYear, examType);
  if (window.kind === "window" && (date < window.start || date > window.end)) {
    return `The ${TERM_LABELS[examType]} date for the ${semester}, ${schoolYear} must be in ` +
      `${MONTH_NAMES[manilaParts(window.start).month - 1]} ${manilaParts(window.start).day.slice(0, 4)}.`;
  }
  return null;
};

// ---------------------------------------------------------------------------
// 4-day exam period: for each term, a department's regular exams all fall in
// 4 consecutive days starting with its earliest regular exam. Special exams
// (make-ups) are only allowed after those 4 days (still in the term's month,
// which the term/month rule above enforces).
// ---------------------------------------------------------------------------
const PERIOD_DAYS = 4;
const DAY_MS = 864e5;
const dayNumber = (key) => { const [y, m, d] = key.split("-").map(Number); return Date.UTC(y, m - 1, d) / DAY_MS; };
const dayKeyFromNumber = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const keyDate = (key) => new Date(`${key}T00:00:00+08:00`);
const shortDate = (key) => keyDate(key).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
const rangeText = (period) => `${shortDate(period.start)}–${shortDate(period.end)}, ${period.end.slice(0, 4)}`;

/** The term's exam period from its regular exams' Manila day keys, or null when none is scheduled yet. */
const examPeriodWindow = (regularDays) => {
  if (!regularDays.length) return null;
  const first = Math.min(...regularDays.map(dayNumber));
  return { start: dayKeyFromNumber(first), end: dayKeyFromNumber(first + PERIOD_DAYS - 1),
    specialFrom: dayKeyFromNumber(first + PERIOD_DAYS) };
};

/**
 * Why this exam does not fit the term's 4-day period, or null when it does.
 * regularDays: Manila day keys of the department's other regular exams for the
 * same term and month (not cancelled, not this exam).
 */
const examPeriodProblem = ({ examDate, examType, examKind = "Regular" }, regularDays) => {
  const day = manilaParts(examDate).day;
  const label = TERM_LABELS[examType] || examType;
  const period = examPeriodWindow(regularDays);
  if (examKind === "Special") {
    if (!period) return `Schedule the regular ${label} exams first. Special exams can only be added after the 4-day ${label} exam period.`;
    if (day <= period.end) {
      return `Special exams can only be added after the ${label} exam period (${rangeText(period)}). Pick ${shortDate(period.specialFrom)} or later.`;
    }
    return null;
  }
  if (!period) return null; // the first regular exam starts the period
  const days = [...regularDays, day].map(dayNumber);
  if (Math.max(...days) - Math.min(...days) >= PERIOD_DAYS) {
    return `The ${label} exam period is 4 days: ${rangeText(period)}, starting with the first exam on ${shortDate(period.start)}. ` +
      `Pick a date within it, or add this as a Special exam from ${shortDate(period.specialFrom)}.`;
  }
  return null;
};

/** Manila month bounds containing a date (for finding the term's other exams). */
const manilaMonthRange = (value) => {
  const { day } = manilaParts(value);
  const [year, month] = day.split("-").map(Number);
  const start = new Date(`${year}-${pad(month)}-01T00:00:00+08:00`);
  const end = new Date(`${month === 12 ? year + 1 : year}-${pad(month === 12 ? 1 : month + 1)}-01T00:00:00+08:00`);
  return { start, end };
};

module.exports = { TERM_MONTHS, termWindow, windowState, windowProblem, describeWindow,
  examPeriodForDate, examScheduleProblem, termDateProblem,
  PERIOD_DAYS, examPeriodWindow, examPeriodProblem, manilaMonthRange };
