import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPayments } from "../api/paymentApi";
import { getFullyPaidStudents } from "../api/reportApi";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import DashboardCard from "../components/ui/DashboardCard";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";
import {
  IconCheckCircle,
  IconBarChart,
  IconClock,
  IconUsers,
  IconInbox,
} from "../components/icons/Icons";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const CashierDashboard = () => {
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [fullyPaidCount, setFullyPaidCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [paymentsData, fullyPaidData] = await Promise.all([
          getPayments(),
          getFullyPaidStudents(),
        ]);
        setPayments(paymentsData);
        setFullyPaidCount(fullyPaidData.length);
      } catch {
        setError("Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const stats = useMemo(() => ({
    pending: payments.filter((p) => p.status === "Pending").length,
    approved: payments.filter((p) => p.status === "Approved").length,
    rejected: payments.filter((p) => p.status === "Rejected").length,
  }), [payments]);

  const pendingQueue = useMemo(
    () =>
      payments
        .filter((p) => p.status === "Pending")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5),
    [payments]
  );

  return (
    <div>
      <PageHeader
        title="Cashier Dashboard"
        subtitle="Manage and verify student payments."
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending"
          value={stats.pending}
          valueClassName="text-sti-gold"
          variant="icon"
          icon={IconClock}
          iconClassName="bg-sti-gold/10 text-sti-gold"
          subLabel="Awaiting review"
          subLabelClassName="bg-sti-gold/10 text-sti-blue"
          loading={loading}
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          valueClassName="text-sti-blue"
          variant="icon"
          icon={IconCheckCircle}
          iconClassName="bg-blue-50 text-sti-blue"
          subLabel="Verified"
          loading={loading}
        />
        <StatCard
          label="Rejected"
          value={stats.rejected}
          valueClassName="text-red-600"
          variant="icon"
          icon={IconInbox}
          iconClassName="bg-red-50 text-red-600"
          subLabel="Declined"
          subLabelClassName="bg-red-50 text-red-600"
          loading={loading}
        />
        <StatCard
          label="Fully Paid"
          value={fullyPaidCount}
          valueClassName="text-sti-blue"
          variant="icon"
          icon={IconUsers}
          iconClassName="bg-sti-gold/10 text-sti-blue"
          subLabel="Students cleared"
          subLabelClassName="bg-blue-50 text-sti-blue"
          loading={loading}
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <DashboardCard
          title="Verify Payments"
          description="Approve or reject submitted receipts."
          icon={IconCheckCircle}
          onClick={() => navigate("/verify-payments")}
        />
        <DashboardCard
          title="Reports"
          description="View payment verification reports."
          icon={IconBarChart}
          onClick={() => navigate("/reports")}
        />
      </div>

      <div className="relative overflow-hidden rounded-xl border border-sti-gold/20 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div
          className="absolute left-0 top-0 h-full w-1 bg-sti-gold"
          aria-hidden="true"
        />
        <div className="border-b border-gray-100 bg-sti-gold/5 pl-7 pr-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">
              Pending Verification Queue
            </h2>
            <button
              type="button"
              onClick={() => navigate("/verify-payments")}
              className="text-xs font-bold text-sti-blue transition hover:text-sti-blue-light focus:outline-none focus:ring-2 focus:ring-sti-blue/20 rounded px-1"
              aria-label="View all pending payments"
            >
              View all →
            </button>
          </div>
        </div>

        {loading ? (
          <ul className="divide-y divide-gray-50 pl-7 pr-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between py-4">
                <div>
                  <Skeleton className="h-4 w-32 mb-1.5" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-7 w-16 rounded-md" />
              </li>
            ))}
          </ul>
        ) : pendingQueue.length === 0 ? (
          <EmptyState
            icon={IconCheckCircle}
            title="No pending payments"
            description="All receipts have been reviewed."
          />
        ) : (
          <ul className="divide-y divide-gray-50">
            {pendingQueue.map((payment) => (
              <li
                key={payment._id}
                className="flex flex-col gap-2 py-4 pl-7 pr-6 transition hover:bg-sti-gold/5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {payment.studentName || payment.studentId || "Student"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {payment.invoiceNumber
                      ? `Invoice #${payment.invoiceNumber}`
                      : "Receipt"}{" "}
                    · {formatDate(payment.createdAt)}
                    {payment.amount ? ` · ₱${payment.amount}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/verify-payments")}
                  className="inline-flex min-h-11 items-center gap-1 rounded-md bg-blue-50 px-3 py-2.5 text-xs font-bold text-sti-blue transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
                  aria-label={`Review payment from ${payment.studentName || payment.studentId}`}
                >
                  Review
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CashierDashboard;
