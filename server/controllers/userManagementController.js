const User = require("../Models/User");
const Notification = require("../Models/Notification");
const bcrypt = require("bcryptjs");
const Payment = require("../Models/Payments");
const Ledger = require("../Models/Ledger");
const ExamPermit = require("../Models/ExamPermit");

const ALLOWED_ROLES = ["student", "cashier", "admin", "teacher", "super_admin"];
const validEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || ""));
const validAcademics = ({ course, yearLevel, semester, schoolYear }) =>
  Boolean(String(course || "").trim() && Number.isInteger(Number(yearLevel)) && Number(yearLevel) >= 1 &&
    Number(yearLevel) <= 6 && ["1st Semester", "2nd Semester", "Summer"].includes(semester) &&
    /^\d{4}-\d{4}$/.test(String(schoolYear || "")) &&
    Number(String(schoolYear).slice(5)) === Number(String(schoolYear).slice(0, 4)) + 1);

// GET all users (excluding passwords)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET pending students (verificationStatus === "pending")
const getPendingStudents = async (req, res) => {
  try {
    const students = await User.find({
      role: "student",
      verificationStatus: "pending",
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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

    if (user.verificationStatus === "verified") {
      return res.status(400).json({ message: "Student is already verified." });
    }

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
    const { studentId, name, email, password, role, course, yearLevel, semester, schoolYear } = req.body;

    // Validate required fields
    if (!String(name || "").trim() || !validEmail(email) || !password || password.length < 6 || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: "Choose a role and enter a name, valid email, and password of at least 6 characters." });
    }
    if (role === "student" && (!studentId || !validAcademics(req.body))) {
      return res.status(400).json({ message: "Student ID and valid academic details are required." });
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
      name,
      email,
      password: hashedPassword,
      role: safeRole,
      course: safeRole === "student" ? course.trim() : undefined,
      yearLevel: safeRole === "student" ? Number(yearLevel) : undefined,
      semester: safeRole === "student" ? semester.trim() : undefined,
      schoolYear: safeRole === "student" ? schoolYear.trim() : undefined,
      isActive: true,
      verificationStatus: "verified",
    });

    const result = user.toObject();
    delete result.password;

    // Send a welcome notification to the new user
    if (["student", "cashier", "teacher"].includes(safeRole)) {
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
    res.status(500).json({ message: error.message });
  }
};

// PATCH update user
const updateUser = async (req, res) => {
  try {
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

    if (role !== undefined) {
      user.role = ALLOWED_ROLES.includes(role) ? role : user.role;
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (studentId !== undefined) user.studentId = studentId || undefined;
    if (user.role === "student") {
      const academic = { course: course ?? user.course, yearLevel: yearLevel ?? user.yearLevel,
        semester: semester ?? user.semester, schoolYear: schoolYear ?? user.schoolYear };
      if (!user.studentId || !validAcademics(academic)) return res.status(400).json({ message: "Student ID and valid academic details are required." });
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

// PATCH deactivate user (soft delete — cannot deactivate self)
const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Cannot deactivate yourself
    if (req.user.id === id) {
      return res.status(400).json({ message: "You cannot deactivate your own account." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.isActive = false;
    await user.save();

    // Notify the user that their account has been deactivated
    if (["student", "cashier", "teacher"].includes(user.role)) {
      await Notification.create({
        studentId: user.studentId,
        studentName: user.name,
        recipientRole: user.role,
        recipientUserId: user._id,
        title: "Account Deactivated",
        message: "Your account has been deactivated by the administrator. Please contact support if you believe this is an error.",
      });
    }

    res.json({ message: "User deactivated successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Search for students by ID or name (for cashier direct payment validation)
const searchStudents = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ message: "Search query is required." });
    }

    const students = await User.find({
      role: "student",
      $or: [
        { studentId: { $regex: query, $options: "i" } },
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    })
      .select("-password")
      .limit(10);

    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllUsers,
  getPendingStudents,
  verifyStudent,
  rejectStudent,
  createUser,
  updateUser,
  resetUserPassword,
  deactivateUser,
  searchStudents,
};
