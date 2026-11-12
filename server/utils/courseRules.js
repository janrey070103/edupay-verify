const { findCourse } = require("../services/catalogService");

/**
 * Returns an error message when a course is not acceptable for a student, or
 * null when it is: it must be an active catalogue course.
 */
const courseProblem = async (courseCode) => {
  const course = await findCourse(String(courseCode || "").trim());
  if (!course || course.active === false) return "Choose a course from the list.";
  return null;
};

module.exports = { courseProblem };
