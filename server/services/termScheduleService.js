const TermSchedule = require("../Models/TermSchedule");
const { resolveCourse } = require("../utils/adminScope");

/**
 * Term dates that apply to one student: their department's own publication
 * for each term, falling back to an older school-wide one (no department).
 */
const schedulesForStudent = async (student, examType) => {
  const course = await resolveCourse(student.course);
  const department = course?.department;
  const rows = await TermSchedule.find({
    semester: student.semester, schoolYear: student.schoolYear,
    ...(examType ? { examType } : {}),
    $or: [{ department: { $in: [null] } }, ...(department ? [{ department }] : [])],
  }).sort({ examDate: 1 });

  const byTerm = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const current = byTerm.get(row.examType);
    // A department's own date wins over the school-wide default.
    if (!current || (!current.department && row.department)) byTerm.set(row.examType, row);
  }
  return { course, schedules: [...byTerm.values()].sort((a, b) => a.examDate - b.examDate) };
};

/** Exam filter limiting a student's subjects to their own course (or course-less exams). */
const examCourseFilter = (course) => (course
  ? { $or: [{ course: course.code }, { course: { $in: [null, ""] } }] }
  : { course: { $in: [null, ""] } });

module.exports = { schedulesForStudent, examCourseFilter };
