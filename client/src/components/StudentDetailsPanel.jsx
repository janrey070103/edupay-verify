import useCatalog, { departmentName, resolveCourse } from "../hooks/useCatalog";
import { formatLastFirst } from "../utils/userPresentation";
import { IconAlertCircle, IconClock } from "./icons/Icons";

const dateTime = (value) => (value ? new Date(value).toLocaleString("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) : "—");
const waitingFor = (value) => {
  if (!value) return "";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000));
  return days <= 0 ? "Registered today" : `Waiting ${days} day${days === 1 ? "" : "s"}`;
};
const validSchoolYear = (value) => /^\d{4}-\d{4}$/.test(String(value || "")) &&
  Number(String(value).slice(5)) === Number(String(value).slice(0, 4)) + 1;

const Section = ({ title, rows }) => (
  <section>
    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</h3>
    <dl className="divide-y divide-gray-50 rounded-lg border border-gray-100">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 px-3 py-2.5 text-sm">
          <dt className="shrink-0 text-gray-500">{label}</dt>
          <dd className="min-w-0 wrap-break-word text-right font-semibold text-gray-800">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  </section>
);

/** Read-only profile of a pending student, with anything that needs attention flagged. */
const StudentDetailsPanel = ({ student }) => {
  const { courses, departments } = useCatalog();
  if (!student) return null;

  const course = resolveCourse(courses, student.course);
  const warnings = [
    student.course && !course &&
      `Course "${student.course}" is not in the official course list, so no department can manage this student until the Super Admin corrects it.`,
    course && course.code !== student.course &&
      `Typed as "${student.course}". It will be saved as the official ${course.code} when approved.`,
    (!student.semester || !validSchoolYear(student.schoolYear)) &&
      "Semester or school year is missing. The student will not be able to generate exam permit QR codes until the Super Admin fills these in.",
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
        <p className="text-lg font-black text-gray-900">{formatLastFirst(student)}</p>
        <p className="text-sm font-bold text-sti-blue">{student.studentId || "No student ID"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-amber-50 px-2 py-1 font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
            Pending verification
          </span>
          <span className="inline-flex items-center gap-1 text-gray-500">
            <IconClock className="h-3.5 w-3.5" />{waitingFor(student.createdAt)}
          </span>
        </div>
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-2" aria-label="Needs attention">
          {warnings.map((text) => (
            <li key={text} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {text}
            </li>
          ))}
        </ul>
      )}

      <Section title="Personal" rows={[
        ["Last name", student.lastName || "—"],
        ["First name", student.firstName || (student.lastName ? "—" : student.name)],
        ["Middle name", student.middleName || "—"],
        ["Email", student.email],
      ]} />

      <Section title="Academic" rows={[
        ["Course", course ? `${course.code} — ${course.name}` : student.course],
        ["Department", course ? departmentName(departments, course.department) : "Not determined"],
        ["Year level", student.yearLevel ? `Year ${student.yearLevel}` : "—"],
        ["Semester", student.semester || "Not set"],
        ["School year", student.schoolYear || "Not set"],
      ]} />

      <Section title="Registration" rows={[
        ["Registered", dateTime(student.createdAt)],
        ["Account status", student.isActive === false ? "Archived" : "Can log in once approved"],
      ]} />
    </div>
  );
};

export default StudentDetailsPanel;
