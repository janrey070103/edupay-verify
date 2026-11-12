const { allCourses } = require("../services/catalogService");

// An Admin works on exactly one department and only ever sees records whose
// course belongs to it. Older typed course values are matched leniently
// ("BPED", "bped", "B.P.Ed" all mean BPEd); values that match no catalogue
// course are not shown to any Admin. The Super Admin corrects those in User
// Management, after which they reach the right department.
const MATCH_NOTHING = { _id: { $exists: false } };

const normalizeCode = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// Case-insensitive pattern that tolerates spaces, dots and dashes between letters.
const codePattern = (code) => {
  const letters = normalizeCode(code).split("");
  return new RegExp(`^[\\s.\\-]*${letters.join("[\\s.\\-]*")}[\\s.\\-]*$`, "i");
};

const scopeCodes = async (department) => {
  const courses = await allCourses();
  return {
    mine: courses.filter((course) => course.department === department).map((course) => course.code),
    known: courses.map((course) => course.code),
  };
};

/** The catalogue course a stored value refers to (lenient match), or null. */
const resolveCourse = async (value) => {
  const key = normalizeCode(value);
  if (!key) return null;
  return (await allCourses()).find((course) => normalizeCode(course.code) === key) || null;
};

/** Patterns matching any catalogue course, for "course not in list" queries. */
const allCoursePatterns = async () => (await allCourses()).map((course) => codePattern(course.code));

/**
 * Mongo filter limiting a query to the requesting Admin's department.
 * `includeUnassigned` also lets through records with no course at all; used for
 * exams created before courses existed, so an Admin can assign one.
 */
const courseScope = async (req, field = "course", { includeUnassigned = false } = {}) => {
  if (req.user?.role !== "admin") return {};
  if (!req.user.department) return MATCH_NOTHING;
  const { mine } = await scopeCodes(req.user.department);
  const own = { [field]: { $in: mine.map(codePattern) } };
  return includeUnassigned ? { $or: [own, { [field]: { $in: [null, ""] } }] } : own;
};

/** True when one record's course is within the Admin's department. */
const inScope = async (req, course, { includeUnassigned = false } = {}) => {
  if (req.user?.role !== "admin") return true;
  if (!req.user.department) return false;
  if (!course) return includeUnassigned;
  const resolved = await resolveCourse(course);
  return Boolean(resolved && resolved.department === req.user.department);
};

/** True when the course code is an active course of the Admin's own department. */
const ownsCourse = async (req, course) => {
  const courses = await allCourses();
  return courses.some((item) => item.code === course && item.department === req.user?.department && item.active);
};

const isCatalogued = async (course) => Boolean(await resolveCourse(course));

module.exports = {
  courseScope, inScope, ownsCourse, isCatalogued, scopeCodes, resolveCourse, allCoursePatterns, normalizeCode, codePattern,
};
