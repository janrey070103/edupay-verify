import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAllUsers,
  createUser,
  updateUser,
  deactivateUser,
} from "../api/userManagementApi";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/ui/PageHeader";
import Drawer from "../components/ui/Drawer";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import {
  IconUsers,
  IconUserPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconLoader,
} from "../components/icons/Icons";

const ROLES = ["student", "cashier", "admin", "teacher"];
const FILTERS = ["All", "Student", "Cashier", "Admin", "Teacher"];

const UserManagement = () => {
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  /* Drawer state */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("create"); // "create" | "edit"
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [editingUser, setEditingUser] = useState(null);

  /* Form state */
  const [form, setForm] = useState({
    studentId: "",
    name: "",
    email: "",
    password: "",
    role: "student",
    course: "",
    yearLevel: "",
    semester: "",
    schoolYear: "",
  });

  const fetchUsers = useCallback(async () => {
    try {
      const data = await getAllUsers();
      setUsers(data);
      setError("");
    } catch {
      setError("Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = useMemo(() => {
    let list = users;
    if (filter !== "All") {
      list = list.filter((u) => u.role === filter.toLowerCase());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.studentId || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, filter, search]);

  const resetForm = () =>
    setForm({
      studentId: "",
      name: "",
      email: "",
      password: "",
      role: "student",
      course: "",
      yearLevel: "",
      semester: "",
      schoolYear: "",
    });

  const openCreate = () => {
    resetForm();
    setDrawerMode("create");
    setDrawerError("");
    setEditingUser(null);
    setDrawerOpen(true);
  };

  const openEdit = (user) => {
    setForm({
      studentId: user.studentId || "",
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "student",
      course: user.course || "",
      yearLevel: user.yearLevel?.toString() || "",
      semester: user.semester || "",
      schoolYear: user.schoolYear || "",
    });
    setDrawerMode("edit");
    setDrawerError("");
    setEditingUser(user);
    setDrawerOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setDrawerLoading(true);
    setDrawerError("");

    try {
      if (drawerMode === "create") {
        await createUser(form);
        showToast("User created successfully.", "success");
      } else {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await updateUser(editingUser._id, payload);
        showToast("User updated successfully.", "success");
      }
      setDrawerOpen(false);
      await fetchUsers();
    } catch (err) {
      const msg =
        err.response?.data?.message || "Operation failed. Please try again.";
      setDrawerError(msg);
      showToast(msg, "error");
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleDeactivate = async (user) => {
    if (
      !window.confirm(
        `Deactivate ${user.name}? They will no longer be able to log in.`
      )
    )
      return;

    try {
      await deactivateUser(user._id);
      showToast(`${user.name} has been deactivated.`, "info");
      await fetchUsers();
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to deactivate user.",
        "error"
      );
    }
  };

  const updateField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const drawerTitle =
    drawerMode === "create" ? "Create New User" : "Edit User";

  const drawerFooter = (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={() => setDrawerOpen(false)}
        disabled={drawerLoading}
        className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={drawerLoading}
        className="flex min-h-11 items-center gap-2 rounded-lg bg-sti-gold px-5 py-2.5 text-sm font-black text-sti-blue shadow-[0_8px_20px_rgba(255,199,44,0.25)] transition hover:-translate-y-0.5 hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-70"
      >
        {drawerLoading ? <IconLoader className="h-4 w-4" /> : null}
        {drawerMode === "create" ? "Create User" : "Save Changes"}
      </button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Create, edit, and manage all system users."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-sti-gold px-5 py-2.5 text-sm font-black text-sti-blue shadow-[0_8px_20px_rgba(255,199,44,0.25)] transition hover:-translate-y-0.5 hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
          >
            <IconUserPlus className="h-4 w-4" />
            Add User
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Search + filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <IconSearch className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search by name, email, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-4 text-sm font-medium text-gray-700 shadow-sm outline-none transition focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20"
            aria-label="Search users"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={[
              "min-h-11 rounded-lg px-4 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-sti-blue/20",
              filter === f
                ? "bg-sti-blue text-white shadow-[0_4px_14px_rgba(0,61,165,0.35)]"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Users table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {["Name", "Email", "Student ID", "Role", "Status", "Actions"].map(
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
                      icon={IconUsers}
                      title="No users found"
                      description="No users match the current filters."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr
                    key={user._id}
                    className="group transition-colors hover:bg-blue-50/30"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-sti-blue">
                        {user.name}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {user.studentId || "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex rounded-md bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sti-blue shadow-sm">
                        {user.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {user.isActive === false ? (
                        <span className="inline-flex rounded-md bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-500 shadow-sm">
                          Inactive
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-green-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-600 shadow-sm">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                          className="inline-flex min-h-11 items-center gap-1 rounded-md bg-blue-50 px-3 py-2.5 text-xs font-bold text-sti-blue transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
                          aria-label={`Edit ${user.name}`}
                        >
                          <IconEdit className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        {user.isActive !== false && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(user)}
                            className="inline-flex min-h-11 items-center gap-1 rounded-md bg-red-50 px-3 py-2.5 text-xs font-bold text-red-500 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                            aria-label={`Deactivate ${user.name}`}
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        {!loading && filtered.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-3">
            <p className="text-xs font-semibold text-gray-400">
              Showing {filtered.length} user{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => !drawerLoading && setDrawerOpen(false)}
        title={drawerTitle}
        footer={drawerFooter}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {drawerError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {drawerError}
            </div>
          )}

          <div>
            <label
              htmlFor="um-studentId"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Student / Employee ID
            </label>
            <input
              id="um-studentId"
              type="text"
              value={form.studentId}
              onChange={(e) => updateField("studentId", e.target.value)}
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20"
            />
          </div>

          <div>
            <label
              htmlFor="um-name"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Full Name
            </label>
            <input
              id="um-name"
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20"
            />
          </div>

          <div>
            <label
              htmlFor="um-email"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="um-email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20"
            />
          </div>

          <div>
            <label
              htmlFor="um-password"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Password{" "}
              {drawerMode === "edit" && (
                <span className="text-xs text-gray-400">
                  (leave blank to keep current)
                </span>
              )}
            </label>
            <input
              id="um-password"
              type="password"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              required={drawerMode === "create"}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20"
            />
          </div>

          <div>
            <label
              htmlFor="um-role"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Role
            </label>
            <select
              id="um-role"
              value={form.role}
              onChange={(e) => updateField("role", e.target.value)}
              className="min-h-11 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="um-course"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Course
              </label>
              <input
                id="um-course"
                type="text"
                value={form.course}
                onChange={(e) => updateField("course", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20"
              />
            </div>
            <div>
              <label
                htmlFor="um-yearLevel"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Year Level
              </label>
              <input
                id="um-yearLevel"
                type="number"
                min="1"
                max="6"
                value={form.yearLevel}
                onChange={(e) => updateField("yearLevel", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="um-semester"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Semester
              </label>
              <input
                id="um-semester"
                type="text"
                value={form.semester}
                onChange={(e) => updateField("semester", e.target.value)}
                placeholder="e.g. 1st Semester"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20"
              />
            </div>
            <div>
              <label
                htmlFor="um-schoolYear"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                School Year
              </label>
              <input
                id="um-schoolYear"
                type="text"
                value={form.schoolYear}
                onChange={(e) => updateField("schoolYear", e.target.value)}
                placeholder="e.g. 2025-2026"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20"
              />
            </div>
          </div>
        </form>
      </Drawer>
    </div>
  );
};

export default UserManagement;
