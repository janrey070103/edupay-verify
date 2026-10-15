export const sortUsersByName = (users, direction = "asc") => [...users].sort((a, b) =>
  (a.name || "").localeCompare(b.name || "", "en", { sensitivity: "base" }) *
  (direction === "desc" ? -1 : 1));

export const formatCreatedPH = (value) => value ? new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
}).format(new Date(value)) : "Unknown";
