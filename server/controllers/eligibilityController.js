const Ledger =
require("../models/Ledger");

const getEligibility =
async (req, res) => {

  const ledger =
    await Ledger.findOne({
      studentId:
      req.params.studentId,
    });

  res.json({
    prelim:
      ledger.prelim,

    midterm:
      ledger.midterm,

    preFinal:
      ledger.preFinal,

    final:
      ledger.final,
  });

};

module.exports = {
  getEligibility,
};