const router = require("express").Router();
const protect = require("../middleware/protect");
const allowRoles = require("../middleware/allowRoles");
const { getAdminSummary, getEligibilityReport, getVerifiedStudents } = require("../controllers/adminController");

// Department Admins only; every response is limited to the Admin's department.
router.use(protect, allowRoles("admin"));

router.get("/summary", getAdminSummary);
router.get("/eligibility", getEligibilityReport);
router.get("/verified-students", getVerifiedStudents);

module.exports = router;
