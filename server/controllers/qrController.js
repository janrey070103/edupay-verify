const crypto = require("crypto");
const QRCode = require("qrcode");
const ExamPermit = require("../Models/ExamPermit");
const User = require("../Models/User");
const Ledger = require("../Models/Ledger");
const Payment = require("../Models/Payments");
const TermSchedule = require("../Models/TermSchedule");
const Exam = require("../Models/Exam");

const TERMS = ["Prelim", "Midterm", "PreFinal", "Final"];
const ledgerField = { Prelim: "prelim", Midterm: "midterm", PreFinal: "preFinal", Final: "final" };
const manilaDay = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));

const generateQR = async (req, res) => {
  try {
    const { studentId, examType } = req.body;
    if (req.user.role !== "student") return res.status(403).json({ message: "Access Denied" });
    if (!TERMS.includes(examType)) return res.status(400).json({ message: "Select a valid examination term." });
    const account = await User.findById(req.user.id).select("studentId name");
    if (!account || account.studentId !== studentId) return res.status(403).json({ message: "Access Denied" });
    let permit = await ExamPermit.findOne({ studentId, examType, permitStatus: "Valid" });
    if (!permit) {
      const existing = await ExamPermit.findOne({ studentId, examType });
      if (existing?.permitStatus === "Revoked") return res.status(403).json({ message: "This exam permit has been revoked." });
      const ledger = await Ledger.findOne({ studentId });
      const approved = ledger?.[ledgerField[examType]] &&
        await Payment.findOne({ studentId, status: "Approved" }).sort({ approvedAt: -1 });
      if (approved) {
        permit = await ExamPermit.findOneAndUpdate({ studentId, examType }, {
          $setOnInsert: { studentName: account.name, paymentId: approved._id,
            qrToken: crypto.randomBytes(24).toString("hex"), permitStatus: "Valid" },
        }, { upsert: true, new: true });
      }
    }
    if (!permit) return res.status(404).json({ message: "No valid exam permit found." });
    const qr = await QRCode.toDataURL(JSON.stringify({ permitId: permit._id, token: permit.qrToken }));
    return res.json({ qr, permit });
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

const getStudentPermits = async (req, res) => {
  try {
    if (!["student", "super_admin"].includes(req.user.role)) return res.status(403).json({ message: "Access Denied" });
    if (req.user.role === "student") {
      const account = await User.findById(req.user.id).select("studentId");
      if (!account || account.studentId !== req.params.studentId) return res.status(403).json({ message: "Access Denied" });
    }
    const permits = await ExamPermit.find({ studentId: req.params.studentId, permitStatus: "Valid" }).sort({ createdAt: -1 });
    return res.json(permits);
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

const scanPermit = async (req, res) => {
  try {
    const { token, examType } = req.body;
    if (!TERMS.includes(examType)) return res.status(400).json({ message: "Select the examination term before scanning." });
    const permit = await ExamPermit.findOne({ qrToken: token, permitStatus: "Valid" });
    if (!permit) return res.status(404).json({ message: "Invalid or revoked exam permit." });
    if (permit.examType !== examType) return res.status(403).json({ message: `This ${permit.examType} permit cannot verify a ${examType} examination.` });
    const student = await User.findOne({ studentId: permit.studentId, role: "student" })
      .select("name studentId course yearLevel semester schoolYear isActive verificationStatus");
    if (!student || student.isActive === false || student.verificationStatus !== "verified") {
      return res.status(403).json({ message: "Student account is not active and verified." });
    }
    const teacher = await User.findById(req.user.id).select("name");
    const scannedAt = new Date();
    const recorded = await ExamPermit.updateOne({ _id: permit._id, permitStatus: "Valid" }, {
      $push: { scans: { teacherId: req.user.id, teacherName: teacher?.name || "Teacher",
        studentId: permit.studentId, examType, action: "Scanned", scannedAt } },
    });
    if (!recorded.matchedCount) return res.status(404).json({ message: "This exam permit is no longer valid." });
    const schedules = await TermSchedule.find({ examType, semester: student.semester,
      schoolYear: student.schoolYear }).sort({ examDate: 1 });
    let scheduledExams = [];
    if (schedules.length) {
      const dates = schedules.map((item) => item.examDate.getTime());
      const candidates = await Exam.find({ examType, status: { $ne: "Cancelled" },
        examDate: { $gte: new Date(Math.min(...dates) - 86400000), $lte: new Date(Math.max(...dates) + 86400000) },
        $and: [
          { $or: [{ courseYear: student.yearLevel }, { courseYear: { $exists: false } }, { courseYear: null }] },
          { $or: [{ courseSection: { $exists: false } }, { courseSection: null }, { courseSection: "" }] },
        ],
      }).select("examDate subject subjectCode schedule room status").sort({ examDate: 1 }).limit(100);
      const days = new Set(schedules.map((item) => manilaDay(item.examDate)));
      scheduledExams = candidates.filter((exam) => days.has(manilaDay(exam.examDate))).slice(0, 20);
    }
    return res.json({ verificationStatus: "VERIFIED", scannedAt,
      student: { name: student.name, studentId: student.studentId,
        course: student.course, yearLevel: student.yearLevel },
      examType, permitId: permit._id, scannedBy: { id: req.user.id, name: teacher?.name || "Teacher" },
      schedules, scheduledExams });
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

module.exports = { generateQR, getStudentPermits, scanPermit };
