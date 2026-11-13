// Same rule as the server (server/config/schoolYear.js): June to May, Philippine
// time, and always the current school year. Shown read-only in every form.
export const currentSchoolYear = (now = new Date()) => {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" })
    .format(now).split("-").map(Number);
  const first = month >= 6 ? year : year - 1;
  return `${first}-${first + 1}`;
};
