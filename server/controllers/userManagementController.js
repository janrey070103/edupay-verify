const User = require("../Models/User");
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
    });

    const result = user.toObject();
    delete result.password;

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH update user (cannot assign super_admin role)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, studentId, role, course, yearLevel, semester, schoolYear } = req.body;

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

    await user.save();

    const result = user.toObject();
    delete result.password;

    res.json(result);
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

    res.json({ message: "User deactivated successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deactivateUser,
};
