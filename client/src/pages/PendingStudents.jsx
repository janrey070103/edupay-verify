import { useEffect, useState } from "react";
import {
  getPendingStudents,
  verifyStudent,
  rejectStudent,
} from "../api/userManagementApi";
import { useToast } from "../context/ToastContext";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import EmptyState from "../components/ui/EmptyState";
import Drawer from "../components/ui/Drawer";
import usePaginated from "../hooks/usePaginated";
import useCatalog, { resolveCourse } from "../hooks/useCatalog";
import SortSelect from "../components/ui/SortSelect";
import DateRangeFilter from "../components/ui/DateRangeFilter";
import {
  IconUsers,
  IconSearch,
  IconLoader,
  IconCheckCircle,
  IconXCircle,
  IconAlertCircle,
  IconClock,
} from "../components/icons/Icons";
import { refreshNavBadges } from "../utils/navBadges";
import StudentDetailsPanel from "../components/StudentDetailsPanel";

const PendingStudents = () => {
  const { showToast } = useToast();
  const { courses } = useCatalog();

  const [actionLoading, setActionLoading] = useState("");
  const [search, setSearch] = useState("");

  const [rejectDrawerOpen, setRejectDrawerOpen] = useState(false);
  // Student shown in the read-only details panel (approve / reject from there too).
  const [detailsStudent, setDetailsStudent] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  const {
    rows: students,
    meta,
    loading,
    fetching,
    error,
    filters,
    sort,
    order,
    setFilter,
    setSorting,
    setDateRange,
    setPage,
    setLimit,
    refresh,
  } = usePaginated(
    ({ search: searchTerm, ...params }) =>
      getPendingStudents(searchTerm ? { ...params, search: searchTerm } : params),
    // Oldest first: students who have waited longest are verified first.
    { initialLimit: 20, initialFilters: { search: "", from: "", to: "" }, initialSort: "createdAt", initialOrder: "asc" }
  );

  useEffect(() => {
    const timer = setTimeout(() => setFilter("search", search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search, setFilter]);

  const handleVerify = async (student) => {
    if (
      !window.confirm(
        `Approve ${student.name} (${student.studentId})? They will be able to log in.`
      )
    )
      return false;

    setActionLoading(student._id);
    try {
      await verifyStudent(student._id);
      showToast(`${student.name} has been verified.`, "success");
      refreshNavBadges();
      await refresh();
      return true;
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to verify student.",
        "error"
      );
      return false;
    } finally {
      setActionLoading("");
    }
  };

  const openRejectDrawer = (student) => {
    setRejectTarget(student);
    setRejectionReason("");
    setRejectDrawerOpen(true);
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectTarget) return;

    setRejectLoading(true);
    try {
      await rejectStudent(rejectTarget._id, rejectionReason);
      showToast(`${rejectTarget.name} has been rejected.`, "info");
      setRejectDrawerOpen(false);
      setRejectTarget(null);
      refreshNavBadges();
      await refresh();
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to reject student.",
        "error"
      );
    } finally {
      setRejectLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      priority: "primary",
      render: (student) => (
        <>
          <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-600">{student.name}</p>
          <p className="text-xs text-gray-400">{student.email}</p>
        </>
      ),
    },
    { key: "email", header: "Email", priority: "desktop", render: (student) => student.email },
    { key: "studentId", header: "Student ID", priority: "meta", render: (student) => student.studentId || "—" },
    { key: "course", header: "Course", priority: "meta", render: (student) => (
      <span>
        {resolveCourse(courses, student.course)?.code || student.course || "—"}
        {student.course && resolveCourse(courses, student.course) && resolveCourse(courses, student.course).code !== student.course && (
          <span className="ml-1.5 text-[10px] text-gray-400" title="Saved as the official code when verified">(typed: {student.course})</span>
        )}
      </span>
    ) },
    { key: "yearLevel", header: "Year", priority: "meta", render: (student) => student.yearLevel || "—" },
    { key: "createdAt", header: "Registered", priority: "meta", render: (student) => formatDate(student.createdAt) },
    {
      key: "actions",
      header: "Actions",
      priority: "action",
      render: (student) => (
        <>
          <button
            type="button"
            onClick={() => setDetailsStudent(student)}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-blue-50 px-3 py-2.5 text-xs font-bold text-sti-blue transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
            aria-label={`View details of ${student.name}`}
          >
            <IconUsers className="h-3.5 w-3.5" />
            View details
          </button>
          <button
            type="button"
            onClick={() => handleVerify(student)}
            disabled={actionLoading === student._id}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-green-50 px-3 py-2.5 text-xs font-bold text-green-700 transition hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:opacity-60"
            aria-label={`Approve ${student.name}`}
          >
            {actionLoading === student._id ? (
              <IconLoader className="h-3.5 w-3.5" />
            ) : (
              <IconCheckCircle className="h-3.5 w-3.5" />
            )}
            Approve
          </button>
          <button
            type="button"
            onClick={() => openRejectDrawer(student)}
            disabled={actionLoading === student._id}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-red-50 px-3 py-2.5 text-xs font-bold text-red-500 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
            aria-label={`Reject ${student.name}`}
          >
            <IconXCircle className="h-3.5 w-3.5" />
            Reject
          </button>
        </>
      ),
    },
  ];

  const rejectFooter = (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={() => setRejectDrawerOpen(false)}
        disabled={rejectLoading}
        className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleReject}
        disabled={rejectLoading}
        className="flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-70"
      >
        {rejectLoading ? <IconLoader className="h-4 w-4" /> : null}
        Reject Student
      </button>
    </div>
  );

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <IconClock className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">
            {loading ? "…" : meta.total} Pending
          </p>
          <p className="text-xs text-gray-500">
            Student registrations awaiting verification
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <IconSearch className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-4 text-sm font-medium text-gray-700 shadow-sm outline-none transition focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20"
            aria-label="Search pending students"
          />
        </div>
        <SortSelect sort={sort} order={order} onChange={setSorting} label="Sort by registration date" />
        <DateRangeFilter label="Registered" from={filters.from} to={filters.to} onChange={setDateRange} />
      </div>

      <DataTable
        columns={columns}
        rows={students}
        loading={loading}
        fetching={fetching}
        skeletonRows={3}
        empty={
          <EmptyState
            icon={IconUsers}
            title="No pending students"
            description={
              search.trim()
                ? "No pending students match your search."
                : "All student registrations have been processed."
            }
          />
        }
      />

      <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} fetching={fetching} />

      <Drawer
        open={Boolean(detailsStudent)}
        onClose={() => actionLoading !== detailsStudent?._id && setDetailsStudent(null)}
        title="Student details"
        footer={detailsStudent && (
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { const target = detailsStudent; setDetailsStudent(null); openRejectDrawer(target); }}
              disabled={actionLoading === detailsStudent._id}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
            >
              <IconXCircle className="h-4 w-4" /> Reject
            </button>
            <button
              type="button"
              onClick={async () => { if (await handleVerify(detailsStudent)) setDetailsStudent(null); }}
              disabled={actionLoading === detailsStudent._id}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-60"
            >
              {actionLoading === detailsStudent._id ? <IconLoader className="h-4 w-4" /> : <IconCheckCircle className="h-4 w-4" />}
              Approve
            </button>
          </div>
        )}
      >
        <StudentDetailsPanel student={detailsStudent} />
      </Drawer>

      <Drawer
        open={rejectDrawerOpen}
        onClose={() => !rejectLoading && setRejectDrawerOpen(false)}
        title={`Reject ${rejectTarget?.name || "Student"}`}
        footer={rejectFooter}
      >
        <form onSubmit={handleReject} className="space-y-5">
          {rejectTarget && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-bold text-gray-800">
                {rejectTarget.name}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {rejectTarget.studentId} &middot; {rejectTarget.email}
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This student will not be able to log in. They will be notified of
              the rejection.
            </span>
          </div>

          <div>
            <label
              htmlFor="rejection-reason"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Reason for Rejection{" "}
              <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <textarea
              id="rejection-reason"
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              disabled={rejectLoading}
              placeholder="e.g. Student ID not found in enrollment records..."
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
            />
          </div>
        </form>
      </Drawer>
    </div>
  );
};

export default PendingStudents;
