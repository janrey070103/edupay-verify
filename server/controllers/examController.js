const Exam = require("../Models/Exam");
const User = require("../Models/User");
const Notification = require("../Models/Notification");

// Create exam
const createExam = async (req, res) => {
  try {
    const { examDate, examType, subject, subjectCode, schedule, room, capacity, courseYear, courseSection } = req.body;

    // Validate required fields
    if (!examDate || !examType || !subject || !subjectCode || !schedule) {
      return res.status(400).json({
        message: "examDate, examType, subject, subjectCode, and schedule are required.",
      });
    }

    // Check if exam already exists for this date and subject code
    const existing = await Exam.findOne({
      examDate: new Date(examDate),
      subjectCode,
    });

    if (existing) {
      return res.status(400).json({
        message: "Exam already exists for this date and subject code.",
      });
    }

    const exam = await Exam.create({
      examDate: new Date(examDate),
      examType,
      subject,
      subjectCode,
      schedule,
      room: room || null,
      capacity: capacity || null,
      courseYear: courseYear ? Number(courseYear) : undefined,
      courseSection: courseSection || undefined,
      createdBy: req.user.id,
    });

    res.status(201).json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all exams
const getAllExams = async (req, res) => {
  try {
    const exams = await Exam.find()
      .populate("proctorId", "name email studentId")
      .populate("createdBy", "name email")
      .sort({ examDate: 1 });

    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get exams by date
const getExamsByDate = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date query parameter is required." });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const exams = await Exam.find({
      examDate: { $gte: startDate, $lte: endDate },
    })
      .populate("proctorId", "name email studentId")
      .sort({ schedule: 1 });

    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get exams for a specific teacher/proctor
const getExamsForTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const exams = await Exam.find({
      proctorId: teacherId,
    })
      .populate("createdBy", "name email")
      .sort({ examDate: 1 });

    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update exam
const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { examDate, examType, subject, subjectCode, schedule, room, capacity, status, courseYear, courseSection } = req.body;

    const exam = await Exam.findById(id);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found." });
    }

    // Check if updating subject code and date creates duplicate
    if (
      (subjectCode && subjectCode !== exam.subjectCode) ||
      (examDate && examDate !== exam.examDate.toISOString())
    ) {
      const existing = await Exam.findOne({
        _id: { $ne: id },
        examDate: examDate ? new Date(examDate) : exam.examDate,
        subjectCode: subjectCode || exam.subjectCode,
      });

      if (existing) {
        return res.status(400).json({
          message: "Exam already exists for this date and subject code.",
        });
      }
    }

    if (examDate) exam.examDate = new Date(examDate);
    if (examType) exam.examType = examType;
    if (subject) exam.subject = subject;
    if (subjectCode) exam.subjectCode = subjectCode;
    if (schedule) exam.schedule = schedule;
    if (room !== undefined) exam.room = room;
    if (capacity !== undefined) exam.capacity = capacity;
    if (courseYear !== undefined) exam.courseYear = courseYear ? Number(courseYear) : undefined;
    if (courseSection !== undefined) exam.courseSection = courseSection || undefined;
    if (status) exam.status = status;

    await exam.save();

    // Notify the assigned proctor if exam details changed
    if (exam.proctorId) {
      const teacher = await User.findById(exam.proctorId);
      if (teacher) {
        await Notification.create({
          studentId: teacher.studentId,
          recipientUserId: teacher._id,
          studentName: teacher.name,
          recipientRole: "teacher",
          title: "Exam Schedule Updated",
          message: `The schedule for ${exam.subject} (${exam.subjectCode}) has been updated. Please check your assigned exams for the latest details.`,
        });
      }
    }

    res.json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Assign proctor/teacher to exam
const assignProctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { proctorId } = req.body;

    if (!proctorId) {
      return res.status(400).json({ message: "proctorId is required." });
    }

    const exam = await Exam.findById(id);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found." });
    }

    const teacher = await User.findById(proctorId);

    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({ message: "Teacher not found." });
    }

    exam.proctorId = proctorId;
    exam.proctorName = teacher.name;
    exam.proctorEmail = teacher.email;

    await exam.save();

    // Create notification for teacher
    await Notification.create({
      studentId: teacher.studentId,
      recipientUserId: teacher._id,
      studentName: teacher.name,
      recipientRole: "teacher",
      title: "New Exam Assigned",
      message: `You have been assigned as proctor for ${exam.subject} (${exam.subjectCode}) on ${exam.examDate.toLocaleDateString()} at ${exam.schedule}.`,
    });

    res.json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove proctor from exam
const removeProctor = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found." });
    }

    // Look up the teacher before clearing so we can notify them
    const previousProctorId = exam.proctorId;
    let teacher = null;
    if (previousProctorId) {
      teacher = await User.findById(previousProctorId);
    }

    exam.proctorId = null;
    exam.proctorName = null;
    exam.proctorEmail = null;

    await exam.save();

    // Create notification for teacher if there was one
    if (teacher) {
      await Notification.create({
        studentId: teacher.studentId,
        recipientUserId: teacher._id,
        studentName: teacher.name,
        recipientRole: "teacher",
        title: "Exam Assignment Removed",
        message: `Your assignment as proctor for ${exam.subject} (${exam.subjectCode}) on ${exam.examDate.toLocaleDateString()} has been removed.`,
      });
    }

    res.json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete exam
const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found." });
    }

    // Notify the assigned proctor before deleting
    if (exam.proctorId) {
      const teacher = await User.findById(exam.proctorId);
      if (teacher) {
        await Notification.create({
          studentId: teacher.studentId,
          recipientUserId: teacher._id,
          studentName: teacher.name,
          recipientRole: "teacher",
          title: "Exam Cancelled",
          message: `The exam for ${exam.subject} (${exam.subjectCode}) on ${exam.examDate.toLocaleDateString()} at ${exam.schedule} has been cancelled. Your proctoring duty has been removed.`,
        });
      }
    }

    await Exam.findByIdAndDelete(id);

    res.json({ message: "Exam deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get exams for a specific month (for calendar view)
const getExamsForMonth = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ message: "Year and month query parameters are required." });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const exams = await Exam.find({
      examDate: { $gte: startDate, $lte: endDate },
    })
      .populate("proctorId", "name email")
      .sort({ examDate: 1 });

    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get exam schedule report (for printing - traditional format)
const getExamScheduleReport = async (req, res) => {
  try {
    const { year, month, examType } = req.query;

    let query = { status: { $ne: "Cancelled" } };

    if (year && month) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      query.examDate = { $gte: startDate, $lte: endDate };
    }

    if (examType) {
      query.examType = examType;
    }

    const exams = await Exam.find(query)
      .populate("proctorId", "name email")
      .populate("createdBy", "name")
      .sort({ examDate: 1, schedule: 1 });

    // Group by date
    const groupedByDate = {};
    exams.forEach((exam) => {
      const dateKey = exam.examDate.toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(exam);
    });

    res.json(groupedByDate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createExam,
  getAllExams,
  getExamsByDate,
  getExamsForTeacher,
  updateExam,
  assignProctor,
  removeProctor,
  deleteExam,
  getExamsForMonth,
  getExamScheduleReport,
};
