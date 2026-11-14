const Notification = require("../Models/Notification");
const { MISSING_PROCTOR } = require("./examSections");
const TermSchedule = require("../Models/TermSchedule");
const Ledger = require("../Models/Ledger");
const Exam = require("../Models/Exam");
const User = require("../Models/User");
const { courseScope, codePattern } = require("../utils/adminScope");
const { allCourses } = require("./catalogService");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const STUDENT_DAYS_BEFORE = 3; // Q9-A: "Your Prelim is in 3 days and you are not cleared"
const PROCTOR_WINDOW_DAYS = 7; // Q9-C: exams in the next 7 days without a proctor
const PENDING_WAIT_DAYS = 3; // Q9-D: students waiting more than 3 days
const KEEP_DAYS = 182; // Q11-B: read notifications are kept about 6 months
const TERM_FIELD = { Prelim: "prelim", Midterm: "midterm", PreFinal: "preFinal", Final: "final" };

const manilaDayKey = (date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);
const phDate = (date) => new Date(date).toLocaleDateString("en-PH", {
  timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric",
});
const adminReq = (department) => ({ user: { role: "admin", department } });

// Inserts reminders, silently skipping any whose dedupeKey was already sent.
const insertOnce = async (docs) => {
  if (!docs.length) return 0;
  try {
    return (await Notification.insertMany(docs, { ordered: false })).length;
  } catch (error) {
    const errors = error.writeErrors || [];
    if (error.code === 11000 || (errors.length && errors.every((item) => (item.code ?? item.err?.code) === 11000))) {
      return error.insertedDocs?.length ?? (docs.length - errors.length);
    }
    throw error;
  }
};

const departmentPatterns = async (departments) => {
  return (await allCourses()).filter((course) => departments.includes(course.department))
    .map((course) => codePattern(course.code));
};

// Students whose term exam is within 3 days and who are not cleared for it.
const studentExamReminders = async (now = new Date()) => {
  const schedules = await TermSchedule.find({
    examDate: { $gte: new Date(now.getTime() - DAY), $lte: new Date(now.getTime() + STUDENT_DAYS_BEFORE * DAY) },
  }).lean();
  const docs = [];
  for (const schedule of schedules) {
    if (manilaDayKey(new Date(schedule.examDate)) < manilaDayKey(now)) continue;
    const studentQuery = { role: "student", isActive: { $ne: false }, verificationStatus: "verified",
      semester: schedule.semester, schoolYear: schedule.schoolYear };
    if (schedule.department) {
      studentQuery.course = { $in: await departmentPatterns([schedule.department]) };
    } else {
      // A school-wide date applies only where the department has no date of its own.
      const own = await TermSchedule.distinct("department", { semester: schedule.semester,
        schoolYear: schedule.schoolYear, examType: schedule.examType, department: { $ne: null } });
      if (own.length) studentQuery.$nor = [{ course: { $in: await departmentPatterns(own) } }];
    }
    const students = await User.find(studentQuery).select("studentId name").lean();
    if (!students.length) continue;
    const cleared = new Set(await Ledger.distinct("studentId", {
      studentId: { $in: students.map((student) => student.studentId) }, [TERM_FIELD[schedule.examType]]: true,
    }));
    students.filter((student) => !cleared.has(student.studentId)).forEach((student) => docs.push({
      studentId: student.studentId, studentName: student.name, recipientRole: "student",
      title: "Exam Coming Up - Not Cleared",
      message: `Your ${schedule.examType} exam is on ${phDate(schedule.examDate)}. You are not yet cleared to take it. Upload your payment receipt or pay at the cashier.`,
      dedupeKey: `exam-due:${schedule._id}:${student.studentId}`,
    }));
  }
  return insertOnce(docs);
};

// One daily summary per Admin: exams without a proctor, students waiting.
const adminDigests = async (now = new Date()) => {
  const admins = await User.find({ role: "admin", isActive: { $ne: false }, department: { $exists: true, $ne: null } })
    .select("_id department").lean();
  const day = manilaDayKey(now);
  const docs = [];
  for (const admin of admins) {
    const req = adminReq(admin.department);
    const [noProctor, waiting] = await Promise.all([
      Exam.countDocuments({ status: { $ne: "Cancelled" },
        examDate: { $gte: now, $lte: new Date(now.getTime() + PROCTOR_WINDOW_DAYS * DAY) },
        $and: [await courseScope(req, "course", { includeUnassigned: true }), MISSING_PROCTOR] }),
      User.countDocuments({ role: "student", verificationStatus: "pending",
        createdAt: { $lt: new Date(now.getTime() - PENDING_WAIT_DAYS * DAY) }, $and: [await courseScope(req)] }),
    ]);
    if (noProctor > 0) docs.push({ recipientRole: "admin", recipientUserId: admin._id, title: "Exams Without Proctor",
      message: `${noProctor} exam(s) in the next ${PROCTOR_WINDOW_DAYS} days have no proctor yet.`,
      dedupeKey: `no-proctor:${admin._id}:${day}` });
    if (waiting > 0) docs.push({ recipientRole: "admin", recipientUserId: admin._id, title: "Students Waiting for Verification",
      message: `${waiting} student(s) have been waiting more than ${PENDING_WAIT_DAYS} days for verification.`,
      dedupeKey: `pending-wait:${admin._id}:${day}` });
  }
  return insertOnce(docs);
};

// Deletes notifications older than ~6 months that have been read. Unread ones
// are kept until read. Shared cashier / Super Admin notices count as read once
// every active user of that role has read them.
const cleanupOldNotifications = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - KEEP_DAYS * DAY);
  let deleted = (await Notification.deleteMany({ createdAt: { $lt: cutoff }, read: true })).deletedCount || 0;
  for (const role of ["cashier", "super_admin"]) {
    const people = await User.countDocuments({ role, isActive: { $ne: false } });
    if (!people) continue;
    deleted += (await Notification.deleteMany({ recipientRole: role, recipientUserId: { $in: [null] },
      createdAt: { $lt: cutoff }, $expr: { $gte: [{ $size: { $ifNull: ["$readBy", []] } }, people] } })).deletedCount || 0;
  }
  return deleted;
};

let running = false;
let lastCleanupDay = "";

const runReminders = async (now = new Date()) => {
  if (running) return null;
  running = true;
  try {
    const result = { studentReminders: await studentExamReminders(now), adminDigests: await adminDigests(now) };
    const day = manilaDayKey(now);
    if (day !== lastCleanupDay) {
      result.cleanedUp = await cleanupOldNotifications(now);
      lastCleanupDay = day;
    }
    return result;
  } catch (error) {
    console.log(`Reminder run failed: ${error.message}`);
    return null;
  } finally {
    running = false;
  }
};

// Runs a minute after start-up, then every hour.
const startReminderJobs = () => {
  setTimeout(runReminders, 60 * 1000).unref();
  setInterval(runReminders, HOUR).unref();
};

module.exports = { runReminders, startReminderJobs, studentExamReminders, adminDigests, cleanupOldNotifications, insertOnce };
