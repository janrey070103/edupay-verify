const Course = require("../Models/Course");
const { DEPARTMENTS } = require("../config/catalog");
const { allCourses, clearCourseCache } = require("../services/catalogService");

const clean = (value, max = 120) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Public: registration needs the list before anyone is logged in.
const getCatalog = async (req, res) => {
  try {
    const includeInactive = req.query.all === "1";
    const courses = (await allCourses())
      .filter((course) => includeInactive || course.active !== false)
      .sort((a, b) => a.code.localeCompare(b.code));
    return res.json({ departments: DEPARTMENTS, courses });
  } catch (error) { return res.status(500).json({ message: "Could not load courses." }); }
};

// Admin: add a course to their own department.
const createCourse = async (req, res) => {
  try {
    if (!req.user.department) return res.status(403).json({ message: "Your account has no department assigned." });
    const code = clean(req.body.code, 20).toUpperCase().replace(/\s+/g, "");
    const name = clean(req.body.name);
    if (!/^[A-Z0-9-]{2,20}$/.test(code) || !name) {
      return res.status(400).json({ message: "Enter a course code (letters, numbers, dash) and a course name." });
    }
    if (await Course.exists({ code: new RegExp(`^${code}$`, "i") })) {
      return res.status(409).json({ message: "That course code already exists." });
    }
    const course = await Course.create({ code, name, department: req.user.department,
      active: true, updatedBy: req.user.id });
    clearCourseCache();
    return res.status(201).json(course);
  } catch (error) { return res.status(500).json({ message: "Could not add the course." }); }
};

// Admin: rename, retire or re-activate a course of their department.
// Codes never change because existing records reference them.
const updateCourse = async (req, res) => {
  try {
    const course = await Course.findOne({ code: req.params.code });
    if (!course) return res.status(404).json({ message: "Course not found." });
    if (course.department !== req.user.department) {
      return res.status(403).json({ message: "This course belongs to another department." });
    }
    if (req.body.name !== undefined) {
      const name = clean(req.body.name);
      if (!name) return res.status(400).json({ message: "Course name is required." });
      course.name = name;
    }
    if (req.body.active !== undefined) course.active = Boolean(req.body.active);
    course.updatedBy = req.user.id;
    await course.save();
    clearCourseCache();
    return res.json(course);
  } catch (error) { return res.status(500).json({ message: "Could not update the course." }); }
};

module.exports = { getCatalog, createCourse, updateCourse };
