
const User = require("../Models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { readNameParts, nameProblem, fullName, validStudentId, studentEmail } = require("../utils/personName");
const { courseProblem } = require("../utils/courseRules");
const { findCourse } = require("../services/catalogService");
const { currentSchoolYear } = require("../config/schoolYear");

// Register (public sign-up — always creates student accounts only)
const register = async (req, res) => {
  try {
    // The school year is always the current one (real time), whatever was sent.
    req.body.schoolYear = currentSchoolYear();
    const {
      password,
      course,
      yearLevel,
      semester,
      schoolYear,
    } = req.body;
    const studentId = String(req.body.studentId ?? "").trim();
    const nameParts = readNameParts(req.body);
    const nameError = nameProblem(nameParts);
    if (nameError) return res.status(400).json({ message: nameError });
    if (!validStudentId(studentId)) {
      return res.status(400).json({ message: "Enter the Student ID in the format 23-1681-428." });
    }
    // The institutional email is built from the last name, extension and ID.
    const email = studentEmail({ ...nameParts, studentId });

    // Validate required fields
    if (!studentId || !email || !password || !course ||
        !Number.isInteger(Number(yearLevel)) || Number(yearLevel) < 1 || Number(yearLevel) > 6 ||
        !["1st Semester", "2nd Semester"].includes(semester) ||
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

    const courseError = await courseProblem(course);
    if (courseError) return res.status(400).json({ message: courseError });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Force role to "student" — other roles are created by super_admin only
    // Student accounts start as "pending" and require admin verification
    const user = await User.create({
      studentId,
      ...nameParts,
      middleName: nameParts.middleName || undefined,
      nameExtension: nameParts.nameExtension || undefined,
      name: fullName(nameParts),
      email,
      password: hashedPassword,
      role: "student",
      course,
      yearLevel: Number(yearLevel),
      semester,
      schoolYear,
      verificationStatus: "pending",
    });

    // The department's Admins act on it; the Super Admin is informed only.
    const Notification = require("../Models/Notification");
    const courseInfo = await findCourse(user.course);
    const admins = !courseInfo ? [] : await User.find({ role: "admin", isActive: { $ne: false }, department: courseInfo.department })
      .select("_id");
    const base = { studentId: user.studentId, studentName: user.name, title: "New Student Registration" };
    await Notification.insertMany([
      { ...base, recipientRole: "super_admin",
        message: `${user.studentId} - ${user.name} (${user.course}) registered and is waiting for ${courseInfo?.department || "department"} Admin verification.` },
      ...admins.map((admin) => ({ ...base, recipientRole: "admin", recipientUserId: admin._id,
        message: `${user.studentId} - ${user.name} (${user.course}) registered and is pending your verification.` })),
    ]);

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

// Any logged-in user changes their own password; the current one is required.
const changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Enter your current password and a new password." });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from the current one." });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (!await bcrypt.compare(currentPassword, user.password)) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ message: "Password changed." });
  } catch (error) {
    return res.status(500).json({ message: "Could not change the password." });
  }
};

module.exports = {
  register,
  login,
  changeMyPassword,
};
