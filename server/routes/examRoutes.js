const express = require("express");
const protect = require("../middleware/protect");
const adminOnly = require("../middleware/allowRoles")("admin");
const teacherOnly = require("../middleware/teacherOnly");
const {
  createExam,
  getAllExams,
  getExamsByDate,
  getExamsForTeacher,
  updateExam,
  assignProctor,
  removeProctor,
  deleteExam,
  getExamsForMonth,
  getExamScheduleReport,
} = require("../controllers/examController");

const { getMyExamCalendar, getTeacherExamCalendar } = require("../controllers/studentExamController");

const router = express.Router();

// Admin routes (department-scoped Admins only; the Super Admin has no access)
router.post("/", protect, adminOnly, createExam);
router.get("/", protect, adminOnly, getAllExams);
router.get("/report/schedule", protect, adminOnly, getExamScheduleReport);
router.get("/month", protect, adminOnly, getExamsForMonth);
router.get("/date", protect, adminOnly, getExamsByDate);
router.put("/:id", protect, adminOnly, updateExam);
router.delete("/:id", protect, adminOnly, deleteExam);
router.put("/:id/assign-proctor", protect, adminOnly, assignProctor);
router.put("/:id/remove-proctor", protect, adminOnly, removeProctor);

// Teacher routes
router.get("/teacher/assigned", protect, teacherOnly, getExamsForTeacher);
// Teacher: assigned exams as calendar events, with the students verified for each.
router.get("/teacher/calendar", protect, teacherOnly, getTeacherExamCalendar);

// Student: own exams as calendar events, with proctor verification details.
router.get("/student/calendar", protect, require("../middleware/allowRoles")("student"), getMyExamCalendar);

module.exports = router;
