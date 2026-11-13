import { useEffect, useState } from "react";
import { getEligibilityReport } from "../api/adminApi";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import EmptyState from "../components/ui/EmptyState";
import usePaginated from "../hooks/usePaginated";
import { useMyCourses } from "../hooks/useCatalog";
import { formatLastFirst } from "../utils/userPresentation";
import { IconInbox, IconSearch } from "../components/icons/Icons";
import ExamScheduleReport from "./ExamScheduleReport";
import SortSelect from "../components/ui/SortSelect";

const TERMS = [
  { value: "Prelim", label: "Prelim" },
  { value: "Midterm", label: "Midterm" },
  { value: "PreFinal", label: "Pre-Final" },
  { value: "Final", label: "Final" },
];
// Ledgers are created with a student's first approved payment, so "first cleared"
// is the closest date to when the student became eligible.
const ELIGIBILITY_SORTS = [
  { label: "Newest cleared first", sort: "createdAt", order: "desc" },
  { label: "Oldest cleared first", sort: "createdAt", order: "asc" },
  { label: "Last name A–Z", sort: "name", order: "asc" },
];
const formatDay = (value) => (value ? new Date(value).toLocaleDateString("en-PH", {
  timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }) : "—");
const TABS = [
  { key: "eligibility", label: "Eligibility by Term" },
  { key: "schedule", label: "Exam Schedule" },
];
const CONTROL = "min-h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20";

// Department-scoped; shows clearance only, never peso amounts.
const EligibilityReport = () => {
  const [search, setSearch] = useState("");
  const { myCourses: courses } = useMyCourses();
  const { rows, meta, loading, fetching, error, filters, setFilter, setPage, setLimit, sort, order, setSorting } = usePaginated(
    ({ search: term, course, yearLevel, ...params }) => getEligibilityReport({
      ...params, ...(term ? { search: term } : {}), ...(course ? { course } : {}), ...(yearLevel ? { yearLevel } : {}),
    }),
    { initialLimit: 25, initialFilters: { term: "Prelim", search: "", course: "", yearLevel: "" }, initialSort: "createdAt", initialOrder: "desc" }
  );

  useEffect(() => {
    const timer = setTimeout(() => setFilter("search", search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search, setFilter]);

  const columns = [
    { key: "studentId", header: "Student ID", priority: "primary",
      render: (row) => <p className="text-sm font-bold text-gray-800">{row.studentId}</p> },
    { key: "name", header: "Name (Last, First)", priority: "detail", render: (row) => formatLastFirst(row) },
    { key: "course", header: "Course", priority: "meta", render: (row) => row.course || "—" },
    { key: "yearLevel", header: "Year", priority: "meta", render: (row) => row.yearLevel || "—" },
    { key: "clearedAt", header: "First Cleared", priority: "meta", render: (row) => formatDay(row.clearedAt) },
    { key: "cleared", header: "Status", priority: "badge",
      render: (row) => (row.isActive === false ? (
        <span className="rounded-md bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase text-gray-500">Archived</span>
      ) : (
        <span className="rounded-md bg-green-50 px-2.5 py-1 text-[10px] font-bold uppercase text-green-700">
          Cleared{row.fullyPaid ? " · Fully paid" : ""}
        </span>
      )) },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Exam term">
        {TERMS.map((term) => (
          <button key={term.value} type="button" role="tab" aria-selected={filters.term === term.value}
            onClick={() => setFilter("term", term.value)}
            className={`min-h-11 rounded-lg px-4 text-sm font-bold transition ${filters.term === term.value
              ? "bg-sti-blue text-white shadow-[0_4px_14px_rgba(0,61,165,0.35)]"
              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
            {term.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative block">
          <span className="sr-only">Search students</span>
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID or name…"
            className={`${CONTROL} w-full pl-9`} />
        </label>
        <select aria-label="Course" value={filters.course} onChange={(e) => setFilter("course", e.target.value)} className={CONTROL}>
          <option value="">All my courses</option>
          {courses.map((course) => <option key={course.code} value={course.code}>{course.code}</option>)}
        </select>
        <select aria-label="Year level" value={filters.yearLevel} onChange={(e) => setFilter("yearLevel", e.target.value)} className={CONTROL}>
          <option value="">All years</option>
          {[1, 2, 3, 4, 5, 6].map((year) => <option key={year} value={year}>Year {year}</option>)}
        </select>
        <SortSelect options={ELIGIBILITY_SORTS} sort={sort} order={order} onChange={setSorting} label="Sort students" />
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <DataTable columns={columns} rows={rows} loading={loading} fetching={fetching} skeletonRows={5}
        empty={<EmptyState icon={IconInbox} title="No cleared students" description="No students in your department are cleared for this term yet." />} />
      <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} fetching={fetching} />
    </>
  );
};

const AdminReports = () => {
  const [tab, setTab] = useState("eligibility");
  return (
    <div>
      <div className="mb-6 flex gap-2 border-b border-gray-200 print:hidden">
        {TABS.map((item) => (
          <button key={item.key} type="button" onClick={() => setTab(item.key)}
            className={`min-h-11 px-4 py-3 font-semibold transition ${tab === item.key
              ? "border-b-2 border-sti-blue text-sti-blue" : "text-gray-600 hover:text-gray-800"}`}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === "eligibility" ? <EligibilityReport /> : <ExamScheduleReport />}
    </div>
  );
};

export default AdminReports;
