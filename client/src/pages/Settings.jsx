import { useEffect, useState } from "react";
import { changeMyPassword, getCurrentUser } from "../api/authApi";
import { createCourse, updateCourse } from "../api/catalogApi";
import { useToast } from "../context/ToastContext";
import { useMyCourses, departmentName } from "../hooks/useCatalog";
import { formatLastFirst } from "../utils/userPresentation";
import Skeleton from "../components/ui/Skeleton";
import { IconLoader } from "../components/icons/Icons";

const INPUT = "min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20";
const CARD = "rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] sm:p-6";
const ROLE_LABELS = { student: "Student", cashier: "Cashier", teacher: "Teacher", admin: "Admin", super_admin: "Super Admin" };

const Profile = ({ me, departments }) => {
  const rows = [
    ["Name", formatLastFirst(me)],
    ["Email", me.email],
    ["Role", ROLE_LABELS[me.role] || me.role],
    me.role === "admin" && ["Department", departmentName(departments, me.department)],
    me.studentId && [me.role === "student" ? "Student ID" : "Employee ID", me.studentId],
    me.role === "student" && ["Course", me.course],
    me.role === "student" && ["Year / Semester", `Year ${me.yearLevel || "—"} · ${me.semester || "—"} · ${me.schoolYear || "—"}`],
  ].filter(Boolean);
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-gray-50/80 px-3 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
          <dd className="mt-0.5 wrap-break-word text-sm font-semibold text-gray-800">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
};

const PasswordForm = () => {
  const { showToast } = useToast();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.current || !form.next) return setError("Enter your current password and a new password.");
    if (form.next.length < 6) return setError("New password must be at least 6 characters.");
    if (form.next !== form.confirm) return setError("New passwords do not match.");
    setSaving(true);
    try {
      await changeMyPassword(form.current, form.next);
      setForm({ current: "", next: "", confirm: "" });
      showToast("Password changed.", "success");
    } catch (err) {
      setError(err.response?.data?.message || "Could not change the password.");
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, autoComplete) => (
    <div>
      <label htmlFor={`pw-${key}`} className="mb-1 block text-sm font-semibold text-gray-700">{label}</label>
      <input id={`pw-${key}`} type="password" autoComplete={autoComplete} value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={INPUT} />
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:max-w-md">
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {field("current", "Current password", "current-password")}
      {field("next", "New password (at least 6 characters)", "new-password")}
      {field("confirm", "Confirm new password", "new-password")}
      <button type="submit" disabled={saving} aria-busy={saving}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sti-gold px-5 font-black text-sti-blue disabled:opacity-60 sm:justify-self-start">
        {saving && <IconLoader className="h-4 w-4" />}
        {saving ? "Saving…" : "Change password"}
      </button>
    </form>
  );
};

// Admins manage the course list of their own department. Codes are permanent:
// a course is retired instead of deleted because records reference it.
const DepartmentCourses = () => {
  const { showToast } = useToast();
  const { department, departments, myCourses, loading, reload } = useMyCourses();
  const [draft, setDraft] = useState({ code: "", name: "" });
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState(null);

  const run = async (key, action, message) => {
    setBusy(key);
    try {
      await action();
      await reload();
      showToast(message, "success");
      return true;
    } catch (err) {
      showToast(err.response?.data?.message || "Could not save the course.", "error");
      return false;
    } finally {
      setBusy("");
    }
  };

  const add = async (event) => {
    event.preventDefault();
    const ok = await run("new", () => createCourse(draft), `${draft.code.toUpperCase()} added.`);
    if (ok) setDraft({ code: "", name: "" });
  };

  if (department === "") {
    return <p className="text-sm text-amber-800">Your account has no department. Ask the Super Admin to assign one.</p>;
  }
  if (loading || department === null) return <Skeleton className="h-32 w-full rounded-lg" />;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">{departmentName(departments, department)}</p>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
        {myCourses.map((course) => (
          <li key={course.code} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            {editing?.code === course.code ? (
              <form className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto]"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await run(course.code, () => updateCourse(course.code, { name: editing.name }), `${course.code} updated.`);
                  if (ok) setEditing(null);
                }}>
                <input aria-label="Course name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={INPUT} />
                <div className="flex gap-2">
                  <button type="submit" disabled={busy === course.code} className="min-h-11 rounded-lg bg-sti-blue px-4 text-sm font-bold text-white disabled:opacity-60">Save</button>
                  <button type="button" onClick={() => setEditing(null)} className="min-h-11 rounded-lg border border-gray-200 px-4 text-sm font-bold text-gray-600">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800">
                    {course.code}
                    {course.active === false && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-500">Retired</span>}
                  </p>
                  <p className="text-sm text-gray-600">{course.name}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => setEditing({ code: course.code, name: course.name })}
                    className="min-h-11 rounded-lg bg-blue-50 px-3 text-xs font-bold text-sti-blue hover:bg-blue-100">Edit</button>
                  <button type="button" disabled={busy === course.code}
                    onClick={() => run(course.code, () => updateCourse(course.code, { active: course.active === false }),
                      course.active === false ? `${course.code} re-activated.` : `${course.code} retired.`)}
                    className={`min-h-11 rounded-lg px-3 text-xs font-bold disabled:opacity-60 ${course.active === false
                      ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}>
                    {course.active === false ? "Re-activate" : "Retire"}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="grid gap-3 rounded-lg border border-dashed border-gray-200 p-3 sm:grid-cols-[8rem_1fr_auto]">
        <input aria-label="New course code" placeholder="Code e.g. BSIS" value={draft.code}
          onChange={(e) => setDraft({ ...draft, code: e.target.value })} className={INPUT} />
        <input aria-label="New course name" placeholder="Course name" value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={INPUT} />
        <button type="submit" disabled={busy === "new" || !draft.code.trim() || !draft.name.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sti-gold px-4 text-sm font-black text-sti-blue disabled:opacity-60">
          {busy === "new" && <IconLoader className="h-4 w-4" />} Add course
        </button>
      </form>
    </div>
  );
};

const Settings = () => {
  const [me, setMe] = useState(null);
  const { departments } = useMyCourses();

  useEffect(() => {
    let active = true;
    getCurrentUser().then((data) => { if (active) setMe(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className={CARD}>
        <h2 className="mb-4 text-lg font-bold text-gray-800">My profile</h2>
        {me ? <Profile me={me} departments={departments} /> : <Skeleton className="h-24 w-full rounded-lg" />}
      </section>

      <section className={CARD}>
        <h2 className="mb-4 text-lg font-bold text-gray-800">Change password</h2>
        <PasswordForm />
      </section>

      {me?.role === "admin" && (
        <section className={CARD}>
          <h2 className="mb-1 text-lg font-bold text-gray-800">Department courses</h2>
          <DepartmentCourses />
        </section>
      )}
    </div>
  );
};

export default Settings;
