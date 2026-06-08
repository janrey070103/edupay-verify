const User = require("../Models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Register (public sign-up — always creates student accounts only)
const register = async (req, res) => {
  try {
    const {
      studentId,
      name,
      email,
      password,
      course,
      yearLevel,
      semester,
      schoolYear,
    } = req.body;

    // Validate required fields
    if (!studentId || !name || !email || !password) {
      return res.status(400).json({
        message: "Student ID, name, email, and password are required.",
      });
    }

    // Check for existing user by email or studentId
    const existingUser = await User.findOne({
      $or: [{ email }, { studentId }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: "Email already registered." });
      }
      return res.status(400).json({ message: "Student ID already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Force role to "student" — other roles are created by super_admin only
    const user = await User.create({
      studentId,
      name,
      email,
      password: hashedPassword,
      role: "student",
      course,
      yearLevel,
      semester,
      schoolYear,
    });

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(201).json({
      token,
      role: user.role,
      user: {
        id: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid Credentials",
      });
    }

    // Check if account is deactivated
    if (user.isActive === false) {
      return res.status(403).json({
        message: "Account deactivated. Contact administrator.",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid Credentials",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(200).json({
      token,
      role: user.role,
      user,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  register,
  login,
};
