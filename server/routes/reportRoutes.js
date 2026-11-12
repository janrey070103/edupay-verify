const express = require("express");
const router = express.Router();
const protect = require("../middleware/protect");
const { getPaymentsReport, getReportSummary } = require("../controllers/reportController");

const reportAccess = (req, res, next) => ["cashier", "super_admin"].includes(req.user.role)
  ? next() : res.status(403).json({ message: "Access Denied" });

router.use(protect, reportAccess);

router.get("/summary", getReportSummary);
router.get("/payments", getPaymentsReport);

module.exports = router;
