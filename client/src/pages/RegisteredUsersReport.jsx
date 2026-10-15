import { useEffect, useMemo, useState } from "react";
import { getAllUsers } from "../api/userManagementApi";

const datePH = (value, options) => value ? new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", ...options,
}).format(new Date(value)) : "Unknown";

export default function RegisteredUsersReport() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All");
  const [sort, setSort] = useState("name");
  const [direction, setDirection] = useState(1);
  useEffect(() => { getAllUsers().then(setUsers).catch(() => setError("Could not load registered users."))
    .finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => users.filter((user) =>
    (role === "All" || user.role === role) &&
    [user.name, user.studentId, user.role].some((value) => String(value || "").toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => {
    if (sort === "createdAt") return ((new Date(a.createdAt || 0)) - (new Date(b.createdAt || 0))) * direction;
    return String(a[sort] || "").localeCompare(String(b[sort] || ""), "en", { sensitivity: "base" }) * direction;
  }), [users, role, search, sort, direction]);
  const sortBy = (key) => { setDirection(sort === key ? -direction : 1); setSort(key); };
  return <div>
    <h2 className="text-xl font-bold text-gray-800">Registered Users Report</h2>
    <p className="mt-1 text-sm text-gray-500">Total registered users: <strong>{users.length}</strong></p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-6 flex flex-wrap gap-3">
      <label className="sr-only" htmlFor="report-search">Search users</label>
      <input id="report-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users"
        className="min-h-11 flex-1 rounded-lg border border-gray-200 px-3" />
      <label className="sr-only" htmlFor="report-role">Filter role</label>
      <select id="report-role" value={role} onChange={(e) => setRole(e.target.value)} className="min-h-11 rounded-lg border border-gray-200 px-3">
        {["All", "student", "cashier", "teacher", "super_admin", "admin"].map((value) => <option key={value}>{value}</option>)}
      </select>
    </div>
    <div className="mt-5 overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr>
        {[["Full Name", "name"], ["Student ID", "studentId"], ["User Role", "role"], ["Date Created", "createdAt"], ["Time Created", "createdAt"]]
          .map(([label, key]) => <th key={label} className="px-5 py-4"><button type="button" onClick={() => sortBy(key)} className="font-bold hover:text-sti-blue">{label}</button></th>)}
      </tr></thead><tbody className="divide-y divide-gray-100">
        {loading ? <tr><td colSpan={5} className="p-6 text-gray-500">Loading users…</td></tr> : filtered.length === 0 ?
          <tr><td colSpan={5} className="p-6 text-gray-500">No users match your filters.</td></tr> :
          filtered.map((user) => <tr key={user._id}>
            <td className="px-5 py-4 font-semibold">{user.name}</td><td className="px-5 py-4">{user.role === "student" ? user.studentId || "—" : "—"}</td>
            <td className="px-5 py-4">{user.role}</td>
            <td className="px-5 py-4">{datePH(user.createdAt, { dateStyle: "medium" })}</td>
            <td className="px-5 py-4">{datePH(user.createdAt, { timeStyle: "short" })}</td>
          </tr>)}
      </tbody></table>
    </div>
    <p className="mt-3 text-xs text-gray-500">Showing {filtered.length} of {users.length} users.</p>
  </div>;
}
