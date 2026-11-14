// Exam sections: one exam (same subject, date and time) given to several
// sections at once, e.g. BSIT-1A, BSIT-1B, BSIT-1C, each with its own proctor
// and room. Older exams without sections keep their single proctor until edited.
const Exam = require("../Models/Exam");
const User = require("../Models/User");
const Notification = require("../Models/Notification");

const MAX_SECTIONS = 30;
const clean = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const manilaDayKey = (value) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/** Section name: course code, year level and one letter, e.g. BSIT-1A. */
const sectionName = (course, courseYear, letter) => `${course}-${courseYear}${letter}`;
/** The section letter from what was sent: a letter, or the last character of a name. */
const sectionLetter = (raw) => String(raw?.letter ?? String(raw?.name ?? "").trim().slice(-1)).trim().toUpperCase();

/**
 * Validates the sections sent by the Admin. Every exam has at least one
 * section; each needs a single letter (A-Z), a room and a proctor. Names are
 * always built from the exam's course and year, e.g. BSIT-1A.
 * Returns { sections } (undefined when not sent) or { error }.
 */
const readSections = (input, { course, courseYear } = {}) => {
  if (input === undefined) return { sections: undefined };
  if (!Array.isArray(input)) return { error: "Sections must be a list." };
  if (!input.length) return { error: "Add at least one section with its proctor." };
  if (input.length > MAX_SECTIONS) return { error: `An exam can have at most ${MAX_SECTIONS} sections.` };
  if (!course || !(Number(courseYear) >= 1 && Number(courseYear) <= 4)) {
    return { error: "Choose the course and course year before adding sections." };
  }
  const seen = new Set();
  const sections = [];
  for (const raw of input) {
    const letter = sectionLetter(raw);
    if (!/^[A-Z]$/.test(letter)) return { error: "Each section needs one letter (A to Z), for example A for " + sectionName(course, courseYear, "A") + "." };
    const name = sectionName(course, Number(courseYear), letter);
    if (seen.has(letter)) return { error: `Section ${name} is listed twice.` };
    seen.add(letter);
    const room = clean(raw?.room, 40);
    if (!room) return { error: `Enter the room for section ${name}.` };
    const proctorId = raw?.proctorId ? String(raw.proctorId) : null;
    if (!proctorId) return { error: `Choose the proctor for section ${name}.` };
    sections.push({ ...(raw?._id ? { _id: raw._id } : {}), name, room, proctorId });
  }
  if (new Set(sections.map((section) => section.proctorId)).size !== sections.length) {
    return { error: "A teacher can proctor only one section at a time. Choose a different proctor for each section." };
  }
  return { sections };
};

const overlaps = (a, b) => {
  // Without picked times on both exams, the same day counts as a clash.
  if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return true;
  return a.startTime < b.endTime && b.startTime < a.endTime;
};

/**
 * Fills in proctor names and checks each proctor: must be an active teacher and
 * must not already proctor another exam (or section) at the same time.
 * Returns { sections } or { error }.
 */
