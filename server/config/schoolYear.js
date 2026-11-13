// The school year runs June to May (Philippine time) and is always the current
// one: students, accounts and published term dates cannot use another year.
const currentSchoolYear = (now = new Date()) => {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" })
    .format(now).split("-").map(Number);
  const first = month >= 6 ? year : year - 1;
  return `${first}-${first + 1}`;
};

module.exports = { currentSchoolYear };
