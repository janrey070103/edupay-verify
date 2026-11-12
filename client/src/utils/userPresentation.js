export const sortUsersByName = (users, direction = "asc") => [...users].sort((a, b) =>
  (a.name || "").localeCompare(b.name || "", "en", { sensitivity: "base" }) *
  (direction === "desc" ? -1 : 1));

export const formatCreatedPH = (value) => value ? new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
}).format(new Date(value)) : "Unknown";

// "Dela Cruz, Juan Santos". Accounts created before separate name fields
// existed have only `name`, which is shown unchanged.
export const formatLastFirst = (user) => {
  if (!user) return "";
  const last = (user.lastName || "").trim();
  const given = [user.firstName, user.middleName].map((part) => (part || "").trim()).filter(Boolean).join(" ");
  if (last && given) return `${last}, ${given}`;
  return last || given || user.name || "";
};

// Best guess for editing an older single-field name: last word = surname.
// The admin reviews it in the form before saving.
export const splitLegacyName = (name = "") => {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { firstName: words[0] || "", middleName: "", lastName: "" };
  return { firstName: words.slice(0, -1).join(" "), middleName: "", lastName: words[words.length - 1] };
};
