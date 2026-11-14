const Exam = require("../Models/Exam");
const ExamPermit = require("../Models/ExamPermit");
const User = require("../Models/User");
const { resolveCourse } = require("../utils/adminScope");
const { forTeacher, proctoredBy } = require("../services/examSections");

const manilaDay = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const validSchoolYear = (value) => /^\d{4}-\d{4}$/.test(String(value || "")) &&
  Number(String(value).slice(5)) === Number(String(value).slice(0, 4)) + 1;

/** School-year bounds (June 1 to May 31); a rolling year when not set. */
const schoolYearRange = (schoolYear, now = new Date()) => {
  if (validSchoolYear(schoolYear)) {
    const first = Number(String(schoolYear).slice(0, 4));
    return { from: new Date(`${first}-06-01T00:00:00+08:00`), to: new Date(`${first + 1}-06-01T00:00:00+08:00`) };
  }
  return { from: new Date(now.getTime() - 300 * 864e5), to: new Date(now.getTime() + 200 * 864e5) };
};

/**
 * Calendar status of one exam for one student:
 * verified (permit scanned by the proctor) | cancelled | upcoming | today | missed.
 */
const examStatus = (exam, verification, now = new Date()) => {
  if (verification) return "verified";
  if (exam.status === "Cancelled") return "cancelled";
  const day = manilaDay(exam.examDate);
  const today = manilaDay(now);
  if (day > today) return "upcoming";
  if (day === today) return "today";
  return "missed";
};

// GET /api/exams/student/calendar: the student's own exams (their course and
// year level) for the school year, with verification details for each.
const getMyExamCalendar = async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select("studentId name course yearLevel semester schoolYear");
    if (!student) return res.status(404).json({ message: "Student not found." });
    const course = await resolveCourse(student.course);
    const profile = { studentId: student.studentId, name: student.name, course: course?.code || student.course || null,
      courseName: course?.name || null, yearLevel: student.yearLevel || null,
      semester: student.semester || null, schoolYear: student.schoolYear || null };
    if (!course) {
      return res.json({ student: profile, events: [],
        message: "Your course is not in the official course list yet, so your exams cannot be shown. Ask the Admin to correct it." });
    }

    const { from, to } = schoolYearRange(student.schoolYear);
    const [exams, permits] = await Promise.all([
      Exam.find({ course: course.code, examDate: { $gte: from, $lt: to },
        $or: [{ courseYear: student.yearLevel }, { courseYear: null }, { courseYear: { $exists: false } }] })
        .select("subject subjectCode examType examKind examDate schedule startTime endTime room proctorName status courseYear course sections.name sections.room sections.proctorName")
        .sort({ examDate: 1 }).lean(),
      ExamPermit.find({ studentId: student.studentId }).select("examType scans permitStatus").lean(),
    ]);

    const verifications = new Map();
    permits.forEach((permit) => (permit.scans || []).forEach((scan) => {
      if (scan.examId && scan.action === "Verified") {
        verifications.set(String(scan.examId), { verifiedAt: scan.scannedAt, verifiedBy: scan.teacherName || "Proctor",
          room: scan.room || null, permitId: permit._id });
      }
    }));

    const now = new Date();
    const events = exams.map((exam) => {
      const verification = verifications.get(String(exam._id)) || null;
      return { ...exam, status: examStatus(exam, verification, now), examStatus: exam.status, verification };
    });
    return res.json({ student: profile, events });
  } catch (error) {
    return res.status(500).json({ message: "Could not load your exams." });
  }
};

/** Teacher calendar status: cancelled | today | upcoming | finished. */
const proctorStatus = (exam, now = new Date()) => {
  if (exam.status === "Cancelled") return "cancelled";
  const day = manilaDay(exam.examDate);
  const today = manilaDay(now);
  if (day === today) return "today";
  return day > today ? "upcoming" : "finished";
};

// GET /api/exams/teacher/calendar: the exams this teacher proctors, each with
// the students whose permits were verified for it (and when) and the room capacity.
const getTeacherExamCalendar = async (req, res) => {
  try {
    const exams = (await Exam.find(proctoredBy(req.user.id))
      .select("subject subjectCode examType examKind examDate schedule startTime endTime room capacity status course courseYear courseSection proctorName sections")
      .sort({ examDate: 1 }).lean())
      // A section proctor sees their own section's room and name.
      .map((exam) => { const { sections, ...rest } = forTeacher(exam, req.user.id); return rest; });
    const ids = exams.map((exam) => exam._id);
    const verified = ids.length ? await ExamPermit.aggregate([
      { $match: { "scans.examId": { $in: ids } } },
      { $unwind: "$scans" },
      { $match: { "scans.examId": { $in: ids }, "scans.action": "Verified" } },
      { $project: { _id: 0, examId: "$scans.examId", studentId: 1, studentName: 1,
        verifiedAt: "$scans.scannedAt", verifiedBy: "$scans.teacherName" } },
      { $sort: { verifiedAt: 1 } },
    ]) : [];
    const byExam = new Map();
    verified.forEach((row) => byExam.set(String(row.examId), [...(byExam.get(String(row.examId)) || []), row]));

    const now = new Date();
    const events = exams.map((exam) => {
      const students = byExam.get(String(exam._id)) || [];
      return { ...exam, status: proctorStatus(exam, now), examStatus: exam.status,
        verifiedCount: students.length, capacity: exam.capacity || null, verifiedStudents: students };
    });
    const teacher = await User.findById(req.user.id).select("name").lean();
    return res.json({ teacher: { name: teacher?.name || "Teacher" }, events });
  } catch (error) {
    return res.status(500).json({ message: "Could not load your exams." });
  }
};

module.exports = { getMyExamCalendar, getTeacherExamCalendar, examStatus, proctorStatus, schoolYearRange };
