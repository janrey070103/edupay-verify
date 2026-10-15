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
    if (!studentId || !name || !email || !password || !course ||
        !Number.isInteger(Number(yearLevel)) || Number(yearLevel) < 1 || Number(yearLevel) > 6 ||
        !["1st Semester", "2nd Semester", "Summer"].includes(semester) ||
        !/^\d{4}-\d{4}$/.test(String(schoolYear || "")) ||
        Number(String(schoolYear).slice(5)) !== Number(String(schoolYear).slice(0, 4)) + 1) {
      return res.status(400).json({
        message: "Complete the required account and academic information.",
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
    // Student accounts start as "pending" and require admin verification
    const user = await User.create({
      studentId,
      name,
      email,
      password: hashedPassword,
      role: "student",
      course,
      yearLevel: Number(yearLevel),
      semester,
      schoolYear,
      verificationStatus: "pending",
    });

    const Notification = require("../Models/Notification");
    await Notification.create({
      studentId: user.studentId,
      studentName: user.name,
      recipientRole: "super_admin",
      title: "New Student Registration",
      message: `${user.name} (${user.studentId}) has registered and is pending verification.`,
    });

    // Do NOT issue a JWT — account must be verified by admin first
    res.status(201).json({
      message:
        "Registration successful! Your account is pending admin verification. You will be notified once approved.",
      user: {
        id: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
        verificationStatus: user.verificationStatus,
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

    // Verification gate — applies to student role only
    if (user.role === "student") {
      if (user.verificationStatus === "pending") {
        return res.status(403).json({
          message: "Your account is awaiting admin verification.",
          verificationStatus: "pending",
        });
      }

      if (user.verificationStatus === "rejected") {
        const reason = user.rejectionReason
          ? ` Reason: ${user.rejectionReason}`
          : "";
        return res.status(403).json({
          message: `Your account registration was rejected by the admin.${reason}`,
          verificationStatus: "rejected",
        });
      }
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

module.exports = {
  register,
  login,
};
