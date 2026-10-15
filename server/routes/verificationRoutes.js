const express = require("express");
const router = express.Router();
const protect = require("../middleware/protect");
const teacherOnly = require("../middleware/teacherOnly");
router.use(protect, teacherOnly);

const {
  verifyPermit,
} = require("../controllers/verificationController");

router.get(
  "/:studentId/:examType",
  verifyPermit
);

module.exports = router;
