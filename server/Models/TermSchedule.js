const mongoose = require("mongoose");

const termScheduleSchema = new mongoose.Schema({
  examDate: { type: Date, required: true },
  semester: { type: String, required: true },
  schoolYear: { type: String, required: true },
  examType: { type: String, enum: ["Prelim", "Midterm", "PreFinal", "Final"], required: true },
  status: { type: String, enum: ["Published"], default: "Published" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

termScheduleSchema.index({ semester: 1, schoolYear: 1, examType: 1 }, { unique: true });
module.exports = mongoose.model("TermSchedule", termScheduleSchema);
