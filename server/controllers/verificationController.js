const Ledger =
require("../Models/Ledger");
const ExamPermit = require("../Models/ExamPermit");
const User = require("../Models/User");
const { windowProblem } = require("../config/examWindows");

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
  // Paid and valid, but only during the term's own month.
  const outside = student ? windowProblem(student, examType) : null;
  const valid = Boolean(field && ledger[field] && permit && student &&
    student.isActive !== false && student.verificationStatus === "verified" && !outside);

  res.json({
    status: valid ? "VALID" : "INVALID",
    ...(outside ? { reason: outside } : {}),
  });

};

module.exports = {
  verifyPermit,
};
