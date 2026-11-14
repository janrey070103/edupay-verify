import { useEffect, useState } from "react";
import { getEligibilityReport, getVerifiedStudents } from "../api/adminApi";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import EmptyState from "../components/ui/EmptyState";
import usePaginated from "../hooks/usePaginated";
import { useMyCourses } from "../hooks/useCatalog";
import { formatLastFirst } from "../utils/userPresentation";
import { IconFile, IconInbox, IconSearch, IconUsers } from "../components/icons/Icons";
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
// Programs run 1st to 4th Year.
const YEAR_TEXT = { 1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year" };
const formatDay = (value) => (value ? new Date(value).toLocaleDateString("en-PH", {
  timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }) : "—");
const TABS = [
  { key: "verified", label: "Verified Students" },
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
          {[1, 2, 3, 4].map((year) => <option key={year} value={year}>{YEAR_TEXT[year]}</option>)}
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

const VERIFIED_SORTS = [
  { label: "Newest verified first", sort: "verifiedAt", order: "desc" },
  { label: "Oldest verified first", sort: "verifiedAt", order: "asc" },
  { label: "Last name A–Z", sort: "name", order: "asc" },
  { label: "Last name Z–A", sort: "name", order: "desc" },
];

// Verified (enrolled) students of the Admin's department and who verified them.
const VerifiedStudentsReport = () => {
  const [search, setSearch] = useState("");
  const { myCourses: courses } = useMyCourses();
  const { rows, meta, loading, fetching, error, filters, setFilter, setPage, setLimit, sort, order, setSorting } = usePaginated(
    ({ search: term, course, yearLevel, verifiedBy, ...params }) => getVerifiedStudents({
      ...params, ...(term ? { search: term } : {}), ...(course ? { course } : {}),
      ...(yearLevel ? { yearLevel } : {}), ...(verifiedBy ? { verifiedBy } : {}),
    }),
    { initialLimit: 25, initialFilters: { search: "", course: "", yearLevel: "", verifiedBy: "" }, initialSort: "verifiedAt", initialOrder: "desc" }
  );

  useEffect(() => {
    const timer = setTimeout(() => setFilter("search", search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search, setFilter]);

  const verifierText = (row) => {
    if (row.verifiedByMe) return "You";
    if (row.verifiedByName) return `${row.verifiedByName}${row.verifiedByRole === "super_admin" ? " (Super Admin)" : ""}`;
    return "Added by Super Admin";
  };

  const columns = [
    { key: "studentId", header: "Student ID", priority: "primary",
      render: (row) => <p className="text-sm font-bold text-gray-800">{row.studentId}</p> },
    { key: "name", header: "Name (Last, First)", priority: "detail", render: (row) => formatLastFirst(row) },
    { key: "course", header: "Course & Year", priority: "meta",
      render: (row) => [row.course, YEAR_TEXT[row.yearLevel]].filter(Boolean).join(" · ") || "—" },
    { key: "email", header: "Email", priority: "meta", render: (row) => <span className="break-all">{row.email}</span> },
    { key: "verifiedAt", header: "Verified On", priority: "meta", render: (row) => formatDay(row.verifiedAt) },
    { key: "verifiedBy", header: "Verified By", priority: "meta",
      render: (row) => <span className={row.verifiedByMe ? "font-semibold text-sti-blue" : ""}>{verifierText(row)}</span> },
    { key: "status", header: "Status", priority: "badge",
      render: (row) => (row.isActive === false
        ? <span className="rounded-md bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase text-gray-500">Archived</span>
        : <span className="rounded-md bg-green-50 px-2.5 py-1 text-[10px] font-bold uppercase text-green-700">Enrolled</span>) },
  ];

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 print:hidden">
        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700"><IconUsers className="h-5 w-5" /></span>
          <div><p className="text-xl font-black text-gray-800">{loading ? "…" : meta.total}</p>
            <p className="text-xs font-semibold text-gray-500">{filters.verifiedBy === "me" ? "Verified by you (matching filters)" : "Verified students (matching filters)"}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-sti-blue"><IconUsers className="h-5 w-5" /></span>
          <div><p className="text-xl font-black text-gray-800">{loading ? "…" : meta.verifiedByMe ?? 0}</p>
            <p className="text-xs font-semibold text-gray-500">Verified by you (all time)</p></div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto_auto] print:hidden">
        <label className="relative block">
          <span className="sr-only">Search students</span>
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, name or email…"
            className={`${CONTROL} w-full pl-9`} />
        </label>
        <select aria-label="Verified by" value={filters.verifiedBy} onChange={(e) => setFilter("verifiedBy", e.target.value)} className={CONTROL}>
          <option value="">Verified by anyone</option>
          <option value="me">Verified by me</option>
        </select>
        <select aria-label="Course" value={filters.course} onChange={(e) => setFilter("course", e.target.value)} className={CONTROL}>
          <option value="">All my courses</option>
          {courses.map((course) => <option key={course.code} value={course.code}>{course.code}</option>)}
        </select>
        <select aria-label="Year level" value={filters.yearLevel} onChange={(e) => setFilter("yearLevel", e.target.value)} className={CONTROL}>
          <option value="">All years</option>
          {[1, 2, 3, 4].map((year) => <option key={year} value={year}>{YEAR_TEXT[year]}</option>)}
        </select>
        <SortSelect options={VERIFIED_SORTS} sort={sort} order={order} onChange={setSorting} label="Sort verified students" />
        <button type="button" onClick={() => window.print()}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sti-blue px-4 text-sm font-bold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sti-blue/30">
          <IconFile className="h-4 w-4" /> Print
        </button>
      </div>

      <h2 className="mb-3 hidden text-lg font-black print:block">
        Verified Students{filters.verifiedBy === "me" ? " (verified by me)" : ""}{filters.course ? ` · ${filters.course}` : ""}{filters.yearLevel ? ` · ${YEAR_TEXT[filters.yearLevel]}` : ""} — {meta.total} total
      </h2>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <DataTable columns={columns} rows={rows} loading={loading} fetching={fetching} skeletonRows={5}
        empty={<EmptyState icon={IconInbox} title="No verified students"
          description={filters.verifiedBy === "me" ? "You have not verified any students that match these filters." : "No verified students in your department match these filters."} />} />
      <div className="print:hidden"><Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} fetching={fetching} /></div>
    </>
  );
};

const AdminReports = () => {
  const [tab, setTab] = useState("verified");
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
      {tab === "verified" ? <VerifiedStudentsReport /> : tab === "eligibility" ? <EligibilityReport /> : <ExamScheduleReport />}
    </div>
  );
};

export default AdminReports;
