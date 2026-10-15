const express =
  require("express");

const {
  createPayment,
  getPayments,
  approvePayment,
  rejectPayment,
  createDirectPayment,
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
  "/",
  protect,
  getPayments
);

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
