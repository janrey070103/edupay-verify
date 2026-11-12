const Course = require("../Models/Course");
const { COURSES } = require("../config/catalog");

// Insert any catalogue course that is missing. Existing rows (including Admin
// edits such as a retired course or renamed title) are never overwritten.
const ensureCourseCatalog = async () => {
  if (!COURSES.length) return;
  await Course.bulkWrite(COURSES.map((course) => ({
    updateOne: {
      filter: { code: course.code },
      update: { $setOnInsert: { ...course, active: true } },
      upsert: true,
    },
  })), { ordered: false });
};

// Short cache: course codes are read on most Admin requests and change rarely.
let cache = { at: 0, courses: [] };
const CACHE_MS = 60 * 1000;

const allCourses = async () => {
  if (Date.now() - cache.at < CACHE_MS) return cache.courses;
  const courses = await Course.find().select("code name department active").lean();
  cache = { at: Date.now(), courses };
  return courses;
};

const clearCourseCache = () => { cache = { at: 0, courses: [] }; };

const findCourse = async (code) => (await allCourses()).find((course) => course.code === code) || null;

module.exports = { ensureCourseCatalog, allCourses, clearCourseCache, findCourse };
