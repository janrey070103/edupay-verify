const express = require("express");
const router = express.Router();
const protect = require("../middleware/protect");
const User = require("../Models/User");
const ownEligibility = require("../middleware/ownEligibility");
router.use(protect);

const {
  getEligibility,
} = require("../controllers/eligibilityController");

router.get("/me/ledger", async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Access Denied" });
    const student = await User.findById(req.user.id).select("studentId");
    if (!student) return res.status(404).json({ message: "Student not found" });
    const Ledger = require("../Models/Ledger");
    const ledger = await Ledger.findOne({ studentId: student.studentId });
    return res.json(ledger || new Ledger({ studentId: student.studentId }).toObject());
  } catch (error) { return res.status(500).json({ message: error.message }); }
});
router.get("/:studentId", ownEligibility, getEligibility);

module.exports = router;
