// Date helpers for the exam calendars (Philippine time).
export const dayKey = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(value));

export const fmt = (value, options) => (value
  ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", ...options }).format(new Date(value)) : "—");

/** First day of the month to open on: the next exam's month, else the latest, else today. */
export const initialMonth = (events, today = dayKey(new Date())) => {
  const next = events.find((event) => dayKey(event.examDate) >= today) || events[events.length - 1];
  const base = next ? new Date(`${dayKey(next.examDate)}T00:00:00`) : new Date();
  return new Date(base.getFullYear(), base.getMonth(), 1);
};

/** Day keys ("YYYY-MM-DD") for a month grid, with nulls padding the first week. */
export const monthCells = (month) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const pad = (n) => String(n).padStart(2, "0");
  return [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) =>
    `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(i + 1)}`)];
};

export const timeRange = (event) => (event.startTime && event.endTime ? `${event.startTime} – ${event.endTime}` : event.schedule || "—");
export const yearLabel = (n) => (n ? `${({ 1: "1st", 2: "2nd", 3: "3rd" })[Number(n)] || `${n}th`} year` : "All years");
export const TERM_LABELS = { Prelim: "Prelim", Midterm: "Midterm", PreFinal: "Pre-Finals", Final: "Finals" };
