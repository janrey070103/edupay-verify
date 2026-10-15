const express =
require("express");

const router =
express.Router();

const protect =require("../middleware/protect");
const reportAccess = (req, res, next) => ["cashier", "super_admin"].includes(req.user.role)
  ? next() : res.status(403).json({ message: "Access Denied" });
router.use(protect, reportAccess);

const {

 getAllPayments,
 getApprovedPayments,
 getRejectedPayments,
 getFullyPaidStudents

} =
require(
"../controllers/reportController"
);

router.get(
"/payments",
getAllPayments
);

router.get(
"/approved",
protect,
getApprovedPayments
);

router.get(
"/rejected",
getRejectedPayments
);

router.get(
"/fullypaid",
getFullyPaidStudents
);

module.exports =
router;
