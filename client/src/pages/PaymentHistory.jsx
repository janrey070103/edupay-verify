import { useEffect, useState, useMemo } from "react";
import { getPayments } from "../api/paymentApi";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";
import PaymentDetailsModal from "../components/ui/PaymentDetailsModal";
import { IconInbox } from "../components/icons/Icons";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const EXAM_TERMS = [
  { label: "All Terms", value: "All" },
  { label: "Prelim", value: "Prelim" },
  { label: "Midterm", value: "Midterm" },
  { label: "Pre-Final", value: "PreFinal" },
  { label: "Final", value: "Final" },
];

const PaymentHistory = () => {

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("All");
  const [selectedPayment, setSelectedPayment] = useState(null);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const data = await getPayments();
        setPayments(data);
      } catch {
        setError("Could not load payment data.");
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  const filteredPayments = useMemo(() => {
    let filtered = [...payments];
    
    if (selectedTerm !== "All") {
      filtered = filtered.filter((p) => p.examCoverage === selectedTerm);
    }
    
    // Sort by date descending
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [payments, selectedTerm]);

  return (
    <div className="mx-auto max-w-4xl">
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Filter by Term</h3>
          <p className="text-xs text-gray-500">Select a term to view related payments</p>
        </div>
        <select
          value={selectedTerm}
          onChange={(e) => setSelectedTerm(e.target.value)}
          className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        >
          {EXAM_TERMS.map((term) => (
            <option key={term.value} value={term.value}>
              {term.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">
            {selectedTerm === "All" ? "All Payments" : `${EXAM_TERMS.find((t) => t.value === selectedTerm)?.label} Payments`}
          </h2>
        </div>

        {loading ? (
          <ul className="divide-y divide-gray-50 px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between py-5">
                <div>
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-20 rounded-md" />
              </li>
            ))}
          </ul>
        ) : filteredPayments.length === 0 ? (
          <EmptyState
            icon={IconInbox}
            title="No payments found"
            description={selectedTerm === "All" ? "You haven't submitted any payments yet." : `No payments found for the ${selectedTerm} term.`}
          />
        ) : (
          <ul className="divide-y divide-gray-50">
            {filteredPayments.map((payment) => (
              <li
                key={payment._id}
                className="flex flex-col gap-3 px-6 py-5 transition hover:bg-blue-50/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-gray-800">
                    {payment.invoiceNumber
                      ? `Invoice #${payment.invoiceNumber}`
                      : payment.paymentDescription || "Payment"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                    <span>{formatDate(payment.createdAt)}</span>
                    {payment.status === "Approved" && payment.amount != null && Number.isFinite(Number(payment.amount)) ? (
                      <>
                        <span className="hidden sm:inline text-gray-300">•</span>
                        <span className="font-medium text-gray-700">{new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(payment.amount)}</span>
                      </>
                    ) : payment.amountStatus === "Detected" ? <span>OCR amount awaiting cashier verification</span> : null}
                    {payment.examCoverage && (
                      <>
                        <span className="hidden sm:inline text-gray-300">•</span>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                          {payment.examCoverage}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <StatusBadge status={payment.status} />
                  {payment.status === "Rejected" && payment.remarks &&
                    <p className="max-w-xs text-sm text-red-700"><strong>Remarks:</strong> {payment.remarks}</p>}
                  <button type="button" onClick={() => setSelectedPayment(payment)}
                    className="min-h-11 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-sti-blue">View details</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PaymentDetailsModal 
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        payment={selectedPayment}
      />
    </div>
  );
};

export default PaymentHistory;
