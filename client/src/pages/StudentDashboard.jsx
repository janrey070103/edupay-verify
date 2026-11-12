import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPayments, getPaymentSummary } from "../api/paymentApi";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import DashboardCard from "../components/ui/DashboardCard";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";
import PaymentDetailsModal from "../components/ui/PaymentDetailsModal";
import StudentLedger from "../components/StudentLedger";
import {
  IconUpload,
  IconBell,
  IconTicket,
  IconInbox,
  IconClock,
  IconCheckCircle,
  IconXCircle,
} from "../components/icons/Icons";
import { mergeDetails, peso, termList } from "../utils/summaryText";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const StudentDashboard = () => {
  const navigate = useNavigate();

  const [recentPayments, setRecentPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const [recent, totals] = await Promise.all([
          getPayments({ limit: 5 }),
          getPaymentSummary(),
        ]);
        setRecentPayments(recent.data);
        setSummary(totals);
      } catch {
        setError("Could not load payment data.");
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  // Each card says what it counts: receipts vs payments, which exam terms, how much.
  const cards = useMemo(() => {
    const d = summary.details || {};
    const review = mergeDetails(d.pending, d.needReview);
    const approved = mergeDetails(d.approved, d.directPayment);
    const rejected = d.rejected || { count: 0, terms: [] };
    const allTerms = mergeDetails(d.pending, d.needReview, d.approved, d.rejected, d.directPayment).terms;
    return { submitted: summary.receiptsSubmitted ?? summary.total ?? 0, allTerms, review, approved, rejected };
  }, [summary]);

  return (
    <div>
      <StudentLedger />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Receipts Submitted"
          value={cards.submitted}
          valueClassName="text-sti-blue"
          variant="icon"
          icon={IconUpload}
          iconClassName="bg-blue-50 text-sti-blue"
          subLabel="Tuition receipts"
          subLabelClassName="bg-blue-50 text-sti-blue"
          detail={termList(cards.allTerms, "No receipts yet")}
          loading={loading}
        />
        <StatCard
          label="In Cashier Review"
          value={cards.review.count}
          valueClassName="text-amber-600"
          variant="icon"
          icon={IconClock}
          iconClassName="bg-amber-50 text-amber-600"
          subLabel={cards.review.count ? `${peso(cards.review.amount)} awaiting approval` : "Nothing waiting"}
          subLabelClassName="bg-amber-50 text-amber-700"
          detail={cards.review.count ? `${termList(cards.review.terms)}${cards.review.noAmount ? ` · ${cards.review.noAmount} amount to confirm` : ""}` : "Receipts the cashier has not checked yet"}
          loading={loading}
        />
        <StatCard
          label="Payments Approved"
          value={cards.approved.count}
          valueClassName="text-green-600"
          variant="icon"
          icon={IconCheckCircle}
          iconClassName="bg-green-50 text-green-600"
          subLabel={`${peso(cards.approved.amount)} credited to tuition`}
          subLabelClassName="bg-green-50 text-green-700"
          detail={cards.approved.count ? termList(cards.approved.terms, "Balance payments") : "No approved payments yet"}
          loading={loading}
        />
        <StatCard
          label="Rejected Receipts"
          value={cards.rejected.count}
          valueClassName="text-red-600"
          variant="icon"
          icon={IconXCircle}
          iconClassName="bg-red-50 text-red-600"
          subLabel={cards.rejected.count ? "Upload a new receipt" : "None rejected"}
          subLabelClassName="bg-red-50 text-red-700"
          detail={cards.rejected.count ? termList(cards.rejected.terms) : "Receipts the cashier sent back"}
          loading={loading}
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <DashboardCard
          title="Upload Receipt"
          description="Submit payment receipts."
          icon={IconUpload}
          onClick={() => navigate("/upload")}
        />
        <DashboardCard
          title="Notifications"
          description="View payment updates."
          icon={IconBell}
          onClick={() => navigate("/notifications")}
        />
        <DashboardCard
          title="Exam Permit"
          description="View digital permit."
          icon={IconTicket}
          onClick={() => navigate("/permit")}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">Recent Payment Activity</h2>
          <button
            type="button"
            onClick={() => navigate("/history")}
            className="text-xs font-bold text-blue-600 transition hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded px-1"
            aria-label="View all history"
          >
            View all history →
          </button>
        </div>

        {loading ? (
          <ul className="divide-y divide-gray-50 px-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between py-4">
                <div>
                  <Skeleton className="h-4 w-40 mb-1.5" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-md" />
              </li>
            ))}
          </ul>
        ) : recentPayments.length === 0 ? (
          <EmptyState
            icon={IconInbox}
            title="No payments submitted yet"
            description="Upload your first receipt to get started."
          />
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentPayments.map((payment) => (
              <li
                key={payment._id}
                className="flex flex-col gap-2 px-6 py-4 transition hover:bg-blue-50/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {payment.invoiceNumber
                      ? `Invoice #${payment.invoiceNumber}`
                      : payment.paymentDescription || "Payment"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(payment.createdAt)}
                    {payment.amount ? ` · ₱${payment.amount}` : ""}
                  </p>
                </div>
                <StatusBadge 
                  status={payment.status} 
                  onClick={payment.status === "Approved" ? () => setSelectedPayment(payment) : undefined} 
                />
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

export default StudentDashboard;
