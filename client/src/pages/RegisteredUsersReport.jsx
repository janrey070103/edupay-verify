import { useEffect, useState } from "react";
import { getAllUsers } from "../api/userManagementApi";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import EmptyState from "../components/ui/EmptyState";
import usePaginated from "../hooks/usePaginated";
import { formatCreatedPH } from "../utils/userPresentation";
import { IconUsers } from "../components/icons/Icons";

const ROLES = ["All", "student", "cashier", "teacher", "super_admin", "admin"];
const roleText = (role) => String(role).split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export default function RegisteredUsersReport() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All");

  const {
    rows: users,
    meta,
    loading,
    fetching,
    error,
    filters,
    setFilter,
    setPage,
    setLimit,
    sort,
    order,
    toggleSort,
  } = usePaginated(
    ({ search: searchTerm, role: roleFilter, ...params }) =>
      getAllUsers({
        ...params,
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
      }),
    { initialLimit: 50, initialFilters: { search: "", role: "" }, initialSort: "name", initialOrder: "asc" }
  );

  useEffect(() => {
    const timer = setTimeout(() => setFilter("search", search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search, setFilter]);

  const columns = [
    {
      key: "name",
      header: "Full Name",
      priority: "primary",
      render: (user) => <p className="text-sm font-semibold text-gray-800">{user.name}</p>,
    },
    {
      key: "studentId",
      header: "Student / Employee ID",
      priority: "meta",
      render: (user) => user.studentId || "—",
    },
    { key: "role", header: "User Role", priority: "meta", render: (user) => roleText(user.role) },
    {
      key: "createdAt",
      header: "Date Created",
      priority: "meta",
      render: (user) => (user.createdAt
        ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" }).format(new Date(user.createdAt))
        : "Unknown"),
    },
    {
      key: "createdTime",
      header: "Time Created",
      priority: "meta",
      render: (user) => (user.createdAt
        ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", timeStyle: "short" }).format(new Date(user.createdAt))
        : "—"),
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800">Registered Users Report</h2>
      <p className="mt-1 text-sm text-gray-500">
        Total registered users: <strong>{loading ? "…" : meta.total}</strong>
      </p>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="report-search">Search users</label>
        <input
          id="report-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users"
          className="min-h-11 flex-1 rounded-lg border border-gray-200 px-3"
        />
        <label className="sr-only" htmlFor="report-role">Filter role</label>
        <select
          id="report-role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setFilter("role", e.target.value === "All" ? "" : e.target.value);
          }}
          className="min-h-11 rounded-lg border border-gray-200 px-3"
        >
          {ROLES.map((value) => <option key={value} value={value}>{roleText(value)}</option>)}
        </select>
        <button
          type="button"
          onClick={() => toggleSort("name")}
          className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700"
        >
          Name {sort === "name" && order === "desc" ? "Z–A" : "A–Z"}
        </button>
        <button
          type="button"
          onClick={() => toggleSort("createdAt", "desc")}
          className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700"
        >
          Date {sort === "createdAt" && order === "asc" ? "oldest" : "newest"}
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Showing {users.length} of {meta.total} users
        {filters.search ? ` matching “${filters.search}”` : ""}.
      </p>

      <DataTable
        columns={columns}
        rows={users}
        loading={loading}
        fetching={fetching}
        skeletonRows={5}
        className="mt-3"
        empty={
          <EmptyState
            icon={IconUsers}
            title="No users found"
            description="No users match your filters."
          />
        }
      />

      <Pagination
        meta={meta}
        onPageChange={setPage}
        onLimitChange={setLimit}
        limitOptions={[25, 50, 100]}
        fetching={fetching}
      />

      <p className="mt-3 text-xs text-gray-500">Generated {formatCreatedPH(new Date())}</p>
    </div>
  );
}
