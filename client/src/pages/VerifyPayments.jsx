import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPayments,
  approvePayment,
  rejectPayment,
} from "../api/paymentApi";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import Drawer from "../components/ui/Drawer";
import Skeleton from "../components/ui/Skeleton";
import { IconInbox, IconLoader } from "../components/icons/Icons";

const FILTERS = ["All", "Pending", "Approved", "Rejected"];

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

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  const fetchPayments = useCallback(async () => {
    try {
      const data = await getPayments();
      setPayments(data);
      setError("");
    } catch {
      setError("Could not load payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const filtered = useMemo(() => {
    if (filter === "All") return payments;
    return payments.filter((p) => p.status === filter);
  }, [payments, filter]);

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await approvePayment(selected._id);
      showToast("Payment approved successfully.", "success");
      setSelected(null);
      await fetchPayments();
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
    if (!selected) return;
    setActionLoading(true);
    try {
      await rejectPayment(selected._id);
      showToast("Payment rejected.", "info");
      setSelected(null);
      await fetchPayments();
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to reject payment.",
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const drawerFooter =
    selected?.status === "Pending" ? (
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={handleReject}
          disabled={actionLoading}
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:border-red-600 hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-60 min-h-11"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={actionLoading}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-sti-gold px-4 py-2.5 text-sm font-black text-sti-blue shadow-[0_8px_20px_rgba(255,199,44,0.25)] transition hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
        >
          {actionLoading ? <IconLoader className="h-4 w-4" /> : null}
          Approve
        </button>
      </div>
    ) : null;

  return (
    <div>
      <PageHeader
        title="Payment Verification"
        subtitle="Review submitted receipts and approve or reject payments."
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

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

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {["Student", "Invoice", "Amount", "Date", "Status", "Actions"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400"
                    >
                      {col}
                    </th>
                  )
                )}
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
                      description={`No ${filter === "All" ? "" : filter.toLowerCase() + " "}payments to display.`}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((payment) => (
                  <tr
                    key={payment._id}
                    className="group transition-colors hover:bg-blue-50/30"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-sti-blue">
                        {payment.studentName || "—"}
                      </p>
                      <p className="text-xs text-gray-400">{payment.studentId}</p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {payment.invoiceNumber ? `#${payment.invoiceNumber}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-800">
                      {payment.amount ? `₱${payment.amount}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatDate(payment.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <button
                        type="button"
                        onClick={() => setSelected(payment)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-md bg-blue-50 px-3 py-2.5 text-xs font-bold text-sti-blue transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
                        aria-label={`Review payment from ${payment.studentName || payment.studentId}`}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                ["Student", selected.studentName],
                ["Student ID", selected.studentId],
                ["Invoice", selected.invoiceNumber ? `#${selected.invoiceNumber}` : null],
                ["Amount", selected.amount ? `₱${selected.amount}` : null],
                ["Description", selected.paymentDescription],
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
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default VerifyPayments;
