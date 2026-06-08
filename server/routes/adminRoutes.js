const express =
require("express");

const router =
express.Router();

const {

 getPrelimEligible,
 getMidtermEligible,
 getPreFinalEligible,
 getFinalEligible

} =
require(
"../controllers/adminController"
);

router.get(
"/prelim",
getPrelimEligible
);

router.get(
"/midterm",
getMidtermEligible
);

router.get(
"/prefinal",
getPreFinalEligible
);

router.get(
"/final",
getFinalEligible
);

module.exports =
router;