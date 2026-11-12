import { useEffect, useState } from "react";
import { getCurrentUser } from "../../api/authApi";
import useCatalog, { departmentName, resolveCourse } from "../../hooks/useCatalog";

const ROLE_LABELS = { student: "Student", cashier: "Cashier", admin: "Admin", teacher: "Teacher", super_admin: "Super Admin" };
const yearText = (n) => (n ? `${({ 1: "1st", 2: "2nd", 3: "3rd" })[Number(n)] || `${n}th`} Year` : null);
const join = (...parts) => parts.filter(Boolean).join(" · ");

/** Lines shown under the name: the role (with its key detail), then the role's own details. */
const linesFor = (role, me, name, departments, courses) => {
  const label = ROLE_LABELS[role] ?? role;
  if (!me) return [label];
  switch (role) {
    case "student": {
      const course = resolveCourse(courses, me.course);
      return [join(label, me.studentId), join(course?.code || me.course, yearText(me.yearLevel)),
        join(me.semester, me.schoolYear && `SY ${me.schoolYear}`)];
    }
    case "admin":
      return [join(label, me.studentId), me.department ? departmentName(departments, me.department) : "No department", me.email];
    case "super_admin":
      // Avoid "Super Admin / Super Admin" when the account is named after the role.
      return [join(name === label ? null : label, me.studentId, "Full system access"), me.email];
    default: // cashier, teacher
      return [join(label, me.studentId), me.email];
  }
};

export default function AccountCard({ role, displayName, initials }) {
  const { departments, courses } = useCatalog();
  const [me, setMe] = useState(null);

  useEffect(() => {
    let active = true;
    getCurrentUser().then((data) => { if (active) setMe(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const name = me?.name || displayName;
  const [first, ...rest] = linesFor(role, me, name, departments, courses).filter(Boolean);

  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sti-blue text-sm font-bold text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold text-gray-800" title={name}>{name}</p>
        <p className="truncate text-xs font-medium text-gray-500" title={first}>{first}</p>
        {rest.map((line) => (
          <p key={line} className="truncate text-xs text-gray-400" title={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}
