const mongoose = require("mongoose");
const { DEPARTMENT_CODES } = require("../config/catalog");

// Codes are permanent: users, exams and ledgers reference them, so a course is
// retired (`active: false`) rather than deleted.
const courseSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  department: { type: String, required: true, enum: DEPARTMENT_CODES },
  active: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

courseSchema.index({ department: 1, code: 1 });

module.exports = mongoose.model("Course", courseSchema);
