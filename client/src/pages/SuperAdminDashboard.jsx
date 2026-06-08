import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllUsers } from "../api/userManagementApi";
import { getPayments } from "../api/paymentApi";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import DashboardCard from "../components/ui/DashboardCard";
import Skeleton from "../components/ui/Skeleton";
import {
  IconUsers,
  IconCheckCircle,
  IconBarChart,
  IconShield,
} from "../components/icons/Icons";

const SuperAdminDashboard = () => {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersData, paymentsData] = await Promise.all([
          getAllUsers(),
          getPayments(),
        ]);
        setUsers(usersData);
        setPayments(paymentsData);
      } catch {
        setError("Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const stats = {
    totalUsers: users.length,
    activeStudents: users.filter(
      (u) => u.role === "student" && u.isActive !== false
    ).length,
    pendingPayments: payments.filter((p) => p.status === "Pending").length,
    approvedPayments: payments.filter((p) => p.status === "Approved").length,
  };

  return (
    <div>
      <PageHeader
        title="Super Admin Dashboard"
        subtitle="Manage users and monitor system activity."
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          valueClassName="text-sti-blue"
          variant="icon"
          icon={IconUsers}
          iconClassName="bg-blue-50 text-sti-blue"
          subLabel="All accounts"
          subLabelClassName="bg-blue-50 text-sti-blue"
          loading={loading}
        />
        <StatCard
          label="Active Students"
          value={stats.activeStudents}
          valueClassName="text-sti-blue"
          variant="icon"
          icon={IconCheckCircle}
          iconClassName="bg-green-50 text-green-600"
          subLabel="Enrolled"
          subLabelClassName="bg-green-50 text-green-600"
          loading={loading}
        />
        <StatCard
          label="Pending Payments"
          value={stats.pendingPayments}
          valueClassName="text-sti-gold"
          variant="icon"
          icon={IconBarChart}
          iconClassName="bg-sti-gold/10 text-sti-gold"
          subLabel="Awaiting review"
          subLabelClassName="bg-sti-gold/10 text-sti-blue"
          loading={loading}
        />
        <StatCard
          label="Approved"
          value={stats.approvedPayments}
          valueClassName="text-sti-blue"
          variant="icon"
          icon={IconShield}
          iconClassName="bg-sti-gold/10 text-sti-blue"
          subLabel="Verified"
          subLabelClassName="bg-blue-50 text-sti-blue"
          loading={loading}
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <DashboardCard
          title="User Management"
          description="Create, edit, and manage system users."
          icon={IconUsers}
          onClick={() => navigate("/user-management")}
        />
        <DashboardCard
          title="System Reports"
          description="View payment and verification reports."
          icon={IconBarChart}
          onClick={() => navigate("/reports")}
        />
      </div>

      {/* Recent Users */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">Recent Users</h2>
          <button
            type="button"
            onClick={() => navigate("/user-management")}
            className="rounded px-1 text-xs font-bold text-sti-blue transition hover:text-sti-blue-light focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
            aria-label="View all users"
          >
            View all →
          </button>
        </div>

        {loading ? (
          <ul className="divide-y divide-gray-50 px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between py-4">
                <div>
                  <Skeleton className="mb-1.5 h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-6 w-16 rounded-md" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-gray-50">
            {users.slice(0, 5).map((u) => (
              <li
                key={u._id}
                className="flex flex-col gap-2 px-6 py-4 transition hover:bg-blue-50/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {u.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {u.email} · {u.studentId}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-md bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sti-blue shadow-sm">
                  {u.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
