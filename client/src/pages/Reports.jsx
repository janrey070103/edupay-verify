import { useCallback, useEffect, useState } from "react";
import RegisteredUsersReport from "./RegisteredUsersReport";
import SortSelect from "../components/ui/SortSelect";
import PaidViaSelect from "../components/ui/PaidViaSelect";
import AdminReports from "./AdminReports";
import { getPaymentsReport, getReportSummary } from "../api/reportApi";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import usePaginated from "../hooks/usePaginated";
import {
  IconBarChart,
  IconCheckCircle,
  IconXCircle,
  IconUsers,
  IconInbox,
  IconFilter,
} from "../components/icons/Icons";

const FILTERS = ["All", "Approved", "Rejected"];
const EMPTY_SUMMARY = { total: 0, approved: 0, rejected: 0, fullyPaid: 0 };

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const Reports = () => {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const {
    rows,
    meta,
    loading,
    fetching,
    error: listError,
    filters,
    setFilter: setQueryFilter,
    setPage,
    setLimit,
    sort,
    order,
    setSorting,
    setDateRange,
  } = usePaginated(
    ({ status, from, to, ...params }) =>
      getPaymentsReport({
        ...params,
        ...(status ? { status } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
    { initialLimit: 25, initialFilters: { status: "", from: "", to: "", channel: "" } }
  );

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await getReportSummary({
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...(filters.channel ? { channel: filters.channel } : {}),
      });
      setSummary({ ...EMPTY_SUMMARY, ...data });
      setError("");
    } catch {
      setError("Could not load report totals.");
    } finally {
      setSummaryLoading(false);
    }
  }, [filters.from, filters.to, filters.channel]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleFilter = () => {
    setDateRange({ from: startDate, to: endDate });
  };

  const clearFilter = () => {
    setStartDate("");
    setEndDate("");
    setDateRange({ from: "", to: "" });
  };

  const handleTab = (value) => {
    setFilter(value);
    setQueryFilter("status", value === "All" ? "" : value);
  };

  const columns = [
    {
      key: "studentName",
      header: "Student",
      priority: "primary",
      render: (payment) => (
        <>
          <p className="text-sm font-semibold text-gray-800 group-hover:text-sti-blue">{payment.studentName || "—"}</p>
          <p className="text-xs text-gray-400">{payment.studentId}</p>
        </>
      ),
    },
    {
      key: "invoiceNumber",
      header: "Invoice",
      priority: "meta",
      render: (payment) => (payment.invoiceNumber ? `#${payment.invoiceNumber}` : "—"),
    },
    {
      key: "amount",
      header: "Amount",
      priority: "meta",
      render: (payment) => (payment.amount ? `₱${payment.amount}` : "—"),
    },
    {
      key: "paymentDescription",
      header: "Description",
      priority: "detail",
      render: (payment) => payment.paymentDescription || "—",
    },
    {
      key: "createdAt",
      header: "Date",
      priority: "meta",
      render: (payment) => formatDate(payment.createdAt),
    },
    {
      key: "status",
      header: "Status",
      priority: "badge",
      render: (payment) => <StatusBadge status={payment.status} />,
    },
  ];

  const message = error || listError;

  return (
    <div>
      {message && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      {/* Date range filter bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <SortSelect sort={sort} order={order} onChange={setSorting} label="Sort by date submitted" />
        <PaidViaSelect value={filters.channel} onChange={(value) => setQueryFilter("channel", value)} />
        <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Date Range
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          aria-label="Start date"
          className="min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
        />
        <span className="text-xs font-semibold text-gray-400">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label="End date"
          className="min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
        />
        <button
          type="button"
          onClick={handleFilter}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-sti-gold px-5 py-2.5 text-sm font-black text-sti-blue shadow-[0_8px_20px_rgba(255,199,44,0.25)] transition hover:-translate-y-0.5 hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
        >
          <IconFilter className="h-4 w-4" />
          Filter
        </button>
        {(filters.from || filters.to) && (
          <button
            type="button"
            onClick={clearFilter}
            className="min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-500 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
          >
            Clear
          </button>
        )}
      </div>

      {/* Stat cards (server summary, not page-local counts) */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Payments"
          value={summary.total}
          valueClassName="text-sti-blue"
          variant="icon"
          icon={IconBarChart}
          iconClassName="bg-blue-50 text-sti-blue"
          subLabel="All records"
          subLabelClassName="bg-blue-50 text-sti-blue"
          loading={summaryLoading}
        />
        <StatCard
          label="Approved"
          value={summary.approved}
          valueClassName="text-green-600"
          variant="icon"
          icon={IconCheckCircle}
          iconClassName="bg-green-50 text-green-600"
          subLabel="Verified"
          subLabelClassName="bg-green-50 text-green-600"
          loading={summaryLoading}
        />
        <StatCard
          label="Rejected"
          value={summary.rejected}
          valueClassName="text-red-600"
          variant="icon"
          icon={IconXCircle}
          iconClassName="bg-red-50 text-red-600"
          subLabel="Declined"
          subLabelClassName="bg-red-50 text-red-600"
          loading={summaryLoading}
        />
        <StatCard
          label="Fully Paid"
          value={summary.fullyPaid}
          valueClassName="text-sti-blue"
          variant="icon"
          icon={IconUsers}
          iconClassName="bg-sti-gold/10 text-sti-blue"
          subLabel="Students cleared"
          subLabelClassName="bg-sti-gold/10 text-sti-blue"
          loading={summaryLoading}
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => handleTab(value)}
            className={[
              "rounded-lg min-h-11 px-4 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-sti-blue/20",
              filter === value
                ? "bg-sti-blue text-white shadow-[0_4px_14px_rgba(0,61,165,0.35)]"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {value}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        fetching={fetching}
        skeletonRows={5}
        empty={
          <EmptyState
            icon={IconInbox}
            title="No payments found"
            description="No records match the selected filters."
          />
        }
      />

      <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} fetching={fetching} />
    </div>
  );
};

// Super Admin: registered users. Admin: department exam/eligibility reports
// (no peso amounts). Cashier: payment reports.
const RoleReports = () => {
  const role = localStorage.getItem("role");
  if (role === "super_admin") return <RegisteredUsersReport />;
  if (role === "admin") return <AdminReports />;
  return <Reports />;
};
export default RoleReports;
