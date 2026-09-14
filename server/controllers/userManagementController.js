const User = require("../Models/User");
const Notification = require("../Models/Notification");
const bcrypt = require("bcryptjs");

const ALLOWED_ROLES = ["student", "cashier", "admin", "teacher"];

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

// POST create new user (cannot create super_admin)
const createUser = async (req, res) => {
  try {
    const { studentId, name, email, password, role, course, yearLevel, semester, schoolYear } = req.body;

    // Validate required fields
    if (!studentId || !name || !email || !password) {
      return res.status(400).json({ message: "studentId, name, email, and password are required." });
    }

    // Check for duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already exists." });
    }

    // Force-override: cannot create super_admin
    const safeRole = ALLOWED_ROLES.includes(role) ? role : "student";

    const hashedPassword = await bcrypt.hash(password, 10);

    // Users created by super_admin are auto-verified
    const user = await User.create({
      studentId,
      name,
      email,
      password: hashedPassword,
      role: safeRole,
      course,
      yearLevel,
      semester,
      schoolYear,
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
        title: "Welcome to EduPay Verify",
        message: `Your ${safeRole} account has been created by the administrator. You can now log in and start using the system.`,
      });
    }

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH update user (cannot assign super_admin role)
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

    // Check duplicate email (if changing)
    if (email && email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ message: "Email already exists." });
      }
    }

    // Cannot assign super_admin role
    if (role !== undefined) {
      user.role = ALLOWED_ROLES.includes(role) ? role : user.role;
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (studentId !== undefined) user.studentId = studentId;
    if (course !== undefined) user.course = course;
    if (yearLevel !== undefined) user.yearLevel = yearLevel;
    if (semester !== undefined) user.semester = semester;
    if (schoolYear !== undefined) user.schoolYear = schoolYear;
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
