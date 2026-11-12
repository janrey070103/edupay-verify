const mongoose = require("mongoose");
const { DEPARTMENT_CODES } = require("../config/catalog");

// One published date per term, semester and school year for each department.
// Rows without a department were published school-wide before departments
// existed; they apply to students whose department has not published its own.
const termScheduleSchema = new mongoose.Schema({
  examDate: { type: Date, required: true },
  semester: { type: String, required: true },
  schoolYear: { type: String, required: true },
  examType: { type: String, enum: ["Prelim", "Midterm", "PreFinal", "Final"], required: true },
  department: { type: String, enum: DEPARTMENT_CODES },
  status: { type: String, enum: ["Published"], default: "Published" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

termScheduleSchema.index({ semester: 1, schoolYear: 1, examType: 1, department: 1 },
  { unique: true, name: "uniq_term_per_department" });
module.exports = mongoose.model("TermSchedule", termScheduleSchema);
