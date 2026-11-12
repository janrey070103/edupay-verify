// Wording for exam-permit windows returned by the server
// ({ state: "open" | "upcoming" | "closed" | "anytime" | "unknown", start, end }).
const fmt = (value, withYear = true) => new Date(value).toLocaleDateString("en-PH", {
  timeZone: "Asia/Manila", month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });

/** "Aug 1 – Aug 31, 2026" */
export const windowRange = (window) => (window?.start && window?.end
  ? `${fmt(window.start, false)} – ${fmt(window.end)}` : "");

/** Short text for a term: when its QR can be used. */
export const windowSummary = (window) => {
  switch (window?.state) {
    case "open": return `QR usable now until ${fmt(window.end)}`;
    case "upcoming": return `QR usable ${windowRange(window)}`;
    case "closed": return `QR period ended ${fmt(window.end)}`;
    case "anytime": return "QR usable once paid (no set month)";
    case "unknown": return "Semester not set – ask the Admin";
    default: return "";
  }
};

/** True when a QR may be generated right now. */
export const windowOpen = (window) => ["open", "anytime"].includes(window?.state);

export const opensOn = (window) => (window?.start ? fmt(window.start, false) : "");
