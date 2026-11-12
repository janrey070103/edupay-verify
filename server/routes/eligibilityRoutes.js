const express = require("express");
const router = express.Router();
const protect = require("../middleware/protect");
const ownEligibility = require("../middleware/ownEligibility");
router.use(protect);

const {
  getEligibility,
  getMyLedger,
} = require("../controllers/eligibilityController");

// The student's own Tuition Ledger (chart data: paid, tentative, next payment).
router.get("/me/ledger", getMyLedger);
router.get("/:studentId", ownEligibility, getEligibility);

module.exports = router;