const resolveSectionProctors = async (sections, exam) => {
  const ids = [...new Set(sections.map((section) => section.proctorId).filter(Boolean))];
  if (!ids.length) return { sections: sections.map((section) => ({ ...section, proctorId: null, proctorName: undefined, proctorEmail: undefined })) };
  const teachers = await User.find({ _id: { $in: ids }, role: "teacher", isActive: { $ne: false } }).select("name email studentId").lean();
  const byId = new Map(teachers.map((teacher) => [String(teacher._id), teacher]));
  const missing = ids.find((id) => !byId.has(id));
  if (missing) return { error: "One of the chosen proctors is not an active teacher." };

  // Same-day exams of these teachers (whole-exam or section proctor), not cancelled.
  const day = manilaDayKey(exam.examDate);
  const dayStart = new Date(`${day}T00:00:00+08:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const others = await Exam.find({
    ...(exam._id ? { _id: { $ne: exam._id } } : {}),
    status: { $ne: "Cancelled" }, examDate: { $gte: dayStart, $lt: dayEnd },
    $or: [{ proctorId: { $in: ids } }, { "sections.proctorId": { $in: ids } }],
  }).select("subjectCode schedule startTime endTime proctorId sections").lean();
  for (const id of ids) {
    const clash = others.find((other) => overlaps(exam, other) && (String(other.proctorId) === id
      || (other.sections || []).some((section) => String(section.proctorId) === id)));
    if (clash) {
      return { error: `${byId.get(id).name} already proctors ${clash.subjectCode} at ${clash.schedule} that day. Choose another teacher.` };
    }
  }
  return { sections: sections.map((section) => {
    const teacher = section.proctorId ? byId.get(section.proctorId) : null;
    return { ...section, proctorId: teacher ? teacher._id : null, proctorName: teacher?.name, proctorEmail: teacher?.email };
  }) };
};

/** Every teacher assigned to an exam: the whole-exam proctor and section proctors. */
const examProctorIds = (exam) => [...new Set([exam.proctorId, ...(exam.sections || []).map((section) => section.proctorId)]
  .filter(Boolean).map(String))];

const notifyTeacher = async (teacherId, title, message) => {
  const teacher = await User.findById(teacherId).select("name studentId").lean();
  if (!teacher) return;
  await Notification.create({ studentId: teacher.studentId, recipientUserId: teacher._id, studentName: teacher.name,
    recipientRole: "teacher", title, message });
};

/** Tells newly assigned section proctors and those who were removed. */
const notifySectionChanges = async (exam, before = []) => {
  const day = new Date(exam.examDate).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" });
  const was = new Map(before.filter((s) => s.proctorId).map((s) => [String(s.proctorId), s.name]));
  const now = new Map((exam.sections || []).filter((s) => s.proctorId).map((s) => [String(s.proctorId), s.name]));
  const wholeExam = exam.proctorId ? String(exam.proctorId) : null;
  for (const [id, name] of now) {
    if (was.get(id) !== name) {
      await notifyTeacher(id, "New Exam Assigned",
        `You have been assigned as proctor for ${exam.subject} (${exam.subjectCode}), section ${name}, on ${day} at ${exam.schedule}.`);
    }
  }
  for (const [id, name] of was) {
    if (!now.has(id) && id !== wholeExam) {
      await notifyTeacher(id, "Exam Assignment Removed",
        `Your assignment as proctor for ${exam.subject} (${exam.subjectCode}), section ${name}, on ${day} has been removed.`);
    }
  }
};

/**
 * The exam as one teacher sees it: for a section proctor, the room, section
 * and proctor name are those of their own section(s).
 */
const forTeacher = (exam, teacherId) => {
  const mine = (exam.sections || []).filter((section) => String(section.proctorId) === String(teacherId));
  if (!mine.length) return exam;
  return { ...exam, courseSection: mine.map((section) => section.name).join(", "),
    room: mine.find((section) => section.room)?.room || exam.room, proctorName: mine[0].proctorName || exam.proctorName,
    mySections: mine.map((section) => ({ name: section.name, room: section.room || exam.room || null })) };
};

/** Query for exams a teacher proctors (whole exam or one of its sections). */
const proctoredBy = (teacherId) => ({ $or: [{ proctorId: teacherId }, { "sections.proctorId": teacherId }] });

/** Exams still missing a proctor: no whole-exam proctor and no sections, or a section without one. */
const MISSING_PROCTOR = { proctorId: null, $or: [{ sections: { $exists: false } }, { sections: { $size: 0 } }, { "sections.proctorId": null }] };

module.exports = { sectionName, readSections, resolveSectionProctors, examProctorIds, notifySectionChanges, notifyTeacher,
  forTeacher, proctoredBy, MISSING_PROCTOR, MAX_SECTIONS };
