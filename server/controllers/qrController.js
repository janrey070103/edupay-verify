const QRCode =
require("qrcode");

const generateQR =
async (req, res) => {

  const {
    studentId,
    examType,
  } = req.body;

  const qrData =
    JSON.stringify({

      studentId,

      examType,

      status:
      "VALID",

    });

  const qr =
    await QRCode.toDataURL(
      qrData
    );

  res.json({
    qr,
  });

};

module.exports = {
  generateQR,
};