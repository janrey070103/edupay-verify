import { useCallback, useEffect, useMemo, useState } from "react";
import { getTeacherExamCalendar } from "../api/examApi";
import { NAV_BADGES_EVENT } from "../utils/navBadges";
import { dayKey, fmt, initialMonth, timeRange, yearLabel, TERM_LABELS } from "../utils/calendar";
import ExamCalendar, { StatusPill } from "../components/ExamCalendar";
import Skeleton from "../components/ui/Skeleton";
import Modal from "../components/ui/Modal";
import { IconCalendar, IconCheckCircle, IconClock, IconFile, IconXCircle } from "../components/icons/Icons";

// Teacher (proctor): full exam calendar, verified students per exam, and a
// printable / save-as-PDF report for the month's schedule or one exam.
const STATUS = {
  today: { label: "Today", Icon: IconClock, pill: "bg-blue-600 text-white ring-blue-600", dot: "bg-blue-600" },
  upcoming: { label: "Upcoming", Icon: IconCalendar, pill: "bg-blue-50 text-sti-blue ring-blue-200", dot: "bg-sti-blue" },
  finished: { label: "Finished", Icon: IconCheckCircle, pill: "bg-green-50 text-green-800 ring-green-200", dot: "bg-green-600" },
  cancelled: { label: "Cancelled", Icon: IconXCircle, pill: "bg-gray-100 text-gray-500 ring-gray-200 line-through", dot: "bg-gray-400" },
};

const examLabel = (event) => `${event.course || "—"}${event.courseYear ? ` · ${yearLabel(event.courseYear)}` : ""}${event.courseSection ? ` · ${event.courseSection}` : ""}`;
/** Verified students against the room capacity. */
const CapacityBar = ({ event, compact = false }) => {
  const { verifiedCount: used, capacity } = event;
  if (!capacity) {
    return <p className={`${compact ? "mt-1.5 text-xs" : "text-sm"} text-gray-500`}>Verified {used} · No capacity set</p>;
  }
  const percent = Math.min(100, Math.round((used / capacity) * 100));
  const full = used >= capacity;
  const tone = full ? "bg-red-600" : percent >= 80 ? "bg-amber-500" : "bg-green-600";
  return (
    <div className={compact ? "mt-2" : ""}>
      <div className={`flex items-baseline justify-between gap-2 ${compact ? "text-xs" : "text-sm"}`}>
        <span className="font-semibold text-gray-700">Capacity · {used} / {capacity} verified</span>
        <span className={full ? "font-bold text-red-700" : "text-gray-500"}>{full ? "Full" : `${capacity - used} seat${capacity - used === 1 ? "" : "s"} left`}</span>
      </div>
      <div className={`mt-1 w-full overflow-hidden rounded-full bg-gray-100 ${compact ? "h-1.5" : "h-3"}`}
        role="progressbar" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={used} aria-label="Room capacity used">
        <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      {!compact && <p className="mt-1 text-xs text-gray-500">{percent}% of the room capacity</p>}
    </div>
  );
};
const canPrintExam = (event) => event && event.status !== "cancelled" && (event.status === "finished" || event.verifiedCount > 0);

const PrintHeader = ({ title, teacher }) => (
  <div className="mb-4 border-b border-gray-400 pb-3">
    <p className="text-xs uppercase tracking-wide text-gray-600">STI EduPay · Exam Proctor Report</p>
    <h1 className="text-xl font-bold text-black">{title}</h1>
    <p className="text-sm text-gray-700">Proctor: {teacher} · Printed {fmt(new Date(), { dateStyle: "medium", timeStyle: "short" })}</p>
  </div>
);

/** Printable reports: one page per exam (one term of one subject). */
const PrintReport = ({ events, teacher }) => {
  if (!events?.length) return null;
  return (
    <div className="hidden text-black print:block">
      {events.map((event, index) => (
        <div key={event._id} className={index < events.length - 1 ? "break-after-page" : ""}>
          <ExamReport event={event} teacher={teacher} />
        </div>
      ))}
    </div>
  );
};

