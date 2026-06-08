import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAllPayments,
  getApprovedPayments,
  getRejectedPayments,
  getFullyPaidStudents,
} from "../api/reportApi";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";
import {
  IconBarChart,
  IconCheckCircle,
  IconXCircle,
  IconUsers,
  IconInbox,
  IconFilter,
} from "../components/icons/Icons";

const FILTERS = ["All", "Approved", "Rejected"];

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const Reports = () => {
  const [allPayments, setAllPayments] = useState([]);
  const [approved, setApproved] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [fullyPaid, setFullyPaid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [all, app, rej, fp] = await Promise.all([
        getAllPayments(),
        getApprovedPayments(),
        getRejectedPayments(),
        getFullyPaidStudents(),
      ]);
      setAllPayments(all);
      setApproved(app);
      setRejected(rej);
      setFullyPaid(fp);
      setError("");
    } catch {
      setError("Could not load report data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilter = () => {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  };

  const clearFilter = () => {
    setStartDate("");
    setEndDate("");
    setAppliedStart("");
    setAppliedEnd("");
  };

  /* filter + date range logic */
  const baseList = useMemo(() => {
    if (filter === "Approved") return approved;
    if (filter === "Rejected") return rejected;
    return allPayments;
  }, [filter, allPayments, approved, rejected]);

  const filtered = useMemo(() => {
    let list = baseList;
    if (appliedStart) {
      const start = new Date(appliedStart);
      start.setHours(0, 0, 0, 0);
      list = list.filter((p) => new Date(p.createdAt) >= start);
    }
    if (appliedEnd) {
      const end = new Date(appliedEnd);
      end.setHours(23, 59, 59, 999);
      list = list.filter((p) => new Date(p.createdAt) <= end);
    }
    return list;
  }, [baseList, appliedStart, appliedEnd]);

  return (
    <div>
      <PageHeader
        title="System Reports"
        subtitle="View payment verification reports and analytics."
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Date range filter bar */}
      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
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
        {(appliedStart || appliedEnd) && (
          <button
            type="button"
            onClick={clearFilter}
            className="min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-500 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
          >
            Clear
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Payments"
          value={allPayments.length}
          valueClassName="text-sti-blue"
          variant="icon"
          icon={IconBarChart}
          iconClassName="bg-blue-50 text-sti-blue"
          subLabel="All records"
          subLabelClassName="bg-blue-50 text-sti-blue"
          loading={loading}
        />
        <StatCard
          label="Approved"
          value={approved.length}
          valueClassName="text-green-600"
          variant="icon"
          icon={IconCheckCircle}
          iconClassName="bg-green-50 text-green-600"
          subLabel="Verified"
          subLabelClassName="bg-green-50 text-green-600"
          loading={loading}
        />
        <StatCard
          label="Rejected"
          value={rejected.length}
          valueClassName="text-red-600"
          variant="icon"
          icon={IconXCircle}
          iconClassName="bg-red-50 text-red-600"
          subLabel="Declined"
          subLabelClassName="bg-red-50 text-red-600"
          loading={loading}
        />
        <StatCard
          label="Fully Paid"
          value={fullyPaid.length}
          valueClassName="text-sti-blue"
          variant="icon"
          icon={IconUsers}
          iconClassName="bg-sti-gold/10 text-sti-blue"
          subLabel="Students cleared"
          subLabelClassName="bg-sti-gold/10 text-sti-blue"
          loading={loading}
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={[
              "rounded-lg min-h-11 px-4 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-sti-blue/20",
              filter === f
                ? "bg-sti-blue text-white shadow-[0_4px_14px_rgba(0,61,165,0.35)]"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Payment table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {[
                  "Student",
                  "Invoice",
                  "Amount",
                  "Description",
                  "Date",
                  "Status",
                ].map((col) => (
                  <th
                    key={col}
                    className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <Skeleton variant="table-row" count={5} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={IconInbox}
                      title="No payments found"
                      description="No records match the selected filters."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p._id}
                    className="group transition-colors hover:bg-blue-50/30"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-sti-blue">
                        {p.studentName || "—"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.studentId}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {p.invoiceNumber ? `#${p.invoiceNumber}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-800">
                      {p.amount ? `₱${p.amount}` : "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-6 py-4 text-sm text-gray-500">
                      {p.paymentDescription || "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        {!loading && filtered.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-3">
            <p className="text-xs font-semibold text-gray-400">
              Showing {filtered.length} record
              {filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
