const User = require("../Models/User");
const Notification = require("../Models/Notification");
const bcrypt = require("bcryptjs");
const Payment = require("../Models/Payments");
const Ledger = require("../Models/Ledger");
const ExamPermit = require("../Models/ExamPermit");
const { escapeRegex, paginate, readDateRange, readPaging, readSort } = require("../utils/pagination");
const { hasNameParts, readNameParts, nameProblem, validStudentId, studentEmail } = require("../utils/personName");
const { courseScope, inScope, resolveCourse, allCoursePatterns } = require("../utils/adminScope");

// Students whose stored course matches no catalogue course (old typed values).
// No Admin sees them; the Super Admin corrects them in User Management.
const unlistedCourseFilter = async () => ({ role: "student", $nor: [{ course: { $in: await allCoursePatterns() } }] });
const { courseProblem } = require("../utils/courseRules");
const { DEPARTMENT_CODES } = require("../config/catalog");
const { settleRegistrationNotices: settleNotices } = require("../services/registrationNotices");

const DEPARTMENT_REQUIRED = "Choose the department this Admin manages.";
const OUT_OF_SCOPE = "This student belongs to another department.";

const SUPER_ADMIN_TAKEN = "Only one Super Admin account is allowed.";

const { currentSchoolYear } = require("../config/schoolYear");

const ALLOWED_ROLES = ["student", "cashier", "admin", "teacher", "super_admin"];
const validEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || ""));
const validAcademics = ({ course, yearLevel, semester, schoolYear }) =>
  Boolean(String(course || "").trim() && Number.isInteger(Number(yearLevel)) && Number(yearLevel) >= 1 &&
    Number(yearLevel) <= 4 && ["1st Semester", "2nd Semester"].includes(semester) &&
    /^\d{4}-\d{4}$/.test(String(schoolYear || "")) &&
    Number(String(schoolYear).slice(5)) === Number(String(schoolYear).slice(0, 4)) + 1);

