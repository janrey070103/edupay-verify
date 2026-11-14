const Exam = require("../Models/Exam");
const User = require("../Models/User");
const Notification = require("../Models/Notification");
const { courseScope, inScope, ownsCourse } = require("../utils/adminScope");
const { examScheduleProblem, examPeriodProblem, manilaMonthRange } = require("../config/examWindows");
const { sectionName, readSections, resolveSectionProctors, examProctorIds, notifySectionChanges, notifyTeacher,
  forTeacher, proctoredBy } = require("../services/examSections");

const EXAM_KINDS = ["Regular", "Special"];
const manilaDayKey = (value) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/**
 * Manila day keys of the department's regular exams for this term and month
 * (not cancelled, not the exam being edited): they define the 4-day period.
 */
const regularExamDays = async (req, { examDate, examType }, excludeId) => {
  const { start, end } = manilaMonthRange(examDate);
  const exams = await Exam.find({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    examType, examKind: { $ne: "Special" }, status: { $ne: "Cancelled" },
    examDate: { $gte: start, $lt: end },
    $and: [await courseScope(req, "course")],
  }).select("examDate").lean();
  return exams.map((exam) => manilaDayKey(exam.examDate));
};

// Exams with no course (created before courses existed) stay visible so an
// Admin can assign one; everything else is limited to the Admin's department.
const EXAM_SCOPE = { includeUnassigned: true };

// Exam times: picked as 24-hour "HH:mm" (start before end), or none when the
// schedule text was typed manually.
const readTimes = (startTime, endTime) => {
  const valid = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ""));
  if (!startTime && !endTime) return { ok: true, startTime: undefined, endTime: undefined };
  if (!valid(startTime) || !valid(endTime) || endTime <= startTime) return { ok: false };
  return { ok: true, startTime, endTime };
};
const TIME_ERROR = "Pick a valid start and end time (the end must be after the start).";

