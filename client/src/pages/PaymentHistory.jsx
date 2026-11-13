import { useState } from "react";
import { getPayments } from "../api/paymentApi";
import Pagination from "../components/ui/Pagination";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import DataTable from "../components/ui/DataTable";
import SortSelect from "../components/ui/SortSelect";
import DateRangeFilter from "../components/ui/DateRangeFilter";
import PaymentDetailsModal from "../components/ui/PaymentDetailsModal";
import usePaginated from "../hooks/usePaginated";
import { IconInbox } from "../components/icons/Icons";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const EXAM_TERMS = [
  { label: "All Terms", value: "" },
  { label: "Prelim", value: "Prelim" },
  { label: "Midterm", value: "Midterm" },
  { label: "Pre-Final", value: "PreFinal" },
  { label: "Final", value: "Final" },
];

const PaymentHistory = () => {
  const [selectedPayment, setSelectedPayment] = useState(null);

  const {
    rows: payments,
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
  } = usePaginated(
    ({ examCoverage, ...params }) => getPayments(examCoverage ? { ...params, examCoverage } : params),
    { initialLimit: 10, initialFilters: { examCoverage: "", from: "", to: "" }, initialSort: "createdAt", initialOrder: "desc" }
  );

  const selectedTerm = filters.examCoverage || "All";

  // One config: table columns on desktop, bento card slots on mobile.
  const columns = [
    {
      key: "payment",
      header: "Payment",
      priority: "primary",
      render: (payment) => (
        <p className="text-sm font-semibold text-gray-800">
          {payment.invoiceNumber ? `Invoice #${payment.invoiceNumber}` : payment.paymentDescription || "Payment"}
        </p>
      ),
    },
    {
      key: "status",
      header: "Status",
      priority: "badge",
      render: (payment) => <StatusBadge status={payment.status} />,
    },
    {
      key: "createdAt",
      header: "Date",
      priority: "meta",
      render: (payment) => formatDate(payment.createdAt),
    },
    {
      key: "examCoverage",
      header: "Term",
      priority: "meta",
      render: (payment) => payment.examCoverage || "—",
    },
    {
      key: "amount",
      header: "Amount",
      priority: "meta",
      render: (payment) => {
        if (payment.status === "Approved" && payment.amount != null && Number.isFinite(Number(payment.amount))) {
          return peso.format(payment.amount);
        }
        return payment.amountStatus === "Detected" ? "Awaiting cashier verification" : "—";
      },
    },
    {
      key: "remarks",
      header: "Remarks",
      priority: "detail",
      cellClass: "max-w-xs px-3 py-2.5 text-sm wrap-break-word",
      render: (payment) => (payment.status === "Rejected" && payment.remarks
        ? <span className="text-red-700">{payment.remarks}</span>
        : "—"),
    },
    {
      key: "actions",
      header: "",
      priority: "action",
      render: (payment) => (
        <button
          type="button"
          onClick={() => setSelectedPayment(payment)}
          className="min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm font-semibold text-sti-blue hover:bg-blue-50 md:w-auto"
        >
          View details
        </button>
      ),
    },
  ];

  return (
    <div className="w-full">
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Filter by Term</h3>
          <p className="text-xs text-gray-500">Select a term to view related payments</p>
        </div>
        <select
          value={selectedTerm}
          onChange={(e) => setFilter("examCoverage", e.target.value === "All" ? "" : e.target.value)}
          className="min-h-11 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        >
          {EXAM_TERMS.map((term) => (
            <option key={term.value || "all"} value={term.value || "All"}>
              {term.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <SortSelect sort={sort} order={order} onChange={setSorting} label="Sort by date submitted" />
        <DateRangeFilter label="Submitted" from={filters.from} to={filters.to} onChange={setDateRange} />
      </div>

      <h2 className="mb-3 text-lg font-bold text-gray-800">
        {selectedTerm === "All" ? "All Payments" : `${EXAM_TERMS.find((t) => t.value === selectedTerm)?.label} Payments`}
      </h2>

      <DataTable
        columns={columns}
        rows={payments}
        loading={loading}
        fetching={fetching}
        skeletonRows={5}
        empty={
          <EmptyState
            icon={IconInbox}
            title="No payments found"
            description={selectedTerm === "All" ? "You haven't submitted any payments yet." : `No payments found for the ${selectedTerm} term.`}
          />
        }
      />

      <Pagination
        meta={meta}
        onPageChange={setPage}
        onLimitChange={setLimit}
        fetching={fetching}
      />

      <PaymentDetailsModal
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        payment={selectedPayment}
      />
    </div>
  );
};

export default PaymentHistory;