const ExamReport = ({ event, teacher }) => {
  const cell = "border border-gray-400 px-2 py-1 text-left";
  return (
    <div>
      <PrintHeader title={`${event.subjectCode} — ${event.subject} (${TERM_LABELS[event.examType] || event.examType}${event.examKind === "Special" ? " · Special exam" : ""})`} teacher={teacher} />
      <dl className="mb-4 grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
        <div><dt className="font-bold">Term</dt><dd>{TERM_LABELS[event.examType] || event.examType}</dd></div>
        <div><dt className="font-bold">Date</dt><dd>{fmt(event.examDate, { dateStyle: "full" })}</dd></div>
        <div><dt className="font-bold">Time</dt><dd>{timeRange(event)}</dd></div>
        <div><dt className="font-bold">Course / Year</dt><dd>{examLabel(event)}</dd></div>
        <div><dt className="font-bold">Room</dt><dd>{event.room || "—"}</dd></div>
        <div><dt className="font-bold">Status</dt><dd>{STATUS[event.status]?.label || event.status}</dd></div>
      </dl>
      <table className="w-full border-collapse text-sm">
        <thead><tr>{["#", "Student ID", "Name", "Verified at", "Verified by"].map((h) => <th key={h} className={cell}>{h}</th>)}</tr></thead>
        <tbody>
          {event.verifiedStudents.map((row, index) => (
            <tr key={`${row.studentId}-${index}`}>
              <td className={cell}>{index + 1}</td>
              <td className={cell}>{row.studentId}</td>
              <td className={cell}>{row.studentName || "—"}</td>
              <td className={cell}>{fmt(row.verifiedAt, { timeStyle: "short" })}</td>
              <td className={cell}>{row.verifiedBy || teacher}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {event.verifiedStudents.length === 0 && <p className="mt-2 text-sm">No students verified for this exam.</p>}
      <p className="mt-3 text-sm">
        Total verified: <strong>{event.verifiedCount}</strong>
        {event.capacity ? <> · Room capacity: <strong>{event.capacity}</strong> · Seats left: <strong>{Math.max(0, event.capacity - event.verifiedCount)}</strong></> : null}
      </p>
      <div className="mt-12 grid grid-cols-2 gap-12 text-sm">
        <div className="border-t border-gray-500 pt-1 text-center">Proctor signature over printed name</div>
        <div className="border-t border-gray-500 pt-1 text-center">Date</div>
      </div>
    </div>
  );
};

export default function AssignedExams() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [print, setPrint] = useState(null);

  const load = useCallback(() => getTeacherExamCalendar()
    .then((value) => { setData(value); setError(""); })
    .catch(() => setError("Could not load your exams.")), []);

  // Live: every 30 s, on returning to the tab, and when a notification arrives.
  useEffect(() => {
    let active = true;
    const refresh = () => { if (active && document.visibilityState !== "hidden") load(); };
    getTeacherExamCalendar().then((value) => { if (active) { setData(value); setError(""); } })
      .catch(() => { if (active) setError("Could not load your exams."); });
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener(NAV_BADGES_EVENT, refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener(NAV_BADGES_EVENT, refresh); };
  }, [load]);

  // Clear the print layout once the browser's print dialog closes.
  useEffect(() => {
    const done = () => setPrint(null);
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, []);

  const events = useMemo(() => data?.events || [], [data]);
  const shownMonth = month || initialMonth(events);
  const monthKey = `${shownMonth.getFullYear()}-${String(shownMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthEvents = events.filter((event) => dayKey(event.examDate).startsWith(monthKey));
  const listed = selectedDay ? events.filter((event) => dayKey(event.examDate) === selectedDay) : monthEvents;
  const selected = events.find((event) => event._id === selectedId) || null;
  const teacher = data?.teacher?.name || "Teacher";

  // Subjects this teacher proctors, each with its exams (terms) in date order.
  const subjects = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const key = `${event.subjectCode}|${event.course}|${event.courseYear || ""}|${event.courseSection || ""}`;
      if (!map.has(key)) map.set(key, { key, label: `${event.subjectCode} — ${event.subject} (${examLabel(event)})`, exams: [] });
      map.get(key).exams.push(event);
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [events]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickSubject, setPickSubject] = useState("");
  const [pickExam, setPickExam] = useState("all");
  const subject = subjects.find((item) => item.key === pickSubject) || subjects[0] || null;
  const printable = (subject?.exams || []).filter((event) => event.status !== "cancelled");
  const picked = pickExam === "all" ? printable : printable.filter((event) => event._id === pickExam);

  const startPrint = (list) => {
    setPrint(list);
    setPickerOpen(false);
    setTimeout(() => window.print(), 50);
  };
  const closeDetails = useCallback(() => setSelectedId(null), []);
  // Clicking a day lists its exams; a day with a single exam opens it straight away.
  const selectDay = (key) => {
    setSelectedDay(key);
    const onDay = key ? events.filter((event) => dayKey(event.examDate) === key) : [];
    if (onDay.length === 1) setSelectedId(onDay[0]._id);
  };
  const changeMonth = (value) => { setMonth(value); setSelectedDay(null); };

  if (!data && !error) return <div className="w-full"><Skeleton className="h-96 w-full rounded-xl" /></div>;

  return (
    <div className="w-full">
      <PrintReport events={print} teacher={teacher} />

      <div className={print ? "print:hidden" : ""}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800">My Exams</h2>
            <p className="text-sm text-gray-500">Exams you proctor, with the students verified for each.</p>
          </div>
          <button type="button" disabled={subjects.length === 0} onClick={() => setPickerOpen((open) => !open)} aria-expanded={pickerOpen}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-40">
            <IconFile className="h-4 w-4" /> Print exam report
          </button>
        </div>

        {pickerOpen && subject && (
          <section className="mb-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm" aria-label="Print exam report">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
              <label className="text-sm font-semibold text-gray-700">Subject
                <select value={subject.key} onChange={(e) => { setPickSubject(e.target.value); setPickExam("all"); }}
                  className="mt-1 block min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal">
                  {subjects.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-700">Exam
                <select value={pickExam} onChange={(e) => setPickExam(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal">
                  <option value="all">All exams of this subject ({printable.length})</option>
                  {printable.map((event) => (
                    <option key={event._id} value={event._id}>
                      {TERM_LABELS[event.examType] || event.examType} · {fmt(event.examDate, { month: "short", day: "numeric" })} · {STATUS[event.status]?.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <button type="button" disabled={picked.length === 0} onClick={() => startPrint(picked)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sti-blue px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-40">
                  <IconFile className="h-4 w-4" /> Print / Save as PDF
                </button>
                <button type="button" onClick={() => setPickerOpen(false)}
                  className="min-h-11 rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Each exam prints on its own page: details, verified students with times, totals and a signature line.</p>
          </section>
        )}
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ExamCalendar events={events} statusMeta={STATUS} month={shownMonth} onMonthChange={changeMonth}
              selectedDay={selectedDay} onSelectDay={selectDay} />
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
                  <li key={event._id}>
                    <button type="button" onClick={() => setSelectedId(event._id)} aria-pressed={selectedId === event._id}
                      className={`w-full rounded-lg border p-3 text-left transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sti-blue/20 ${selectedId === event._id ? "border-sti-blue bg-blue-50/40" : "border-gray-100"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-800">{event.subjectCode}{event.examKind === "Special" && <span className="ml-1.5 rounded bg-purple-50 px-1.5 py-0.5 align-middle text-[10px] font-bold text-purple-700">Special</span>}</p>
                          <p className="truncate text-sm text-gray-600">{event.subject}</p>
                        </div>
                        <StatusPill status={event.status} meta={STATUS} />
                      </div>
                      <p className="mt-1.5 text-xs text-gray-500">
                        {fmt(event.examDate, { month: "short", day: "numeric", weekday: "short" })} · {timeRange(event)}
                        {event.room ? ` · Room ${event.room}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-gray-700">{examLabel(event)}</p>
                      <CapacityBar event={event} compact />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <Modal isOpen={Boolean(selected)} onClose={closeDetails} size="2xl"
          title={selected ? `${selected.subjectCode} — ${selected.subject}` : ""}>
          {selected && (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={selected.status} meta={STATUS} />
                <span className="text-sm font-semibold text-gray-600">{TERM_LABELS[selected.examType] || selected.examType} {selected.examKind === "Special" ? "special exam" : "exam"}</span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                {[
                  ["Date", fmt(selected.examDate, { weekday: "short", month: "short", day: "numeric", year: "numeric" })],
                  ["Time", timeRange(selected)],
                  ["Room", selected.room || "—"],
                  ["Course", selected.course || "—"],
                  ["Year level", selected.courseYear ? yearLabel(selected.courseYear) : "All years"],
                  ["Section", selected.courseSection || "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
                    <dd className="font-semibold text-gray-800">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 rounded-lg border border-gray-100 p-4">
                <CapacityBar event={selected} />
              </div>

              <h4 className="mt-5 text-sm font-bold text-gray-800">Verified students</h4>
              {selected.verifiedStudents.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500">No students verified for this exam yet.</p>
              ) : (
                <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50"><tr className="text-left text-xs uppercase text-gray-500">
                      <th className="px-3 py-2">#</th><th className="px-3 py-2">Student ID</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Verified at</th>
                    </tr></thead>
                    <tbody>
                      {selected.verifiedStudents.map((row, index) => (
                        <tr key={`${row.studentId}-${index}`} className="border-t border-gray-50">
                          <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                          <td className="px-3 py-2 font-semibold text-gray-800">{row.studentId}</td>
                          <td className="px-3 py-2 text-gray-700">{row.studentName || "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmt(row.verifiedAt, { timeStyle: "short" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={closeDetails}
                  className="min-h-11 rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">Close</button>
                <button type="button" disabled={!canPrintExam(selected)} onClick={() => startPrint([selected])}
                  title={canPrintExam(selected) ? "Print or save this report as PDF" : "Available once the exam is finished or a student is verified"}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sti-blue px-4 py-2 text-sm font-bold text-white hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sti-blue/30 disabled:cursor-not-allowed disabled:opacity-40">
                  <IconFile className="h-4 w-4" /> Print / Save as PDF
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
