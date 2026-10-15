import { useEffect, useState } from "react";
import { getMyTermSchedules } from "../api/termScheduleApi";
import { getMyLedger } from "../api/eligibilityApi";

const field = { Prelim: "prelim", Midterm: "midterm", PreFinal: "preFinal", Final: "final" };
const datePH = (value) => new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "full" }).format(new Date(value));
const manilaDateKey = (value) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
export default function StudentMyExams() {
  const [schedules, setSchedules] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const load = () => Promise.all([getMyTermSchedules(), getMyLedger()])
      .then(([items, record]) => { setSchedules(items); setLedger(record); setError(""); })
      .catch(() => setError("Could not load your examination schedules."))
      .finally(() => setLoading(false));
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);
  const today = manilaDateKey(new Date());
  const groups = [
    ["Upcoming examinations", schedules.filter((item) => manilaDateKey(item.examDate) >= today)],
    ["Completed examinations", schedules.filter((item) => manilaDateKey(item.examDate) < today)],
  ];
  return <div className="mx-auto max-w-5xl">
    <h2 className="text-xl font-bold text-gray-800">My Exams</h2>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <p className="mt-5 text-sm text-gray-500">Loading schedules…</p> : schedules.length === 0 ?
      <p className="mt-5 rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-500">No examination is scheduled for your semester and school year.</p> :
      groups.map(([heading, items]) => items.length > 0 && <section key={heading} className="mt-7">
        <h3 className="mb-3 text-lg font-bold text-gray-800">{heading}</h3>
        <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <article key={item._id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-lg font-bold text-sti-blue">{item.examType}</p>
          <p className="mt-1 text-sm text-gray-700">{datePH(item.examDate)}</p>
          <p className="mt-1 text-sm text-gray-600">{item.semester} · {item.schoolYear}</p>
          <p className="mt-2 text-sm font-semibold text-gray-700">Schedule: {item.status}</p>
          <p className="mt-1 text-sm font-semibold text-gray-700">Exam eligibility: {ledger?.[field[item.examType]] ? "Eligible" : "Not yet eligible"}</p>
          {item.subjects?.length > 0 && <ul className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-600">
            {item.subjects.map((subject) => <li key={subject._id} className="py-1">{subject.subject} ({subject.subjectCode}) · {subject.schedule}</li>)}
          </ul>}
        </article>)}</div>
      </section>)}
  </div>;
}
