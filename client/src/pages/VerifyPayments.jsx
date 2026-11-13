import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPayments,
  getPaymentSummary,
  approvePayment,
  rejectPayment,
} from "../api/paymentApi";
import { useToast } from "../context/ToastContext";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import Drawer from "../components/ui/Drawer";
import DirectPaymentPanel from "../components/DirectPaymentPanel";
import ReceiptCheckSummary from "../components/ReceiptCheckSummary";
import { channelLabel, channelShort } from "../utils/paymentChannels";
import usePaginated from "../hooks/usePaginated";
import { IconInbox, IconLoader } from "../components/icons/Icons";
import { NAV_BADGES_EVENT, formatBadge, refreshNavBadges } from "../utils/navBadges";
import SortSelect from "../components/ui/SortSelect";
import PaidViaSelect from "../components/ui/PaidViaSelect";
import DateRangeFilter from "../components/ui/DateRangeFilter";

const FILTERS = ["All", "Pending", "Need Review", "Approved", "Rejected"];
const peso = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
const REJECTION_REASONS = [
  { value: "blurry", label: "Image is blurry" },
  { value: "incomplete", label: "Receipt incomplete" },
  { value: "invalid", label: "Invalid receipt" },
  { value: "duplicate", label: "Duplicate payment" },
  { value: "other", label: "Other reason" },
];

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const VerifyPayments = () => {
  const { showToast } = useToast();

  const [actionLoading, setActionLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState("");
  const [rejectionReason, setRejectionReason] = useState("other");
  const amountRef = useRef(null);

  const [tab, setTab] = useState("receipts");

  const {
    rows: payments,
    meta,
    limit,
    loading,
    fetching,
    error,
    filters,
    sort,
    order,
    setFilter: setStatusFilter,
    setSorting,
    setDateRange,
    setPage,
    setLimit,
    refresh,
  } = usePaginated(
    ({ status, ...params }) => getPayments(status ? { ...params, status } : params),
    { initialLimit: 20, initialFilters: { status: "", from: "", to: "", channel: "" }, initialSort: "createdAt", initialOrder: "desc" }
  );


  const filter = filters.status || "All";

  // Counts for the alert badges on the "Pending" / "Need Review" pills.
  const [statusCounts, setStatusCounts] = useState({});
  const loadCounts = useCallback(() => getPaymentSummary()
    .then((summary) => setStatusCounts({ Pending: summary?.pending ?? 0, "Need Review": summary?.needReview ?? 0 }))
    .catch(() => {}), []);

  // Refresh keeps the current page so a poll never moves the cashier away from
  // the row they are reviewing.
  useEffect(() => {
    loadCounts();
    const interval = setInterval(() => { refresh(); loadCounts(); }, 20000);
    window.addEventListener(NAV_BADGES_EVENT, loadCounts);
    return () => {
      clearInterval(interval);
      window.removeEventListener(NAV_BADGES_EVENT, loadCounts);
    };
  }, [refresh, loadCounts]);


  const openReview = (payment) => {
    setSelected(payment);
    setRemarks("");
    setConfirmedAmount(payment.amount == null ? "" : String(payment.amount));
    setRejectionReason("other");
  };

  // Opened from a "New Receipt Submitted" notification: /verify-payments?review=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("review");
    if (!id) return;
    window.history.replaceState(null, "", window.location.pathname);
    getPayments({ id, limit: 1 })
      .then((result) => {
        const payment = result?.data?.[0];
        if (payment) openReview(payment);
        else showToast("That receipt is no longer available.", "info");
      })
      .catch(() => showToast("Could not open that receipt.", "error"));
    // Runs once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amountIsValid = Number.isFinite(Number(confirmedAmount)) && Number(confirmedAmount) > 0;

  const handleApprove = async () => {
    if (!selected || actionLoading) return;
    if (!amountIsValid) {
      // OCR often cannot read the amount; the cashier must type it. Point them at
      // the field instead of leaving a silently disabled button.
      showToast("Enter the verified amount from the receipt before approving.", "error");
      amountRef.current?.focus();
      return;
    }
    setActionLoading(true);
    try {
      await approvePayment(selected._id, Number(confirmedAmount));
      showToast("Payment approved successfully.", "success");
      setSelected(null);
      setRemarks("");
      setConfirmedAmount("");
      setRejectionReason("other");
      refreshNavBadges();
      // Reload the list in the background; the next receipt can be reviewed
      // and approved right away without waiting for it.
      refresh();
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to approve payment.",
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !remarks.trim()) { showToast("Rejection remarks are required.", "error"); return; }
    setActionLoading(true);
    try {
      await rejectPayment(selected._id, remarks.trim(), rejectionReason);
      showToast("Payment rejected.", "info");
      setSelected(null);
      setRemarks("");
      setConfirmedAmount("");
      setRejectionReason("other");
      refreshNavBadges();
      refresh();
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to reject payment.",
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    {
      key: "studentName",
      header: "Student ID / Name",
      priority: "primary",
      render: (payment) => (
        <>
          <p className="text-sm font-bold text-gray-800 group-hover:text-sti-blue">{payment.studentId || "—"}</p>
          <p className="text-xs text-gray-500">{payment.studentName || "—"}</p>
        </>
      ),
    },
    {
      key: "invoiceNumber",
      header: "Reference",
      priority: "meta",
      render: (payment) => payment.referenceNumber || (payment.invoiceNumber ? `#${payment.invoiceNumber}` : "—"),
    },
    {
      key: "amount",
      header: "Amount",
      priority: "meta",
      render: (payment) => (payment.amount != null
        ? `${peso(payment.amount)}${payment.status === "Approved" ? "" : payment.claimedAmount != null ? " (typed)" : " (OCR)"}`
        : "Needs review"),
    },
    {
      key: "check",
      header: "Check",
      priority: "meta",
      // At-a-glance result of the automatic receipt check.
      render: (payment) => {
        if (!payment.ocr) return "—";
        const flags = payment.ocr.flags?.length || 0;
        const ok = payment.ocr.amount?.status === "matched";
        return (
          <span className={`inline-flex items-center gap-1 text-xs font-bold ${flags ? "text-amber-700" : ok ? "text-green-700" : "text-gray-500"}`}>
            {flags ? `⚠ ${flags} warning${flags === 1 ? "" : "s"}` : ok ? "✓ Amount found" : "Check manually"}
          </span>
        );
      },
    },
    {
      key: "paymentChannel",
      header: "Paid via",
      priority: "meta",
      render: (payment) => (payment.paymentMethod === "direct" ? "Cashier (direct)" : channelShort(payment.paymentChannel)),
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
    {
      key: "actions",
      header: "Actions",
      priority: "action",
      render: (payment) => (
        <button
          type="button"
          onClick={() => openReview(payment)}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-blue-50 px-3 py-2.5 text-xs font-bold text-sti-blue transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
          aria-label={`Review payment from ${payment.studentId || payment.studentName}`}
        >
          Review
        </button>
      ),
    },
  ];

  const drawerFooter =
    ["Pending", "Need Review"].includes(selected?.status) ? (
      <div className="flex flex-col gap-4">
        {remarks && (
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
            <p className="font-semibold mb-1">Remarks to student:</p>
            <p>{remarks}</p>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleReject}
            disabled={actionLoading || !remarks.trim()}
            className="min-h-11 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:border-red-600 hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={actionLoading}
            aria-busy={actionLoading}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-sti-gold px-4 py-2.5 text-sm font-black text-sti-blue shadow-[0_8px_20px_rgba(255,199,44,0.25)] transition hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:cursor-wait disabled:opacity-60"
          >
            {actionLoading ? <IconLoader className="h-4 w-4" /> : null}
            {actionLoading ? "Processing…" : "Approve"}
          </button>
        </div>
        {!amountIsValid && (
          <p className="text-right text-xs font-semibold text-amber-700">
            Enter the verified amount above to approve this receipt.
          </p>
        )}
      </div>
    ) : null;

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab("receipts")}
          className={`px-4 py-3 font-semibold transition ${
            tab === "receipts"
              ? "border-b-2 border-sti-blue text-sti-blue"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Receipt Verification
        </button>
        <button
          type="button"
          onClick={() => setTab("direct")}
          className={`px-4 py-3 font-semibold transition ${
            tab === "direct"
              ? "border-b-2 border-sti-blue text-sti-blue"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Direct Payment
        </button>
      </div>

      {/* Receipt Verification Tab */}
      {tab === "receipts" && (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {FILTERS.map((status) => {
              const count = statusCounts[status] || 0;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter("status", status === "All" ? "" : status)}
                  className={[
                    "relative inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-sti-blue/20",
                    filter === status
                      ? "bg-sti-blue text-white shadow-[0_4px_14px_rgba(0,61,165,0.35)]"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                  ].join(" ")}
                  aria-label={count > 0 ? `${status}, ${count} waiting` : status}
                >
                  {status}
                  {count > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-black leading-none text-white ring-2 ring-white">
                      {formatBadge(count)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mb-6 flex flex-wrap items-end gap-3">
            <SortSelect sort={sort} order={order} onChange={setSorting} label="Sort by date submitted" />
            <PaidViaSelect value={filters.channel} onChange={(value) => setStatusFilter("channel", value)} />
            <DateRangeFilter label="Submitted" from={filters.from} to={filters.to} onChange={setDateRange} />
          </div>

          <DataTable
            columns={columns}
            rows={payments}
            loading={loading}
            fetching={fetching}
            skeletonRows={Math.min(limit, 5)}
            empty={
              <EmptyState
                icon={IconInbox}
                title="No payments found"
                description={`No ${filter === "All" ? "" : filter.toLowerCase() + " "}payments to display.`}
              />
            }
          />

          <Pagination
            meta={meta}
            onPageChange={setPage}
            onLimitChange={setLimit}
            fetching={fetching}
          />

          <Drawer
            open={!!selected}
            onClose={() => !actionLoading && setSelected(null)}
            title="Payment Review"
            footer={drawerFooter}
          >
            {selected && (
              <div className="space-y-5">
                {selected.receiptImage && (
                  <div className="overflow-hidden rounded-xl border border-gray-100">
                    <img
                      src={selected.receiptImage}
                      alt="Receipt"
                      className="w-full object-contain"
                    />
                  </div>
                )}

                <dl className="space-y-3 text-sm">
                  {[
                    ["Student ID", selected.studentId],
                    ["Student", selected.studentName],
                    ["Reference", selected.referenceNumber || (selected.invoiceNumber ? `#${selected.invoiceNumber}` : null)],
                    ["Amount", selected.amount != null ? `${peso(selected.amount)}${selected.status === "Approved" ? "" : selected.claimedAmount != null ? " (typed by student)" : " (OCR estimate)"}` : "Needs review"],
                    ["Description", selected.paymentDescription],
                    ["Payment mode", selected.paymentMethod === "direct" ? "Cash at cashier (direct)" : channelLabel(selected.paymentChannel)],
                    ["Submitted", formatDate(selected.createdAt)],
                    ["Status", null],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-gray-50 pb-3">
                      <dt className="font-medium text-gray-500">{label}</dt>
                      <dd className="text-right font-semibold text-gray-800">
                        {label === "Status" ? (
                          <StatusBadge status={selected.status} />
                        ) : (
                          value || "—"
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>

                <ReceiptCheckSummary ocr={selected.ocr} detailed
                  claimedAmount={selected.claimedAmount} referenceNumber={selected.referenceNumber} />

                {["Pending", "Need Review"].includes(selected.status) && (
                  <div className="space-y-4 border-t border-gray-200 pt-4">
                    <div>
                      <label htmlFor="verified-amount" className="mb-2 block text-sm font-semibold text-gray-700">Verified amount paid (PHP) *</label>
                      <input id="verified-amount" ref={amountRef} type="number" min="0.01" step="0.01" inputMode="decimal"
                        value={confirmedAmount}
                        onChange={(e) => setConfirmedAmount(e.target.value)}
                        placeholder="Type the amount shown on the receipt"
                        className={`min-h-11 w-full rounded-lg border px-3 focus:outline-none focus:ring-2 ${
                          amountIsValid ? "border-gray-200 focus:border-sti-blue focus:ring-sti-blue/20" : "border-amber-400 bg-amber-50/40 focus:ring-amber-400/30"
                        }`} />
                      <p className="mt-1 text-xs text-gray-500">
                        {selected.claimedAmount != null ? "Pre-filled with the amount the student typed. " : ""}Check it against the receipt before approving.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Rejection Reason
                      </label>
                      <select
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
                      >
                        {REJECTION_REASONS.map((reason) => (
                          <option key={reason.value} value={reason.value}>
                            {reason.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Rejection remarks to student *
                      </label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder='e.g., "The image is blurry, please upload a clearer copy" or "Please make sure to include the student ID on the receipt"'
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
                        rows={4}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        This message will be sent to the student when they receive the rejection.
                      </p>
                    </div>
                  </div>
                )}

                {selected.remarks && (
                  <div className="rounded-lg bg-yellow-50 p-3 text-sm border border-yellow-200">
                    <p className="font-semibold text-yellow-900 mb-1">Previous Remarks:</p>
                    <p className="text-yellow-800">{selected.remarks}</p>
                  </div>
                )}
              </div>
            )}
          </Drawer>
        </>
      )}

      {/* Direct Payment Tab */}
      {tab === "direct" && <DirectPaymentPanel onRecorded={refresh} />}
    </div>
  );
};

export default VerifyPayments;
