const express = require("express");
const protect = require("../middleware/protect");
const superAdminOnly = require("../middleware/superAdminOnly");
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

const router = express.Router();

// Admin routes (super_admin only)
router.post("/", protect, superAdminOnly, createExam);
router.get("/", protect, superAdminOnly, getAllExams);
router.get("/report/schedule", protect, superAdminOnly, getExamScheduleReport);
router.get("/month", protect, superAdminOnly, getExamsForMonth);
router.get("/date", protect, superAdminOnly, getExamsByDate);
router.put("/:id", protect, superAdminOnly, updateExam);
router.delete("/:id", protect, superAdminOnly, deleteExam);
router.put("/:id/assign-proctor", protect, superAdminOnly, assignProctor);
router.put("/:id/remove-proctor", protect, superAdminOnly, removeProctor);

// Teacher routes
router.get("/teacher/assigned", protect, teacherOnly, getExamsForTeacher);

module.exports = router;
