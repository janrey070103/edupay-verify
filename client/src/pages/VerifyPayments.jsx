import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPayments,
  approvePayment,
  rejectPayment,
  createDirectPayment,
  searchStudents,
} from "../api/paymentApi";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import Drawer from "../components/ui/Drawer";
import Skeleton from "../components/ui/Skeleton";
import { IconInbox, IconLoader } from "../components/icons/Icons";

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

  // Receipt verification state
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [remarks, setRemarks] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState("");
  const [rejectionReason, setRejectionReason] = useState("other");

  // Direct payment state
  const [tab, setTab] = useState("receipts"); // "receipts" or "direct"
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [directPaymentForm, setDirectPaymentForm] = useState({
    amount: "",
    paymentDescription: "",
    examCoverage: "",
  });
  const [directPaymentLoading, setDirectPaymentLoading] = useState(false);

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
    const interval = setInterval(fetchPayments, 20000);
    return () => clearInterval(interval);
  }, [fetchPayments]);

  // Search students
  const handleSearchStudents = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchStudents(searchQuery);
      setSearchResults(results);
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to search students.",
        "error"
      );
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, showToast]);

  const filtered = useMemo(() => {
    const list = filter === "All" ? payments : payments.filter((p) => p.status === filter);
    return [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [payments, filter]);

  const handleApprove = async () => {
    if (!selected || !Number.isFinite(Number(confirmedAmount)) || Number(confirmedAmount) <= 0) {
      showToast("Enter the amount verified from the receipt.", "error"); return;
    }
    setActionLoading(true);
    try {
      await approvePayment(selected._id, Number(confirmedAmount));
      showToast("Payment approved successfully.", "success");
      setSelected(null);
      setRemarks("");
      setRejectionReason("other");
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
    if (!selected || !remarks.trim()) { showToast("Rejection remarks are required.", "error"); return; }
    setActionLoading(true);
    try {
      await rejectPayment(selected._id, remarks.trim(), rejectionReason);
      showToast("Payment rejected.", "info");
      setSelected(null);
      setRemarks("");
      setRejectionReason("other");
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

  const handleCreateDirectPayment = async () => {
    if (!selectedStudent || !Number.isFinite(Number(directPaymentForm.amount)) || Number(directPaymentForm.amount) <= 0) {
      showToast("Please select a student and enter an amount.", "error");
      return;
    }

    setDirectPaymentLoading(true);
    try {
      await createDirectPayment({
        studentId: selectedStudent.studentId,
        amount: Number(directPaymentForm.amount),
        paymentDescription: directPaymentForm.paymentDescription || "Direct Payment",
        examCoverage: directPaymentForm.examCoverage || null,
      });

      showToast("Direct payment recorded successfully.", "success");
      setSelectedStudent(null);
      setSearchQuery("");
      setSearchResults([]);
      setDirectPaymentForm({
        amount: "",
        paymentDescription: "",
        examCoverage: "",
      });
      await fetchPayments();
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to record direct payment.",
        "error"
      );
    } finally {
      setDirectPaymentLoading(false);
    }
  };

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
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:border-red-600 hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-60 min-h-11"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={actionLoading || !Number.isFinite(Number(confirmedAmount)) || Number(confirmedAmount) <= 0}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-sti-gold px-4 py-2.5 text-sm font-black text-sti-blue shadow-[0_8px_20px_rgba(255,199,44,0.25)] transition hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
          >
            {actionLoading ? <IconLoader className="h-4 w-4" /> : null}
            Approve
          </button>
        </div>
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
                          {payment.amount != null ? `${peso(payment.amount)}${payment.status === "Approved" ? "" : " (OCR)"}` : "Needs review"}
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
                            onClick={() => {
                              setSelected(payment);
                              setRemarks("");
                              setConfirmedAmount(payment.amount == null ? "" : String(payment.amount));
                              setRejectionReason("other");
                            }}
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
                    ["Amount", selected.amount != null ? `${peso(selected.amount)}${selected.status === "Approved" ? "" : " (OCR estimate)"}` : "Needs review"],
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

                {["Pending", "Need Review"].includes(selected.status) && (
                  <div className="space-y-4 border-t border-gray-200 pt-4">
                    <div>
                      <label htmlFor="verified-amount" className="mb-2 block text-sm font-semibold text-gray-700">Verified amount paid (PHP) *</label>
                      <input id="verified-amount" type="number" min="0.01" step="0.01" value={confirmedAmount}
                        onChange={(e) => setConfirmedAmount(e.target.value)}
                        className="min-h-11 w-full rounded-lg border border-gray-200 px-3" />
                      <p className="mt-1 text-xs text-gray-500">OCR: {selected.amountStatus || "Needs Review"}. Check the receipt before approving.</p>
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
      {tab === "direct" && (
        <div className="grid gap-6">
          {/* Search Section */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
            <h3 className="mb-4 text-lg font-bold text-gray-800">Search Student</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter student ID or name..."
                onKeyPress={(e) => e.key === "Enter" && handleSearchStudents()}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
              />
              <button
                type="button"
                onClick={handleSearchStudents}
                disabled={searchLoading || !searchQuery.trim()}
                className="flex items-center gap-2 rounded-lg bg-sti-blue px-6 py-2.5 font-semibold text-white transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
              >
                {searchLoading ? <IconLoader className="h-4 w-4" /> : null}
                Search
              </button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
              <div className="divide-y divide-gray-100">
                {searchResults.map((student) => (
                  <button
                    key={student._id}
                    type="button"
                    onClick={() => {
                      setSelectedStudent(student);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="w-full p-4 text-left transition hover:bg-blue-50/50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-800">{student.name}</p>
                        <p className="text-sm text-gray-600">
                          ID: {student.studentId}
                        </p>
                        <p className="text-sm text-gray-500">
                          {student.course} - Year {student.yearLevel}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-sti-blue bg-blue-50 px-3 py-1.5 rounded-full">
                        Select
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Payment Form */}
          {selectedStudent && (
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
              <div className="mb-6 pb-6 border-b border-gray-200">
                <h3 className="mb-3 text-lg font-bold text-gray-800">Selected Student</h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold text-gray-700">Name:</span>{" "}
                    <span className="text-gray-600">{selectedStudent.name}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-gray-700">Student ID:</span>{" "}
                    <span className="text-gray-600">{selectedStudent.studentId}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-gray-700">Course:</span>{" "}
                    <span className="text-gray-600">{selectedStudent.course}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Payment Amount <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-lg font-semibold text-gray-600">
                      ₱
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={directPaymentForm.amount}
                      onChange={(e) =>
                        setDirectPaymentForm({
                          ...directPaymentForm,
                          amount: e.target.value,
                        })
                      }
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-200 pl-8 pr-4 py-2.5 text-sm focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Exam Coverage (Optional)
                  </label>
                  <select
                    value={directPaymentForm.examCoverage}
                    onChange={(e) =>
                      setDirectPaymentForm({
                        ...directPaymentForm,
                        examCoverage: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
                  >
                    <option value="">Select exam coverage...</option>
                    <option value="Prelim">Prelim</option>
                    <option value="Midterm">Midterm</option>
                    <option value="PreFinal">Pre-Final</option>
                    <option value="Final">Final</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Payment Description
                  </label>
                  <input
                    type="text"
                    value={directPaymentForm.paymentDescription}
                    onChange={(e) =>
                      setDirectPaymentForm({
                        ...directPaymentForm,
                        paymentDescription: e.target.value,
                      })
                    }
                    placeholder="e.g., Tuition Fee, Lab Fee, etc."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
                  />
                </div>

                <div className="flex gap-3 border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudent(null);
                      setDirectPaymentForm({
                        amount: "",
                        paymentDescription: "",
                        examCoverage: "",
                      });
                    }}
                    disabled={directPaymentLoading}
                    className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300/20 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateDirectPayment}
                    disabled={directPaymentLoading || !Number.isFinite(Number(directPaymentForm.amount)) || Number(directPaymentForm.amount) <= 0}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sti-gold px-4 py-2.5 text-sm font-black text-sti-blue shadow-[0_8px_20px_rgba(255,199,44,0.25)] transition hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
                  >
                    {directPaymentLoading ? <IconLoader className="h-4 w-4" /> : null}
                    Record Payment
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          {!selectedStudent && searchResults.length === 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
              <p className="text-sm text-blue-700">
                💡 Use the search box above to find a student and record their direct payment.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VerifyPayments;
