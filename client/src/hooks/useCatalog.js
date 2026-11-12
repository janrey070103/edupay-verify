import { useCallback, useEffect, useState } from "react";
import { getCatalog } from "../api/catalogApi";
import { getCurrentUser } from "../api/authApi";

// Departments and courses change rarely; one request is shared per page load.
let cached = null;
let pending = null;

const load = (force = false) => {
  if (force) { cached = null; pending = null; }
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = getCatalog({ all: "1" })
      .then((data) => { cached = data; return data; })
      .finally(() => { pending = null; });
  }
  return pending;
};

/** { departments, courses (all, including retired), activeCourses, loading, reload } */
export default function useCatalog() {
  const [data, setData] = useState(cached);

  useEffect(() => {
    let active = true;
    load().then((result) => { if (active) setData(result); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const reload = useCallback(() => load(true).then((result) => { setData(result); return result; }), []);

  const courses = data?.courses || [];
  return {
    departments: data?.departments || [],
    courses,
    activeCourses: courses.filter((course) => course.active !== false),
    loading: !data,
    reload,
  };
}

export const departmentName = (departments, code) =>
  departments.find((department) => department.code === code)?.name || code || "—";

/** The logged-in Admin's department and its courses (all courses for other roles). */
export function useMyCourses() {
  const catalog = useCatalog();
  const [department, setDepartment] = useState(null);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((me) => { if (active) setDepartment(me?.role === "admin" ? (me.department || "") : null); })
      .catch(() => { if (active) setDepartment(""); });
    return () => { active = false; };
  }, []);

  const mine = department === null ? catalog.courses : catalog.courses.filter((course) => course.department === department);
  return { ...catalog, department, myCourses: mine, myActiveCourses: mine.filter((course) => course.active !== false) };
}

// Same lenient matching as the server: "BPED", "b.p.ed" -> the BPEd course.
const normalizeCode = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const resolveCourse = (courses, value) =>
  courses.find((course) => normalizeCode(course.code) === normalizeCode(value)) || null;
