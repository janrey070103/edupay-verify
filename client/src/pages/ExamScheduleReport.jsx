import { useCallback, useEffect, useState } from "react";
import { getExamScheduleReport } from "../api/examApi";
import { useToast } from "../context/ToastContext";
import DataTable from "../components/ui/DataTable";
import { IconLoader, IconFile } from "../components/icons/Icons";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const EXAM_TYPES = ["Prelim", "Midterm", "PreFinal", "Final"];

const CELL = "px-6 py-4 text-sm text-gray-600";

const courseLabel = (exam) => {
  if (exam.courseYear && exam.courseSection) return `Year ${exam.courseYear} - Section ${exam.courseSection}`;
  if (exam.courseYear) return `Year ${exam.courseYear}`;
  if (exam.courseSection) return `Section ${exam.courseSection}`;
  return "—";
};

// Desktop/print: table columns. Mobile: bento card (subject as title, time as badge).
const COLUMNS = [
  {
    key: "course",
    header: "Course Year & Section",
    priority: "meta",
    cellClass: CELL,
    render: courseLabel,
  },
  {
    key: "subject",
    header: "Subject Code and Title",
    priority: "primary",
    cellClass: CELL,
    render: (exam) => (
      <>
        <strong className="block font-bold text-gray-800">{exam.subjectCode}</strong>
        <span className="text-sm text-gray-600">{exam.subject}</span>
      </>
    ),
  },
  {
    key: "schedule",
    header: "Schedule",
    priority: "badge",
    cellClass: CELL,
    render: (exam) => (
      <span className="whitespace-nowrap rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-sti-blue md:bg-transparent md:p-0 md:text-sm md:font-normal md:text-gray-600 print:bg-transparent print:p-0">
        {exam.startTime && exam.endTime ? `${exam.startTime} - ${exam.endTime}` : exam.schedule || "—"}
      </span>
    ),
  },
  {
    key: "room",
    header: "Room",
    priority: "meta",
    cellClass: CELL,
    render: (exam) => exam.room || "—",
  },
  {
    key: "proctor",
    header: "Proctor",
    priority: "detail",
    cellClass: CELL,
    render: (exam) => exam.proctorName || "Pending Assignment",
  },
];

const ExamScheduleReport = () => {
  const { showToast } = useToast();

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedExamType, setSelectedExamType] = useState("");
  const [exams, setExams] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getExamScheduleReport(
        selectedYear,
        selectedMonth,
        selectedExamType || undefined
      );
      setExams(data);
    } catch (err) {
      showToast("Failed to load schedule report.", "error");
      setExams({});
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedExamType, showToast]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrint = () => {
    window.print();
  };

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  return (
    <>
      <style>{`
        @media print {
          .print-hide {
            display: none;
          }
          body {
            margin: 0;
            padding: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          td, th {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
            font-size: 12px;
          }
          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          .page-break {
            page-break-after: always;
          }
          .section-title {
            font-size: 14px;
            font-weight: bold;
            margin-top: 20px;
            margin-bottom: 10px;
            text-align: center;
          }
        }
      `}</style>

      <div className="print-hide">

        <div className="rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-6 mb-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {MONTHS.map((month, i) => (
                  <option key={i + 1} value={i + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Exam Type (Optional)
              </label>
              <select
                value={selectedExamType}
                onChange={(e) => setSelectedExamType(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Types</option>
                {EXAM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handlePrint}
                disabled={loading || Object.keys(exams).length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 shadow-[0_4px_14px_rgba(37,99,235,0.39)] disabled:opacity-60 transition"
              >
                <IconFile className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)] sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-600">
            <IconLoader className="h-5 w-5 animate-spin" />
            Loading schedule...
          </div>
        ) : Object.keys(exams).length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            No exams found for the selected period.
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(exams).map(([dateKey, examsList]) => (
              <div key={dateKey} className="page-break">
                <div className="section-title mb-4 pt-2 text-base font-black text-gray-800 sm:px-2 sm:text-lg">{dateKey}</div>

                <DataTable
                  columns={COLUMNS}
                  rows={examsList}
                  rowKey={(exam) => exam._id}
                  className="shadow-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default ExamScheduleReport;
