const TermSchedule = require("../Models/TermSchedule");
const Exam = require("../Models/Exam");
const User = require("../Models/User");
const Notification = require("../Models/Notification");
const mongoose = require("mongoose");
const { DEPARTMENTS } = require("../config/catalog");
const { courseScope } = require("../utils/adminScope");
const { termDateProblem } = require("../config/examWindows");
const { currentSchoolYear } = require("../config/schoolYear");
const { schedulesForStudent, examCourseFilter } = require("../services/termScheduleService");

const manilaDay = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));
const phDate = (date) => date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" });

const validYear = (value) => /^\d{4}-\d{4}$/.test(value) && Number(value.slice(5)) === Number(value.slice(0, 4)) + 1;
const validSemester = (value) => ["1st Semester", "2nd Semester"].includes(value);
const ALREADY = "Your department has already published this term for the semester and school year.";

// An Admin publishes a term date for their own department only; only that
// department's students are notified. Each department picks its own date.
const publish = async (req, res) => {
  let session;
  try {
    const department = req.user.department;
    if (!department) return res.status(403).json({ message: "Your account has no department assigned." });
    // Term dates are published for the current school year only.
    req.body.schoolYear = currentSchoolYear();
    const { examDate, semester, schoolYear, examType } = req.body;
    const date = new Date(examDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate || "") || Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== examDate || !validSemester(semester) ||
        !validYear(schoolYear) || !["Prelim", "Midterm", "PreFinal", "Final"].includes(examType)) {
      return res.status(400).json({ message: "Valid exam date, semester, school year, and term are required." });
    }
    const dateProblem = termDateProblem({ examDate, semester, schoolYear, examType });
    if (dateProblem) return res.status(400).json({ message: dateProblem });
    const existing = await TermSchedule.exists({ semester, schoolYear, examType, department });
    if (existing) return res.status(409).json({ message: ALREADY });
    const studentScope = await courseScope(req);
    session = await mongoose.startSession();
    let schedule;
    await session.withTransaction(async () => {
      [schedule] = await TermSchedule.create([{ examDate: date, semester, schoolYear, examType, department,
        createdBy: req.user.id }], { session });
      const students = await User.find({ role: "student", isActive: { $ne: false },
        verificationStatus: { $nin: ["pending", "rejected"] },
        semester, schoolYear, ...studentScope }).select("studentId name").session(session);
      if (students.length) await Notification.insertMany(students.map((student) => ({
        studentId: student.studentId, studentName: student.name, recipientRole: "student",
        title: "Exam Schedule Published",
        message: `${examType} examination is scheduled for ${phDate(date)} (${semester}, ${schoolYear}).`,
      })), { session });
    });
    // Let the other departments' Admins know; the schedule is already saved, so
    // a failed notice must not fail the request.
    try {
      const otherAdmins = await User.find({ role: "admin", isActive: { $ne: false },
        _id: { $ne: req.user.id } }).select("_id");
      if (Array.isArray(otherAdmins) && otherAdmins.length) {
        const name = DEPARTMENTS.find((item) => item.code === department)?.name || department;
        await Notification.insertMany(otherAdmins.map((admin) => ({
          recipientRole: "admin", recipientUserId: admin._id, title: "Term Schedule Published",
          message: `${name} published ${examType} on ${phDate(date)} for ${semester}, ${schoolYear}.`,
        })));
      }
    } catch { /* best effort */ }
    return res.status(201).json(schedule);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: ALREADY });
    if (/Transaction numbers are only allowed|replica set/i.test(error.message || "")) {
      return res.status(503).json({ message: "Schedule publishing requires MongoDB transaction support." });
    }
    return res.status(500).json({ message: error.message });
  } finally { if (session) await session.endSession(); }
};

// The Admin's own department's terms plus older school-wide ones (labelled).
const list = async (req, res) => {
  try {
    const rows = await TermSchedule.find({ department: { $in: [req.user.department || "__none__", null] } })
      .sort({ examDate: 1 }).lean();
    return res.json(rows.map((row) => ({ ...row, schoolWide: !row.department })));
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

const mine = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student || student.role !== "student") return res.status(403).json({ message: "Access Denied" });
    const { course, schedules } = await schedulesForStudent(student);
    const result = await Promise.all(schedules.map(async (schedule) => {
      const center = schedule.examDate.getTime();
      const candidates = await Exam.find({ examType: schedule.examType,
        examDate: { $gte: new Date(center - 86400000), $lte: new Date(center + 86400000) },
        status: { $ne: "Cancelled" },
        $and: [
          examCourseFilter(course),
          { $or: [{ courseYear: student.yearLevel }, { courseYear: { $exists: false } }, { courseYear: null }] },
          { $or: [{ courseSection: { $exists: false } }, { courseSection: null }, { courseSection: "" }] },
        ],
      }).select("examDate subject subjectCode schedule room status");
      const subjects = candidates.filter((exam) => manilaDay(exam.examDate) === manilaDay(schedule.examDate));
      return { ...(schedule.toObject ? schedule.toObject() : schedule), subjects };
    }));
    return res.json(result);
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

module.exports = { publish, list, mine };
