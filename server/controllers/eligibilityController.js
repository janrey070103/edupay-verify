const Ledger =
require("../Models/Ledger");

const getEligibility =
async (req, res) => {

  const ledger =
    await Ledger.findOne({
      studentId:
      req.params.studentId,
    });

  if (!ledger) {
    return res.json({
      prelim: false,
      midterm: false,
      preFinal: false,
      final: false,
    });
  }

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