// GET all users (excluding passwords)
const getAllUsers = async (req, res) => {
  try {
    // Filters other than role; role counts for the pills are computed on these.
    const base = {};
    const created = readDateRange(req.query);
    if (created) base.createdAt = created;
    const search = String(req.query.search || "").trim().slice(0, 64);
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      base.$or = [{ name: pattern }, { firstName: pattern }, { lastName: pattern },
        { email: pattern }, { studentId: pattern }];
    }
    const role = ALLOWED_ROLES.includes(req.query.role) ? req.query.role : "";
    const courseIssue = req.query.courseIssue === "1";
    // "Course not in list" only applies to students; asking for it together with
    // another role is a contradiction, so it matches nothing instead of silently
    // switching to students.
    const query = { ...base,
      ...(courseIssue ? await unlistedCourseFilter() : {}),
      ...(role ? { role: courseIssue && role !== "student" ? "__none__" : role } : {}) };
    const paging = readPaging(req.query, { limit: 25 });
    let sort = readSort(req.query, ["name", "createdAt", "email", "role"], "createdAt", "desc");
    if (req.query.sort === "name") {
      // Name ordering is surname first; `name` breaks ties for older accounts
      // that were created before separate name fields existed.
      const direction = sort.name;
      sort = { lastName: direction, firstName: direction, name: direction, _id: direction };
    }
    // Case-insensitive ordering matches the previous client-side name sort.
    const collation = req.query.sort === "name" ? { locale: "en", strength: 1 } : undefined;
    const [result, grouped] = await Promise.all([
      paginate(User, query, paging, sort, { select: "-password", collation }),
      User.aggregate([{ $match: courseIssue ? { ...base, ...await unlistedCourseFilter() } : base },
        { $group: { _id: "$role", count: { $sum: 1 } } }]),
    ]);
    // Per-role totals under the current date/search filters, for the role pills.
    const roleCounts = Object.fromEntries(ALLOWED_ROLES.map((item) => [item, 0]));
    grouped.forEach((row) => { if (row._id in roleCounts) roleCounts[row._id] = row.count; });
    roleCounts.all = grouped.reduce((sum, row) => sum + row.count, 0);
    res.json({ ...result, meta: { ...result.meta, roleCounts } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserSummary = async (_req, res) => {
  try {
    const [totalUsers, activeStudents, pendingStudents, unlistedCourse] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "student", isActive: { $ne: false } }),
      User.countDocuments({ role: "student", verificationStatus: "pending" }),
      User.countDocuments(await unlistedCourseFilter()),
    ]);
    res.json({ totalUsers, activeStudents, pendingStudents, unlistedCourse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET pending students (verificationStatus === "pending")
const getPendingStudents = async (req, res) => {
  try {
    // Each Admin sees only students of courses in their department.
    const query = { role: "student", verificationStatus: "pending", $and: [await courseScope(req)] };
    const search = String(req.query.search || "").trim().slice(0, 64);
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      query.$and.push({ $or: [{ name: pattern }, { firstName: pattern }, { lastName: pattern },
        { email: pattern }, { studentId: pattern }] });
    }
    const created = readDateRange(req.query);
    if (created) query.createdAt = created;
    const paging = readPaging(req.query, { limit: 20 });
    // Newest registrations first by default.
    const sort = readSort(req.query, ["name", "createdAt", "email"], "createdAt", "desc");
    res.json(await paginate(User, query, paging, sort, { select: "-password" }));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Once a pending student is verified or rejected, every Admin / Super Admin
// "New Student Registration" notice about them is rewritten so nobody acts on
// a request that is already settled. The student's decision is already saved,
// so a failure here is only logged (the next notifications load retries it).
const settleRegistrationNotices = async (user, status, actor) => {
  try {
    await settleNotices(user, status, actor);
  } catch (error) {
    console.error("Could not update registration notifications:", error.message);
  }
};

const actorOf = async (req) => {
  try { return (await User.findById(req.user.id).select("name role").lean()) || {}; } catch { return {}; }
};

// PATCH verify/approve a student
const verifyStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.role !== "student") {
      return res.status(400).json({ message: "Only student accounts can be verified." });
    }
    if (!await inScope(req, user.course)) return res.status(403).json({ message: OUT_OF_SCOPE });

    if (user.verificationStatus === "verified") {
      return res.status(400).json({ message: "Student is already verified." });
    }

    // Store the official code when an older typed value was matched ("BPED" -> "BPEd").
    const officialCourse = await resolveCourse(user.course);
    if (officialCourse && officialCourse.code !== user.course) user.course = officialCourse.code;

    user.verificationStatus = "verified";
    user.verifiedBy = req.user.id;
    user.verifiedAt = new Date();
    user.rejectionReason = undefined;
    await user.save();

    // Create notification for the student
    await Notification.create({
      studentId: user.studentId,
      studentName: user.name,
      recipientRole: "student",
      title: "Account Verified",
      message: "Your account has been verified by the admin. You can now log in and use EduPay Verify.",
    });
    await settleRegistrationNotices(user, "verified", await actorOf(req));

    const result = user.toObject();
    delete result.password;

    res.json({ message: "Student verified successfully.", user: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH reject a student
const rejectStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.role !== "student") {
      return res.status(400).json({ message: "Only student accounts can be rejected." });
    }
    if (!await inScope(req, user.course)) return res.status(403).json({ message: OUT_OF_SCOPE });

    if (user.verificationStatus === "rejected") {
      return res.status(400).json({ message: "Student is already rejected." });
    }

    user.verificationStatus = "rejected";
    user.verifiedBy = req.user.id;
    user.verifiedAt = new Date();
    user.rejectionReason = rejectionReason || undefined;
    await user.save();

    // Create notification for the student
    const reasonText = rejectionReason
      ? ` Reason: ${rejectionReason}`
      : "";
    await Notification.create({
      studentId: user.studentId,
      studentName: user.name,
      recipientRole: "student",
      title: "Account Rejected",
      message: `Your account registration has been rejected by the admin.${reasonText}`,
    });
    await settleRegistrationNotices(user, "rejected", await actorOf(req));

    const result = user.toObject();
    delete result.password;

    res.json({ message: "Student rejected.", user: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST create a user (only an authenticated super admin can reach this route)
const createUser = async (req, res) => {
  try {
    // The school year is always the current one (real time), whatever was sent.
    req.body.schoolYear = currentSchoolYear();
    const { password, role, course, yearLevel, semester, schoolYear } = req.body;
    const studentId = String(req.body.studentId ?? "").trim();
    const nameParts = readNameParts(req.body);

    // Validate required fields
    const nameError = nameProblem(nameParts);
    if (nameError) return res.status(400).json({ message: nameError });
    if (role !== "student" && !studentId) return res.status(400).json({ message: "Employee ID is required." });
    if (role === "student" && !validStudentId(studentId)) {
      return res.status(400).json({ message: "Enter the Student ID in the format 12-3456-789." });
    }
    // Student emails follow the institutional format; staff emails are typed in.
    const email = role === "student" ? studentEmail({ ...nameParts, studentId }) : String(req.body.email ?? "").trim().toLowerCase();
    if (!validEmail(email) || !password || password.length < 6 || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: "Choose a role and enter a valid email and a password of at least 6 characters." });
    }
    if (role === "student" && (!studentId || !validAcademics(req.body))) {
      return res.status(400).json({ message: "Student ID and valid academic details are required." });
    }
    if (role === "student") {
      const problem = await courseProblem(req.body.course);
      if (problem) return res.status(400).json({ message: problem });
    }
    if (role === "admin" && !DEPARTMENT_CODES.includes(req.body.department)) {
      return res.status(400).json({ message: DEPARTMENT_REQUIRED });
    }
    if (role === "teacher" && req.body.department && !DEPARTMENT_CODES.includes(req.body.department)) {
      return res.status(400).json({ message: "Choose a valid department." });
    }
    if (role === "super_admin" && await User.exists({ role: "super_admin" })) {
      return res.status(409).json({ message: SUPER_ADMIN_TAKEN });
    }
    if (studentId && await User.exists({ studentId })) return res.status(409).json({ message: "ID already exists." });

    // Check for duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already exists." });
    }

    // Role has already been checked against the supported list.
    const safeRole = role;

    const hashedPassword = await bcrypt.hash(password, 10);

    // Users created by super_admin are auto-verified
    const user = await User.create({
      studentId: studentId || undefined,
      ...nameParts,
      middleName: nameParts.middleName || undefined,
      nameExtension: nameParts.nameExtension || undefined,
      name: [nameParts.firstName, nameParts.middleName, nameParts.lastName, nameParts.nameExtension].filter(Boolean).join(" "),
      email,
      password: hashedPassword,
      role: safeRole,
      course: safeRole === "student" ? course.trim() : undefined,
      department: safeRole === "admin" || (safeRole === "teacher" && req.body.department) ? req.body.department : undefined,
      yearLevel: safeRole === "student" ? Number(yearLevel) : undefined,
      semester: safeRole === "student" ? semester.trim() : undefined,
      schoolYear: safeRole === "student" ? schoolYear.trim() : undefined,
      isActive: true,
      verificationStatus: "verified",
    });

    const result = user.toObject();
    delete result.password;

    // Send a welcome notification to the new user
    if (["student", "cashier", "teacher", "admin"].includes(safeRole)) {
      await Notification.create({
        studentId: user.studentId,
        studentName: user.name,
        recipientRole: safeRole,
        recipientUserId: user._id,
        title: "Welcome to EduPay Verify",
        message: `Your ${safeRole} account has been created by the administrator. You can now log in and start using the system.`,
      });
    }

    res.status(201).json(result);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.role) return res.status(409).json({ message: SUPER_ADMIN_TAKEN });
    res.status(500).json({ message: error.message });
  }
};

// PATCH update user
const updateUser = async (req, res) => {
  try {
    // The school year is always the current one (real time), whatever was sent.
    req.body.schoolYear = currentSchoolYear();
    if (req.body.email !== undefined) req.body.email = String(req.body.email).trim().toLowerCase();
    const { id } = req.params;
    const {
      name,
      email,
      studentId,
      role,
      course,
      yearLevel,
      semester,
      schoolYear,
      password,
    } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    if ((email !== undefined && !validEmail(email)) || (password && password.length < 6)) {
      return res.status(400).json({ message: "Enter a valid email and a password of at least 6 characters." });
    }
    if (user.role === "student" && ((studentId !== undefined && studentId !== user.studentId) ||
        (role !== undefined && role !== "student"))) {
      const hasRecords = await Promise.all([
        Payment.exists({ studentId: user.studentId }), Ledger.exists({ studentId: user.studentId }),
        ExamPermit.exists({ studentId: user.studentId }),
      ]);
      if (hasRecords.some(Boolean)) return res.status(409).json({ message: "Student ID or role cannot change while financial or permit records exist." });
    }
    const nextRole = role !== undefined && ALLOWED_ROLES.includes(role) ? role : user.role;
    if (nextRole === "student" && studentId !== undefined && studentId !== user.studentId && !validStudentId(studentId)) {
      return res.status(400).json({ message: "Enter the Student ID in the format 12-3456-789." });
    }
    if (studentId && studentId !== user.studentId && await User.exists({ studentId, _id: { $ne: id } })) {
      return res.status(409).json({ message: "ID already exists." });
    }

    // Check duplicate email (if changing)
    if (email && email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ message: "Email already exists." });
      }
    }

    // Exactly one super admin: it cannot be demoted, and nobody else can be promoted.
    if (role !== undefined && role !== user.role) {
      if (user.role === "super_admin") {
        return res.status(409).json({ message: "The Super Admin's role cannot be changed." });
      }
      if (role === "super_admin" && await User.exists({ role: "super_admin", _id: { $ne: id } })) {
        return res.status(409).json({ message: SUPER_ADMIN_TAKEN });
      }
    }

    if (role !== undefined) {
      user.role = ALLOWED_ROLES.includes(role) ? role : user.role;
    }

    // Admins manage exactly one department; a Teacher may belong to one
    // (informational only); other roles carry none.
    if (user.role === "admin") {
      const department = req.body.department !== undefined ? req.body.department : user.department;
      if (!DEPARTMENT_CODES.includes(department)) return res.status(400).json({ message: DEPARTMENT_REQUIRED });
      user.department = department;
    } else if (user.role === "teacher") {
      const department = req.body.department !== undefined ? req.body.department : user.department;
      if (department && !DEPARTMENT_CODES.includes(department)) return res.status(400).json({ message: "Choose a valid department." });
      user.department = department || undefined;
    } else {
      user.department = undefined;
    }

    if (hasNameParts(req.body)) {
      const parts = readNameParts(req.body, user);
      const nameError = nameProblem(parts, user);
      if (nameError) return res.status(400).json({ message: nameError });
      user.firstName = parts.firstName;
      user.middleName = parts.middleName || undefined;
      user.lastName = parts.lastName;
      user.nameExtension = parts.nameExtension || undefined;
    } else if (name !== undefined) {
      user.name = name;
    }
    if (email !== undefined) user.email = email;
    if (nextRole !== "student" && !String(studentId !== undefined ? studentId : user.studentId || "").trim()) {
      return res.status(400).json({ message: "Employee ID is required." });
    }
    if (studentId !== undefined) user.studentId = String(studentId).trim() || undefined;
    if (user.role === "student") {
      const academic = { course: course ?? user.course, yearLevel: yearLevel ?? user.yearLevel,
        semester: semester ?? user.semester, schoolYear: schoolYear ?? user.schoolYear };
      if (!user.studentId || !validAcademics(academic)) return res.status(400).json({ message: "Student ID and valid academic details are required." });
      // Older free-text courses may be kept as-is; any new value must be a catalogue course.
      if (course !== undefined && course !== user.course) {
        const problem = await courseProblem(academic.course);
        if (problem) return res.status(400).json({ message: problem });
      }
      if (course !== undefined) user.course = course.trim();
      if (yearLevel !== undefined) user.yearLevel = Number(yearLevel);
      if (semester !== undefined) user.semester = semester.trim();
      if (schoolYear !== undefined) user.schoolYear = schoolYear.trim();
    } else if (role && role !== "student") {
      user.course = undefined; user.yearLevel = undefined; user.semester = undefined; user.schoolYear = undefined;
    }
    if (password && password.trim() !== "") {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    const result = user.toObject();
    delete result.password;

    res.json(result);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.role) return res.status(409).json({ message: SUPER_ADMIN_TAKEN });
    res.status(500).json({ message: error.message });
  }
};

