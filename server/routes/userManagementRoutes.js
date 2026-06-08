const express = require("express");
const protect = require("../middleware/protect");
const superAdminOnly = require("../middleware/superAdminOnly");
const {
  getAllUsers,
  createUser,
  updateUser,
  deactivateUser,
} = require("../controllers/userManagementController");

const router = express.Router();

router.get("/", protect, superAdminOnly, getAllUsers);
router.post("/", protect, superAdminOnly, createUser);
router.patch("/:id", protect, superAdminOnly, updateUser);
router.patch("/:id/deactivate", protect, superAdminOnly, deactivateUser);

module.exports = router;
