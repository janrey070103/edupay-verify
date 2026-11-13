import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminSummary } from "../api/adminApi";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import {
  IconUsers,
  IconCalendar,
  IconClock,
  IconAlertCircle,
  IconTicket,
  IconCheckCircle,
} from "../components/icons/Icons";

const TERMS = [
  { key: "Prelim", label: "Prelim" },
  { key: "Midterm", label: "Midterm" },
  { key: "PreFinal", label: "Pre-Final" },
  { key: "Final", label: "Final" },
];

const formatDate = (value) => new Date(value).toLocaleDateString("en-PH", {
  timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric",
});

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminSummary()
      .then((data) => { if (active) setSummary(data); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Could not load the dashboard."); });
    return () => { active = false; };
  }, []);

  const loading = !summary && !error;
  const s = summary || {};

  return (
    <div>
      <PageHeader
        title={s.department?.name || (loading ? "Admin Dashboard" : "No department assigned")}
        subtitle={s.courses?.length ? `Courses: ${s.courses.join(", ")}` : "Department exams and student verification"}
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {summary && !summary.department && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your account has no department yet. Ask the Super Admin to assign one; until then you will not see any students or exams.
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => navigate("/pending-students")} className="text-left">
          <StatCard label="Pending Students" value={s.pendingStudents ?? 0} variant="icon" icon={IconUsers}
            valueClassName="text-sti-blue" iconClassName="bg-amber-50 text-amber-600"
            subLabel="Waiting for verification" subLabelClassName="bg-amber-50 text-amber-700" loading={loading} />
        </button>
        <button type="button" onClick={() => navigate("/exam-schedule")} className="text-left">
          <StatCard label="Exams This Month" value={s.examsThisMonth ?? 0} variant="icon" icon={IconCalendar}
            valueClassName="text-sti-blue" iconClassName="bg-blue-50 text-sti-blue"
            subLabel="Scheduled, not cancelled" subLabelClassName="bg-blue-50 text-sti-blue" loading={loading} />
        </button>
        <StatCard label="Next 7 Days" value={s.examsNext7Days ?? 0} variant="icon" icon={IconClock}
          valueClassName="text-sti-blue" iconClassName="bg-indigo-50 text-indigo-600"
          subLabel="Upcoming exams" subLabelClassName="bg-indigo-50 text-indigo-700" loading={loading} />
        <button type="button" onClick={() => navigate("/exam-schedule")} className="text-left">
          <StatCard label="No Proctor Yet" value={s.unassignedProctors ?? 0} variant="icon" icon={IconAlertCircle}
            valueClassName={s.unassignedProctors ? "text-red-600" : "text-sti-blue"} iconClassName="bg-red-50 text-red-600"
            subLabel="Upcoming exams" subLabelClassName="bg-red-50 text-red-700" loading={loading} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-lg font-bold text-gray-800">Needs attention</h2>
          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
          ) : (
            <ul className="space-y-3">
              {(s.unassignedExams || []).map((exam) => (
                <li key={exam._id} className="flex items-center justify-between gap-3 rounded-lg bg-red-50/60 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">{exam.subjectCode} - {exam.subject}</p>
                    <p className="text-xs text-gray-500">{exam.course || "No course"} · {exam.examType} · {formatDate(exam.examDate)}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-bold uppercase text-red-600">No proctor</span>
                </li>
              ))}
              {s.examsWithoutCourse > 0 && (
                <li className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                  {s.examsWithoutCourse} exam(s) have no course yet. Open Exam Schedule and set a course so they belong to the right department.
                </li>
              )}
              {!s.unassignedExams?.length && !s.examsWithoutCourse && (
                <EmptyState icon={IconCheckCircle} title="All clear" description="Every upcoming exam has a proctor." />
              )}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">Students cleared per term</h2>
            <button type="button" onClick={() => navigate("/reports")} className="min-h-11 rounded-lg px-3 text-sm font-bold text-sti-blue hover:bg-blue-50">
              View report
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {TERMS.map((term) => (
              <div key={term.key} className="rounded-lg bg-gray-50/80 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <IconTicket className="h-3.5 w-3.5" /> {term.label}
                </p>
                {loading ? <Skeleton className="mt-2 h-7 w-12" /> : (
                  <p className="mt-1 text-2xl font-black text-sti-blue">{s.eligibleByTerm?.[term.key] ?? 0}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
