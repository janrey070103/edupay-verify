const express = require("express");
const router = express.Router();
const protect = require("../middleware/protect");
const teacherOnly = require("../middleware/teacherOnly");

const {
  generateQR,
  getStudentPermits,
  scanPermit,
} = require("../controllers/qrController");

router.get("/student/:studentId", protect, getStudentPermits);
router.post("/generate", protect, generateQR);
router.post("/scan", protect, teacherOnly, scanPermit);

module.exports = router;
