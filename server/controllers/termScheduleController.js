const TermSchedule = require("../Models/TermSchedule");
const Exam = require("../Models/Exam");
const User = require("../Models/User");
const Notification = require("../Models/Notification");
const mongoose = require("mongoose");
const manilaDay = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));

const validYear = (value) => /^\d{4}-\d{4}$/.test(value) && Number(value.slice(5)) === Number(value.slice(0, 4)) + 1;
const validSemester = (value) => ["1st Semester", "2nd Semester", "Summer"].includes(value);

const publish = async (req, res) => {
  let session;
  try {
    const { examDate, semester, schoolYear, examType } = req.body;
    const date = new Date(examDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate || "") || Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== examDate || !validSemester(semester) ||
        !validYear(schoolYear) || !["Prelim", "Midterm", "PreFinal", "Final"].includes(examType)) {
      return res.status(400).json({ message: "Valid exam date, semester, school year, and term are required." });
    }
    const existing = await TermSchedule.exists({ semester, schoolYear, examType });
    if (existing) return res.status(409).json({ message: "This term is already published for the semester and school year." });
    session = await mongoose.startSession();
    let schedule;
    await session.withTransaction(async () => {
      [schedule] = await TermSchedule.create([{ examDate: date, semester, schoolYear, examType, createdBy: req.user.id }], { session });
      const students = await User.find({ role: "student", isActive: { $ne: false },
        verificationStatus: { $nin: ["pending", "rejected"] },
        semester, schoolYear }).select("studentId name").session(session);
      if (students.length) await Notification.insertMany(students.map((student) => ({
        studentId: student.studentId, studentName: student.name, recipientRole: "student",
        title: "Exam Schedule Published",
        message: `${examType} examination is scheduled for ${date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })} (${semester}, ${schoolYear}).`,
      })), { session });
    });
    return res.status(201).json(schedule);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This term is already published for the semester and school year." });
    if (/Transaction numbers are only allowed|replica set/i.test(error.message || "")) {
      return res.status(503).json({ message: "Schedule publishing requires MongoDB transaction support." });
    }
    return res.status(500).json({ message: error.message });
  } finally { if (session) await session.endSession(); }
};

const list = async (req, res) => {
  try {
    return res.json(await TermSchedule.find().sort({ examDate: 1 }));
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

const mine = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student || student.role !== "student") return res.status(403).json({ message: "Access Denied" });
    const schedules = await TermSchedule.find({ semester: student.semester, schoolYear: student.schoolYear }).sort({ examDate: 1 });
    const result = await Promise.all(schedules.map(async (schedule) => {
      const center = schedule.examDate.getTime();
      const candidates = await Exam.find({ examType: schedule.examType,
        examDate: { $gte: new Date(center - 86400000), $lte: new Date(center + 86400000) },
        status: { $ne: "Cancelled" },
        $and: [
          { $or: [{ courseYear: student.yearLevel }, { courseYear: { $exists: false } }, { courseYear: null }] },
          { $or: [{ courseSection: { $exists: false } }, { courseSection: null }, { courseSection: "" }] },
        ],
      }).select("examDate subject subjectCode schedule room status");
      const subjects = candidates.filter((exam) => manilaDay(exam.examDate) === manilaDay(schedule.examDate));
      return { ...schedule.toObject(), subjects };
    }));
    return res.json(result);
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

module.exports = { publish, list, mine };