// PATCH reset password for a specific user (secure admin action)
const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.trim() === "") {
      return res.status(400).json({ message: "Password is required." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({
      message: `Password reset successfully for ${user.name}.`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH archive user (soft delete: blocks login, keeps all records; cannot archive self)
const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      return res.status(400).json({ message: "You cannot archive your own account." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    if (user.isActive === false) {
      return res.status(400).json({ message: "User is already archived." });
    }

    user.isActive = false;
    await user.save();

    if (["student", "cashier", "teacher", "admin"].includes(user.role)) {
      await Notification.create({
        studentId: user.studentId,
        studentName: user.name,
        recipientRole: user.role,
        recipientUserId: user._id,
        title: "Account Archived",
        message: "Your account has been archived by the administrator. Please contact support if you believe this is an error.",
      });
    }

    res.json({ message: "User archived successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH unarchive user: restores login with the same records.
const activateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.isActive !== false) return res.status(400).json({ message: "User is not archived." });

    user.isActive = true;
    await user.save();

    if (["student", "cashier", "teacher", "admin"].includes(user.role)) {
      await Notification.create({
        studentId: user.studentId,
        studentName: user.name,
        recipientRole: user.role,
        recipientUserId: user._id,
        title: "Account Restored",
        message: "Your account has been restored by the administrator. You can log in again.",
      });
    }

    res.json({ message: "User unarchived successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Active teachers for proctor assignment (department Admins). Teachers are not
// department-scoped: any active teacher can proctor any exam.
const listTeachers = async (_req, res) => {
  try {
    const teachers = await User.find({ role: "teacher", isActive: { $ne: false } })
      .select("name firstName middleName lastName nameExtension email studentId department").sort({ lastName: 1, name: 1 }).limit(500).lean();
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ message: "Could not load teachers." });
  }
};

// Search for students by ID or name (for cashier direct payment validation)
const searchStudents = async (req, res) => {
  try {
    const query = String(req.query.query || "").trim().slice(0, 64);
    if (query.length < 2) {
      return res.status(400).json({ message: "Type at least 2 characters to search." });
    }

    // Typed text is matched literally (escaped), never run as a pattern.
    const pattern = new RegExp(escapeRegex(query), "i");
    const students = await User.find({
      role: "student",
      $or: [{ studentId: pattern }, { name: pattern }, { firstName: pattern }, { lastName: pattern }, { email: pattern }],
    })
      .select("studentId name firstName middleName lastName email course yearLevel semester schoolYear isActive verificationStatus")
      .sort({ lastName: 1, name: 1 })
      .limit(10);

    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllUsers,
  getUserSummary,
  getPendingStudents,
  verifyStudent,
  rejectStudent,
  createUser,
  updateUser,
  resetUserPassword,
  deactivateUser,
  activateUser,
  listTeachers,
  searchStudents,
};
