const crypto = require("crypto");
const QRCode = require("qrcode");
const ExamPermit = require("../Models/ExamPermit");
const User = require("../Models/User");
const Ledger = require("../Models/Ledger");
const Payment = require("../Models/Payments");
const mongoose = require("mongoose");
const Notification = require("../Models/Notification");
const { resolveCourse } = require("../utils/adminScope");
const Exam = require("../Models/Exam");
const { windowProblem, describeWindow } = require("../config/examWindows");

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
    const account = await User.findById(req.user.id).select("studentId name semester schoolYear");
    if (!account || account.studentId !== studentId) return res.status(403).json({ message: "Access Denied" });
    // Paid or not, a term's QR can only be claimed during that term's month.
    const outside = windowProblem(account, examType);
    if (outside) return res.status(403).json({ message: outside, window: describeWindow(account, examType) });
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
    return res.json({ qr, permit, window: describeWindow(account, examType) });
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

const getStudentPermits = async (req, res) => {
  try {
    if (!["student", "super_admin"].includes(req.user.role)) return res.status(403).json({ message: "Access Denied" });
    if (req.user.role === "student") {
      const account = await User.findById(req.user.id).select("studentId");
      if (!account || account.studentId !== req.params.studentId) return res.status(403).json({ message: "Access Denied" });
    }
    const [student, permits] = await Promise.all([
      User.findOne({ studentId: req.params.studentId, role: "student" }).select("semester schoolYear").lean(),
      ExamPermit.find({ studentId: req.params.studentId, permitStatus: "Valid" }).sort({ createdAt: -1 }).lean(),
    ]);
    // Each permit says when it can be used.
    return res.json(permits.map((permit) => ({ ...permit, window: describeWindow(student, permit.examType) })));
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

const timePH = (value) => new Date(value).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
const yearLabel = (n) => `${({ 1: "1st", 2: "2nd", 3: "3rd" })[Number(n)] || `${n}th`}-year`;
const examSummary = (exam) => ({
  examId: exam._id, subject: exam.subject, subjectCode: exam.subjectCode, examType: exam.examType,
  course: exam.course || null, courseYear: exam.courseYear || null, room: exam.room || null,
  schedule: exam.schedule, startTime: exam.startTime || null, endTime: exam.endTime || null, examDate: exam.examDate,
});

/**
 * Verify a student's permit for ONE specific exam (subject) the teacher is
 * proctoring. Strict: the teacher must be that exam's proctor, the exam must be
 * today, and the student's term, course and year level must match the exam.
 * A permit is verified once per exam; a second scan for the same exam is
 * refused (locked) and shows who verified it and when.
 */
const scanPermit = async (req, res) => {
  try {
    const { token, examId } = req.body;
    if (!mongoose.isValidObjectId(examId)) return res.status(400).json({ message: "Select the exam you are proctoring before scanning." });
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found." });
    if (exam.status === "Cancelled") return res.status(409).json({ message: "This exam was cancelled." });
    // The whole-exam proctor, or the proctor of one of its sections.
    const mySection = (exam.sections || []).find((section) => String(section.proctorId) === String(req.user.id));
    if (String(exam.proctorId) !== String(req.user.id) && !mySection) {
      return res.status(403).json({ message: "You are not the assigned proctor for this exam." });
    }
    if (manilaDay(exam.examDate) !== manilaDay(new Date())) {
      return res.status(403).json({ message: `${exam.subjectCode} is scheduled on ${exam.examDate.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" })}. Permits can only be verified on the exam day.` });
    }

    const permit = await ExamPermit.findOne({ qrToken: String(token || ""), permitStatus: "Valid" });
    if (!permit) return res.status(404).json({ message: "Invalid or revoked exam permit." });
    if (permit.examType !== exam.examType) {
      return res.status(403).json({ message: `This is a ${permit.examType} permit; ${exam.subjectCode} is a ${exam.examType} exam.` });
    }
    const student = await User.findOne({ studentId: permit.studentId, role: "student" })
      .select("name studentId course yearLevel semester schoolYear isActive verificationStatus");
    if (!student || student.isActive === false || student.verificationStatus !== "verified") {
      return res.status(403).json({ message: "Student account is not active and verified." });
    }
    // A valid, paid permit still only works during its term's month.
    const outside = windowProblem(student, exam.examType);
    if (outside) return res.status(403).json({ message: outside, window: describeWindow(student, exam.examType) });

    // Strict subject match: same course and (when the exam has one) same year level.
    const studentCourse = await resolveCourse(student.course);
    if (!exam.course) return res.status(409).json({ message: `${exam.subjectCode} has no course set. Ask the Admin to set its course before verifying permits.` });
    if (!studentCourse || studentCourse.code !== exam.course) {
      return res.status(403).json({ message: `${exam.subjectCode} is for ${exam.course} students; ${student.studentId} is enrolled in ${studentCourse?.code || student.course || "an unknown course"}.` });
    }
    if (exam.courseYear && Number(student.yearLevel) !== Number(exam.courseYear)) {
      return res.status(403).json({ message: `${exam.subjectCode} is for ${yearLabel(exam.courseYear)} students; ${student.studentId} is in ${student.yearLevel ? yearLabel(student.yearLevel) : "an unknown year"}.` });
    }

    const teacher = await User.findById(req.user.id).select("name");
    const teacherName = teacher?.name || "Teacher";
    const verifiedAt = new Date();
    // Atomic lock: only adds the scan if this permit was not already verified for this exam.
    const recorded = await ExamPermit.updateOne(
      { _id: permit._id, permitStatus: "Valid", "scans.examId": { $ne: exam._id } },
      { $push: { scans: { teacherId: req.user.id, teacherName, studentId: permit.studentId, examType: exam.examType,
        examId: exam._id, subject: exam.subject, subjectCode: exam.subjectCode, room: mySection?.room || exam.room, course: exam.course,
        courseYear: exam.courseYear, examDate: exam.examDate, action: "Verified", scannedAt: verifiedAt } } },
    );
    if (!recorded.matchedCount) {
      const fresh = await ExamPermit.findById(permit._id).select("scans permitStatus");
      const earlier = (fresh?.scans || []).find((scan) => String(scan.examId) === String(exam._id));
      if (!earlier) return res.status(404).json({ message: "This exam permit is no longer valid." });
      return res.status(409).json({ locked: true,
        message: `Already verified for ${exam.subjectCode} at ${timePH(earlier.scannedAt)} by ${earlier.teacherName || "a proctor"}. This QR cannot be used again for this exam.`,
        student: { name: student.name, studentId: student.studentId },
        exam: examSummary(exam), verifiedAt: earlier.scannedAt, verifiedBy: { name: earlier.teacherName } });
    }

    // Let the student see it right away.
    try {
      await Notification.create({ studentId: student.studentId, studentName: student.name, recipientRole: "student",
        title: "Exam Permit Verified", link: "/student-exams",
        message: `${exam.subjectCode} – ${exam.subject} (${exam.examType})${exam.room ? `, Room ${exam.room}` : ""}: verified by ${teacherName} at ${timePH(verifiedAt)}.` });
    } catch { /* best effort */ }

    return res.json({ verificationStatus: "VERIFIED", scannedAt: verifiedAt, verifiedAt,
      student: { name: student.name, studentId: student.studentId, course: studentCourse.code, yearLevel: student.yearLevel },
      exam: examSummary(exam), examType: exam.examType, permitId: permit._id,
      scannedBy: { id: req.user.id, name: teacherName }, verifiedBy: { id: req.user.id, name: teacherName } });
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

module.exports = { generateQR, getStudentPermits, scanPermit };
