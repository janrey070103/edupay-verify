const express = require("express");
const protect = require("../middleware/protect");
const superAdminOnly = require("../middleware/superAdminOnly");
const cashierOnly = require("../middleware/cashierOnly");
const adminOnly = require("../middleware/allowRoles")("admin");
const {
  getAllUsers,
  getUserSummary,
  getPendingStudents,
  verifyStudent,
  rejectStudent,
  createUser,
  updateUser,
  resetUserPassword,
  deactivateUser,
  activateUser,
  listTeachers,
  searchStudents,
} = require("../controllers/userManagementController");

const router = express.Router();

router.get("/", protect, superAdminOnly, getAllUsers);
router.get("/summary", protect, superAdminOnly, getUserSummary);
router.get("/pending-students", protect, adminOnly, getPendingStudents);
router.get("/teachers", protect, adminOnly, listTeachers);
router.get("/search", protect, cashierOnly, searchStudents);
router.post("/", protect, superAdminOnly, createUser);
router.patch("/:id", protect, superAdminOnly, updateUser);
router.patch("/:id/reset-password", protect, superAdminOnly, resetUserPassword);
router.patch("/:id/verify", protect, adminOnly, verifyStudent);
router.patch("/:id/reject", protect, adminOnly, rejectStudent);
router.patch("/:id/deactivate", protect, superAdminOnly, deactivateUser);
router.patch("/:id/activate", protect, superAdminOnly, activateUser);

module.exports = router;
