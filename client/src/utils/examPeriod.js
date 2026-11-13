// Client copy of the server's exam scheduling rules (server/config/examWindows.js).
// The server is the authority; this lets the form explain problems up front.
//   1st Semester: Prelim Sep · Midterm Oct · Pre-Finals Nov · Finals Dec
//   2nd Semester: Prelim Jan · Midterm Feb · Pre-Finals Mar · Finals Apr
//   May-August: no exam period (there is no Summer term).
const TERM_MONTHS = {
  "1st Semester": { Prelim: 9, Midterm: 10, PreFinal: 11, Final: 12 },
  "2nd Semester": { Prelim: 1, Midterm: 2, PreFinal: 3, Final: 4 },
};
export const TERM_LABELS = { Prelim: "Prelim", Midterm: "Midterm", PreFinal: "Pre-Finals", Final: "Finals" };
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];
const MONTH_TERMS = {};
Object.entries(TERM_MONTHS).forEach(([semester, months]) => Object.entries(months)
  .forEach(([term, month]) => { MONTH_TERMS[month] = { semester, term }; }));

const manilaParts = (value) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, month: Number(parts.month), time: `${parts.hour}:${parts.minute}` };
};
const phDate = (value) => new Date(value).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
const to12h = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
};

/** A local calendar date (year, month index, day) as an instant at Manila midnight. */
export const manilaMidnight = (date) => new Date(
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T00:00:00+08:00`);

/** True when the calendar day is before today (Philippine time). */
export const isPastDay = (date, now = new Date()) => manilaParts(manilaMidnight(date)).day < manilaParts(now).day;

/** { kind: "term", semester, term, monthName } | { kind: "none", monthName } */
export const examPeriodForDate = (value) => {
  const { month } = manilaParts(value);
  const monthName = MONTH_NAMES[month - 1];
  if (MONTH_TERMS[month]) return { kind: "term", ...MONTH_TERMS[month], monthName };
  return { kind: "none", monthName };
};

/** Same messages as the server; null when the exam can be scheduled. */
export const examScheduleProblem = ({ examDate, examType, startTime }, now = new Date(), { checkPast = true } = {}) => {
  const exam = manilaParts(examDate);
  const today = manilaParts(now);
  if (checkPast) {
    if (exam.day < today.day) return `${phDate(examDate)} has already passed. Exams can only be scheduled for today or a later date.`;
    if (exam.day === today.day && startTime && startTime <= today.time) {
      return `It is already ${to12h(today.time)}, so a ${to12h(startTime)} start today has passed. Pick a later time or another day.`;
    }
  }
  const period = examPeriodForDate(examDate);
  if (period.kind === "none") {
    return `${period.monthName} has no exam period. 1st Semester exams run September (Prelim) to December (Finals); 2nd Semester exams run January to April.`;
  }
  if (period.kind === "term" && examType && examType !== period.term) {
    return `${phDate(examDate)} is in the ${TERM_LABELS[period.term]} period (${period.semester}, ${period.monthName}). ` +
      `A ${TERM_LABELS[examType] || examType} exam must be scheduled in ${MONTH_NAMES[TERM_MONTHS[period.semester][examType] - 1]}.`;
  }
  return null;
};

/** Today in Philippine time as "YYYY-MM-DD" (for date input minimums). */
export const todayKey = (now = new Date()) => manilaParts(now).day;

// ---------------------------------------------------------------------------
// 4-day exam period (same rules and messages as the server): a term's regular
// exams fall in 4 consecutive days from the earliest one; Special exams only
// after that period.
// ---------------------------------------------------------------------------
export const PERIOD_DAYS = 4;
const DAY_MS = 864e5;
const dayNumber = (key) => { const [y, m, d] = key.split("-").map(Number); return Date.UTC(y, m - 1, d) / DAY_MS; };
const dayKeyFromNumber = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const shortDate = (key) => new Date(`${key}T00:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
export const rangeText = (period) => `${shortDate(period.start)}–${shortDate(period.end)}, ${period.end.slice(0, 4)}`;
export { shortDate };

/** Manila "YYYY-MM-DD" of a date. */
export const manilaDayKey = (value) => manilaParts(value).day;

/** { start, end, specialFrom } day keys from the regular exams' day keys, or null. */
export const examPeriodWindow = (regularDays) => {
  if (!regularDays.length) return null;
  const first = Math.min(...regularDays.map(dayNumber));
  return { start: dayKeyFromNumber(first), end: dayKeyFromNumber(first + PERIOD_DAYS - 1), specialFrom: dayKeyFromNumber(first + PERIOD_DAYS) };
};

/** Day number (1-4) of a day inside a period, or 0. */
export const periodDay = (period, key) => {
  if (!period) return 0;
  const n = dayNumber(key) - dayNumber(period.start) + 1;
  return n >= 1 && n <= PERIOD_DAYS ? n : 0;
};

export const examPeriodProblem = ({ examDate, examType, examKind = "Regular" }, regularDays) => {
  const day = manilaParts(examDate).day;
  const label = TERM_LABELS[examType] || examType;
  const period = examPeriodWindow(regularDays);
  if (examKind === "Special") {
    if (!period) return `Schedule the regular ${label} exams first. Special exams can only be added after the 4-day ${label} exam period.`;
    if (day <= period.end) return `Special exams can only be added after the ${label} exam period (${rangeText(period)}). Pick ${shortDate(period.specialFrom)} or later.`;
    return null;
  }
  if (!period) return null;
  const days = [...regularDays, day].map(dayNumber);
  if (Math.max(...days) - Math.min(...days) >= PERIOD_DAYS) {
    return `The ${label} exam period is 4 days: ${rangeText(period)}, starting with the first exam on ${shortDate(period.start)}. ` +
      `Pick a date within it, or add this as a Special exam from ${shortDate(period.specialFrom)}.`;
  }
  return null;
};
