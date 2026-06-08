const Ledger =
require("../Models/Ledger");

const verifyPermit =
async (req, res) => {

  const {
    studentId,
    examType,
  } = req.params;

  const ledger =
    await Ledger.findOne({
      studentId,
    });

  if (!ledger) {

    return res.json({
      status:
      "INVALID",
    });

  }

  const valid =
    ledger[examType];

  res.json({
    status:
    valid
      ? "VALID"
      : "INVALID",
  });

};

module.exports = {
  verifyPermit,
};
