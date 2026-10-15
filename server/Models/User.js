const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    studentId: { type: String, default: undefined },

    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: [
        "student",
        "cashier",
        "admin",
        "teacher",
        "super_admin",
      ],
      default: "student",
    },

    course: String,

    yearLevel: Number,

    semester: String,

    schoolYear: String,

    isActive: {
      type: Boolean,
      default: true,
    },

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "verified",
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    verifiedAt: {
      type: Date,
      required: false,
    },

    rejectionReason: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);
userSchema.index({ studentId: 1 }, { unique: true, name: "uniq_student_account_id",
  partialFilterExpression: { role: "student", studentId: { $type: "string" } } });

module.exports =
  mongoose.model("User", userSchema);
