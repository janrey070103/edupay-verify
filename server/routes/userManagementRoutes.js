const express = require("express");
const protect = require("../middleware/protect");
const superAdminOnly = require("../middleware/superAdminOnly");
const cashierOnly = require("../middleware/cashierOnly");
const {
  getAllUsers,
  getPendingStudents,
  verifyStudent,
  rejectStudent,
  createUser,
  updateUser,
  resetUserPassword,
  deactivateUser,
  searchStudents,
} = require("../controllers/userManagementController");

const router = express.Router();

router.get("/", protect, superAdminOnly, getAllUsers);
router.get("/pending-students", protect, superAdminOnly, getPendingStudents);
router.get("/search", protect, cashierOnly, searchStudents);
router.post("/", protect, superAdminOnly, createUser);
router.patch("/:id", protect, superAdminOnly, updateUser);
router.patch("/:id/reset-password", protect, superAdminOnly, resetUserPassword);
router.patch("/:id/verify", protect, superAdminOnly, verifyStudent);
router.patch("/:id/reject", protect, superAdminOnly, rejectStudent);
router.patch("/:id/deactivate", protect, superAdminOnly, deactivateUser);

module.exports = router;
