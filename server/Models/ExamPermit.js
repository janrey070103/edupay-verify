const mongoose = require("mongoose");

const scanSchema = new mongoose.Schema(
  {
    teacherId: String,
    teacherName: String,
    examType: String,
    studentId: String,
    action: {
      type: String,
      enum: ["Scanned", "Approved", "Rejected"],
      default: "Scanned",
    },
    remarks: String,
    scannedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const examPermitSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
    },
    studentName: String,
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    examType: {
      type: String,
      enum: ["Prelim", "Midterm", "PreFinal", "Final"],
      required: true,
    },
    qrToken: {
      type: String,
      required: true,
      unique: true,
    },
    permitStatus: {
      type: String,
      enum: ["Valid", "Revoked"],
      default: "Valid",
    },
    proctorDecision: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    proctorRemarks: String,
    proctorTeacherId: String,
    proctorTeacherName: String,
    proctorDecidedAt: Date,
    scans: [scanSchema],
  },
  { timestamps: true }
);

examPermitSchema.index({ studentId: 1, examType: 1 }, { unique: true });

module.exports = mongoose.model("ExamPermit", examPermitSchema);
