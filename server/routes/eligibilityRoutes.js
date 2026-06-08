const express = require("express");
const router = express.Router();

const {
  getEligibility,
} = require("../controllers/eligibilityController");

router.get("/:studentId", getEligibility);

module.exports = router;
