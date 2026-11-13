import { useCallback, useEffect, useMemo, useState } from "react";
import { getMyExamCalendar } from "../api/examApi";
import { NAV_BADGES_EVENT } from "../utils/navBadges";
import { dayKey, fmt, initialMonth, timeRange, yearLabel, TERM_LABELS } from "../utils/calendar";
import ExamCalendar, { StatusPill } from "../components/ExamCalendar";
import Skeleton from "../components/ui/Skeleton";
import { IconCheckCircle, IconClock, IconXCircle, IconCalendar } from "../components/icons/Icons";

// Student: a simple calendar of their own exams (course + year level).
const STATUS = {
  verified: { label: "Verified", Icon: IconCheckCircle, pill: "bg-green-50 text-green-800 ring-green-200", dot: "bg-green-600" },
  today: { label: "Today", Icon: IconClock, pill: "bg-blue-600 text-white ring-blue-600", dot: "bg-blue-600" },
  upcoming: { label: "Upcoming", Icon: IconCalendar, pill: "bg-blue-50 text-sti-blue ring-blue-200", dot: "bg-sti-blue" },
  missed: { label: "Not verified", Icon: IconXCircle, pill: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-600" },
  cancelled: { label: "Cancelled", Icon: IconXCircle, pill: "bg-gray-100 text-gray-500 ring-gray-200 line-through", dot: "bg-gray-400" },
};

export default function StudentMyExams() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const load = useCallback(() => getMyExamCalendar()
    .then((value) => { setData(value); setError(""); })
    .catch(() => setError("Could not load your exams.")), []);

  // Live: every 30 s, on returning to the tab, and when a notification arrives.
  useEffect(() => {
    let active = true;
    const refresh = () => { if (active && document.visibilityState !== "hidden") load(); };
    getMyExamCalendar().then((value) => { if (active) { setData(value); setError(""); } })
      .catch(() => { if (active) setError("Could not load your exams."); });
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener(NAV_BADGES_EVENT, refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener(NAV_BADGES_EVENT, refresh); };
  }, [load]);

  const events = useMemo(() => data?.events || [], [data]);
  const shownMonth = month || initialMonth(events);
  const monthKey = `${shownMonth.getFullYear()}-${String(shownMonth.getMonth() + 1).padStart(2, "0")}`;
  const listed = selectedDay
    ? events.filter((event) => dayKey(event.examDate) === selectedDay)
    : events.filter((event) => dayKey(event.examDate).startsWith(monthKey));

  if (!data && !error) return <div className="w-full"><Skeleton className="h-96 w-full rounded-xl" /></div>;

  return (
    <div className="w-full">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">My Exams</h2>
        {data?.student && (
          <p className="text-sm text-gray-500">
            {data.student.course || "—"} · {yearLabel(data.student.yearLevel)} · {data.student.semester || "Semester not set"} {data.student.schoolYear || ""}
          </p>
        )}
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {data?.message && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{data.message}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ExamCalendar events={events} statusMeta={STATUS} month={shownMonth} onMonthChange={setMonth}
            selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        </div>
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm" aria-live="polite">
          <h3 className="mb-3 text-sm font-bold text-gray-800">
            {selectedDay ? fmt(`${selectedDay}T04:00:00Z`, { dateStyle: "full" }) : `Exams in ${shownMonth.toLocaleDateString("en-PH", { month: "long" })}`}
          </h3>
          {listed.length === 0 ? (
            <p className="text-sm text-gray-500">No exams {selectedDay ? "on this day" : "this month"}.</p>
          ) : (
            <ul className="space-y-2">
              {listed.map((event) => (
                <li key={event._id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800">{event.subjectCode}{event.examKind === "Special" && <span className="ml-1.5 rounded bg-purple-50 px-1.5 py-0.5 align-middle text-[10px] font-bold text-purple-700">Special</span>}</p>
                      <p className="truncate text-sm text-gray-600">{event.subject}</p>
                    </div>
                    <StatusPill status={event.status} meta={STATUS} />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {TERM_LABELS[event.examType] || event.examType} · {fmt(event.examDate, { month: "short", day: "numeric", weekday: "short" })} · {timeRange(event)}
                    {event.room ? ` · Room ${event.room}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
