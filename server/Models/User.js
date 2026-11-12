const mongoose = require("mongoose");
const { DEPARTMENT_CODES } = require("../config/catalog");

const userSchema = new mongoose.Schema(
  {
    studentId: { type: String, default: undefined },

    // Full display name, derived from the parts below when they are set.
    name: {
      type: String,
      required: true,
    },

    firstName: { type: String, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, trim: true },

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

    // Course code from the catalogue (older accounts may hold free text).
    course: String,

    // Admins only: the one department they manage.
    department: { type: String, enum: DEPARTMENT_CODES },

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
// Directory listing, pending queue, and name ordering.
userSchema.index({ createdAt: -1, _id: -1 });
userSchema.index({ role: 1, verificationStatus: 1, createdAt: -1, _id: -1 });
userSchema.index({ name: 1, _id: 1 });
userSchema.index({ lastName: 1, firstName: 1, _id: 1 });
// Department-scoped pending-student queue for Admins.
userSchema.index({ role: 1, verificationStatus: 1, course: 1, createdAt: -1 });
// The system allows exactly one super admin account; the database enforces it
// even if two requests race past the controller check.
userSchema.index({ role: 1 }, { unique: true, name: "uniq_single_super_admin",
  partialFilterExpression: { role: "super_admin" } });

// Keep `name` in sync whenever name parts are present.
userSchema.pre("validate", function syncFullName() {
  if (this.firstName || this.lastName) {
    this.name = [this.firstName, this.middleName, this.lastName].filter(Boolean).join(" ");
  }
});

module.exports =
  mongoose.model("User", userSchema);
