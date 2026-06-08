const express = require("express");
const router = express.Router();

const {
  generateQR,
} = require("../controllers/qrController");

router.post("/generate", generateQR);

module.exports = router;
