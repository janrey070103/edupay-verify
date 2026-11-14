const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    examDate: {
      type: Date,
      required: true,
    },

    examType: {
      type: String,
      enum: ["Prelim", "Midterm", "PreFinal", "Final"],
      required: true,
    },

    // Regular exams fall inside the term's 4-day exam period; Special exams
    // (make-ups) can only be scheduled after that period ends.
    examKind: {
      type: String,
      enum: ["Regular", "Special"],
      default: "Regular",
    },

    subject: {
      type: String,
      required: true,
    },

    subjectCode: {
      type: String,
      required: true,
    },

    schedule: {
      type: String,
      required: true,
    },

    startTime: {
      type: String,
      required: false,
    },

    endTime: {
      type: String,
      required: false,
    },

    room: {
      type: String,
      required: false,
    },

    capacity: {
      type: Number,
      required: false,
    },

    // Course code from the catalogue; decides which department's Admins manage
    // the exam. Older exams have none and are shown to every Admin until set.
    course: {
      type: String,
      required: false,
    },

    courseYear: {
      type: Number,
      required: false,
    },

    courseSection: {
      type: String,
      required: false,
    },

    proctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    proctorName: {
      type: String,
      required: false,
    },

    proctorEmail: {
      type: String,
      required: false,
    },

    // Optional: the same exam given to several sections at once, each with its
    // own proctor and room (e.g. BSIT-1A, BSIT-1B). Empty = one proctor for the
    // whole exam (proctorId above).
    sections: {
      type: [{
        name: { type: String, required: true, trim: true },
        room: { type: String, trim: true },
        proctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        proctorName: String,
        proctorEmail: String,
      }],
      default: [],
    },

    status: {
      type: String,
      enum: ["Scheduled", "In Progress", "Completed", "Cancelled"],
      default: "Scheduled",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying by date and type
examSchema.index({ examDate: 1, examType: 1 });
examSchema.index({ proctorId: 1 });
examSchema.index({ "sections.proctorId": 1 });
examSchema.index({ subjectCode: 1 });
examSchema.index({ courseYear: 1, courseSection: 1 });
examSchema.index({ course: 1, examDate: 1 });

module.exports = mongoose.model("Exam", examSchema);
