const Ledger =
require("../Models/Ledger");
const ExamPermit = require("../Models/ExamPermit");
const User = require("../Models/User");

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

  const field = { Prelim: "prelim", Midterm: "midterm", PreFinal: "preFinal", Final: "final" }[examType];
  const [student, permit] = await Promise.all([
    User.findOne({ studentId, role: "student" }),
    ExamPermit.findOne({ studentId, examType, permitStatus: "Valid" }),
  ]);
  const valid = Boolean(field && ledger[field] && permit && student &&
    student.isActive !== false && student.verificationStatus === "verified");

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