const OUT_OF_SCOPE = "This exam belongs to another department.";
// Every exam names its year level (1-4) and room capacity.
const validYear = (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 4;
const validCapacity = (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 1000;
const YEAR_REQUIRED = "Choose the course year (1st to 4th Year).";
const CAPACITY_REQUIRED = "Enter the capacity (number of students, at least 1).";
const COURSE_REQUIRED = "Choose a course from your department.";

// Create exam
const createExam = async (req, res) => {
  try {
    const { examDate, examType, subject, subjectCode, schedule, capacity, courseYear, course } = req.body;
    const examKind = req.body.examKind || "Regular";
    if (!EXAM_KINDS.includes(examKind)) return res.status(400).json({ message: "Choose Regular or Special exam." });
    const times = readTimes(req.body.startTime, req.body.endTime);
    if (!times.ok) return res.status(400).json({ message: TIME_ERROR });

    // Every new exam belongs to a course of the Admin's own department.
    if (!await ownsCourse(req, course)) return res.status(400).json({ message: COURSE_REQUIRED });

    // Validate required fields
    if (!examDate || !examType || !subject || !subjectCode || !schedule) {
      return res.status(400).json({
        message: "examDate, examType, subject, subjectCode, and schedule are required.",
      });
    }

    // Not in the past, and the term must match the month the date falls in.
    const scheduleProblem = examScheduleProblem({ examDate, examType, startTime: times.startTime });
    if (scheduleProblem) return res.status(400).json({ message: scheduleProblem });
    // Regular exams inside the term's 4-day period; Special exams only after it.
    const periodProblem = examPeriodProblem({ examDate, examType, examKind }, await regularExamDays(req, { examDate, examType }));
    if (periodProblem) return res.status(400).json({ message: periodProblem });

    // Check if exam already exists for this date and subject code
    const existing = await Exam.findOne({
      examDate: new Date(examDate),
      subjectCode,
      course,
    });

    if (existing) {
      return res.status(400).json({
        message: "Exam already exists for this date and subject code.",
      });
    }

    if (!validYear(courseYear)) return res.status(400).json({ message: YEAR_REQUIRED });
    if (!validCapacity(capacity)) return res.status(400).json({ message: CAPACITY_REQUIRED });
    // Every exam has its sections, each with its own room and proctor (e.g. BSIT-1A).
    const sectionInput = readSections(req.body.sections ?? [], { course, courseYear });
    if (sectionInput.error) return res.status(400).json({ message: sectionInput.error });
    const resolved = await resolveSectionProctors(sectionInput.sections,
      { examDate: new Date(examDate), startTime: times.startTime, endTime: times.endTime });
    if (resolved.error) return res.status(409).json({ message: resolved.error });
    const sections = resolved.sections;

    const exam = await Exam.create({
      examDate: new Date(examDate),
      examType,
      examKind,
      subject,
      subjectCode,
      course,
      schedule,
      startTime: times.startTime,
      endTime: times.endTime,
      capacity: Number(capacity),
      courseYear: Number(courseYear),
      sections,
      createdBy: req.user.id,
    });
    await notifySectionChanges(exam, []);

    res.status(201).json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all exams
const getAllExams = async (req, res) => {
  try {
    const exams = await Exam.find(await courseScope(req, "course", EXAM_SCOPE))
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
      $and: [await courseScope(req, "course", EXAM_SCOPE)],
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

    const exams = await Exam.find(proctoredBy(teacherId))
      .populate("createdBy", "name email")
      .sort({ examDate: 1 }).lean();

    // A section proctor sees their own section's room and name.
    res.json(exams.map((exam) => forTeacher(exam, teacherId)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update exam
const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { examDate, examType, subject, subjectCode, schedule, room, capacity, status, courseYear, courseSection, course } = req.body;
    const timesGiven = req.body.startTime !== undefined || req.body.endTime !== undefined;
    const times = readTimes(req.body.startTime, req.body.endTime);
    if (timesGiven && !times.ok) return res.status(400).json({ message: TIME_ERROR });

    const exam = await Exam.findById(id);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found." });
    }
    if (!await inScope(req, exam.course, EXAM_SCOPE)) return res.status(403).json({ message: OUT_OF_SCOPE });

    // Moving the date or time must not land in the past; changing the date or
    // term must keep the term matching the date's month. Other edits (room,
    // status, proctor...) are allowed on past exams.
    const nextDate = examDate ? new Date(examDate) : exam.examDate;
    const dayOf = (value) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const dateChanged = Boolean(examDate) && dayOf(examDate) !== dayOf(exam.examDate);
    const typeChanged = Boolean(examType) && examType !== exam.examType;
    const timeChanged = timesGiven && times.startTime && times.startTime !== exam.startTime;
    const nextKind = req.body.examKind || exam.examKind || "Regular";
    if (!EXAM_KINDS.includes(nextKind)) return res.status(400).json({ message: "Choose Regular or Special exam." });
    const kindChanged = nextKind !== (exam.examKind || "Regular");
    if (dateChanged || typeChanged || timeChanged || kindChanged) {
      const scheduleProblem = examScheduleProblem(
        { examDate: nextDate, examType: examType || exam.examType, startTime: timesGiven ? times.startTime : exam.startTime },
        new Date(), { checkPast: dateChanged || timeChanged });
      if (scheduleProblem) return res.status(400).json({ message: scheduleProblem });
    }
    if (dateChanged || typeChanged || kindChanged) {
      const nextType = examType || exam.examType;
      const periodProblem = examPeriodProblem({ examDate: nextDate, examType: nextType, examKind: nextKind },
        await regularExamDays(req, { examDate: nextDate, examType: nextType }, exam._id));
      if (periodProblem) return res.status(400).json({ message: periodProblem });
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

    const nextCourse = course !== undefined ? course : exam.course;
    const nextYear = courseYear !== undefined ? courseYear : exam.courseYear;
    if (courseYear !== undefined && !validYear(courseYear)) return res.status(400).json({ message: YEAR_REQUIRED });
    if (capacity !== undefined && !validCapacity(capacity)) return res.status(400).json({ message: CAPACITY_REQUIRED });
    // Sections: validated against the exam's final course, year, date and time.
    const sectionInput = readSections(req.body.sections, { course: nextCourse, courseYear: nextYear });
    if (sectionInput.error) return res.status(400).json({ message: sectionInput.error });
    let nextSections;
    if (sectionInput.sections !== undefined) {
      const resolved = await resolveSectionProctors(sectionInput.sections, { _id: exam._id,
        examDate: nextDate, startTime: timesGiven ? times.startTime : exam.startTime, endTime: timesGiven ? times.endTime : exam.endTime });
      if (resolved.error) return res.status(409).json({ message: resolved.error });
      nextSections = resolved.sections;
    }

    if (course !== undefined && course !== exam.course) {
      if (!await ownsCourse(req, course)) return res.status(400).json({ message: COURSE_REQUIRED });
      exam.course = course;
    }
    if (examDate) exam.examDate = new Date(examDate);
    if (examType) exam.examType = examType;
    exam.examKind = nextKind;
    if (subject) exam.subject = subject;
    if (subjectCode) exam.subjectCode = subjectCode;
    if (schedule) exam.schedule = schedule;
    // Switching to a typed schedule clears picked times so the two never disagree.
    if (timesGiven) { exam.startTime = times.startTime; exam.endTime = times.endTime; }
    if (room !== undefined) exam.room = room || undefined;
    if (capacity !== undefined) exam.capacity = Number(capacity);
    if (courseYear !== undefined) exam.courseYear = Number(courseYear);
    // Section names follow the course and year (BSIT-1A) even when only those changed.
    if (nextSections === undefined && exam.sections?.length) {
      exam.sections.forEach((section) => { section.name = sectionName(exam.course, exam.courseYear, String(section.name).slice(-1)); });
    }
    if (courseSection !== undefined) exam.courseSection = courseSection || undefined;
    if (status) exam.status = status;

    const sectionsBefore = (exam.sections || []).map((section) => ({ name: section.name, proctorId: section.proctorId }));
    const proctorsBefore = examProctorIds(exam);
    let removedWholeProctor = null;
    if (nextSections !== undefined) {
      exam.sections = nextSections;
      if (nextSections.length) {
        // With sections, each section has its own proctor; the whole-exam proctor is replaced.
        if (exam.proctorId && !nextSections.some((s) => String(s.proctorId) === String(exam.proctorId))) removedWholeProctor = exam.proctorId;
        exam.proctorId = null; exam.proctorName = null; exam.proctorEmail = null; exam.courseSection = undefined;
      }
    }

    await exam.save();

    if (nextSections !== undefined) await notifySectionChanges(exam, sectionsBefore);
    if (removedWholeProctor) {
      await notifyTeacher(removedWholeProctor, "Exam Assignment Removed",
        `${exam.subject} (${exam.subjectCode}) is now proctored by section. Your assignment for the whole exam has been removed.`);
    }
    // Everyone who stays assigned is told the details changed.
    const stillAssigned = examProctorIds(exam).filter((id) => proctorsBefore.includes(id));
    for (const id of stillAssigned) {
      await notifyTeacher(id, "Exam Schedule Updated",
        `The schedule for ${exam.subject} (${exam.subjectCode}) has been updated. Please check your assigned exams for the latest details.`);
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
    if (!await inScope(req, exam.course, EXAM_SCOPE)) return res.status(403).json({ message: OUT_OF_SCOPE });
    if (exam.sections?.length) {
      return res.status(409).json({ message: "This exam is proctored by section. Assign the proctor on each section instead." });
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
    if (!await inScope(req, exam.course, EXAM_SCOPE)) return res.status(403).json({ message: OUT_OF_SCOPE });

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
    if (!await inScope(req, exam.course, EXAM_SCOPE)) return res.status(403).json({ message: OUT_OF_SCOPE });

    // Notify every assigned proctor (whole exam and sections) before deleting
    for (const id of examProctorIds(exam)) {
      await notifyTeacher(id, "Exam Cancelled",
        `The exam for ${exam.subject} (${exam.subjectCode}) on ${exam.examDate.toLocaleDateString()} at ${exam.schedule} has been cancelled. Your proctoring duty has been removed.`);
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
      $and: [await courseScope(req, "course", EXAM_SCOPE)],
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
    query.$and = [await courseScope(req, "course", EXAM_SCOPE)];

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
