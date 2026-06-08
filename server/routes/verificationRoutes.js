const express = require("express");
const router = express.Router();

const {
  verifyPermit,
} = require("../controllers/verificationController");

router.get(
  "/:studentId/:examType",
  verifyPermit
);

module.exports = router;