const express =
  require("express");

const {
  createPayment,
  getPayments,
  getPaymentSummary,
  approvePayment,
  rejectPayment,
  createDirectPayment,
  getStudentPaymentOverview,
} = require(
  "../controllers/paymentController"
);

const protect =
require(
"../middleware/protect"
);

const cashierOnly =
require(
"../middleware/cashierOnly"
);

const upload =
require(
"../middleware/upload"
);
const studentOnly = (req, res, next) => req.user.role === "student"
  ? next() : res.status(403).json({ message: "Only students can submit receipts." });

const router =
  express.Router();

router.post(
"/",
protect,
studentOnly,
upload.single("receipt"),
createPayment
);

router.get(
  "/summary",
  protect,
  getPaymentSummary
);

router.get(
  "/",
  protect,
  getPayments
);

// Cashier: one student's balance, cleared terms and recent payments.
router.get("/student/:studentId/overview", protect, cashierOnly, getStudentPaymentOverview);

router.post(
  "/direct-payment",
  protect,
  cashierOnly,
  createDirectPayment
);

router.put(
"/approve/:id",

protect,

cashierOnly,

approvePayment

);

router.put(
"/reject/:id",

protect,

cashierOnly,

rejectPayment

);

module.exports =
  router;
