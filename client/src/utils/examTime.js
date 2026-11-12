// Exam time helpers shared by the scheduling form.

/** "13:30" -> "1:30 PM" */
export const to12h = (value) => {
  const [h, m] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** Schedule text from picked times, e.g. "9:00 AM – 11:00 AM". */
export const scheduleFromTimes = (start, end) => (start && end ? `${to12h(start)} – ${to12h(end)}` : "");

/** null when valid, otherwise a message. */
export const examTimeProblem = ({ timeMode, schedule, startTime, endTime }) => {
  if (timeMode === "manual") return String(schedule || "").trim() ? null : "Type the exam time.";
  if (!startTime || !endTime) return "Pick the exam's start and end time.";
  if (endTime <= startTime) return "The end time must be after the start time.";
  return null;
};
