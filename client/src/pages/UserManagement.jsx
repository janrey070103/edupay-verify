import { useEffect, useState } from "react";
import {
  getAllUsers,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
} from "../api/userManagementApi";
import { useToast } from "../context/ToastContext";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import Drawer from "../components/ui/Drawer";
import EmptyState from "../components/ui/EmptyState";
import usePaginated from "../hooks/usePaginated";
import useCatalog from "../hooks/useCatalog";
import { currentSchoolYear } from "../utils/schoolYear";
import CourseSelect from "../components/ui/CourseSelect";
import SortSelect from "../components/ui/SortSelect";
import DateRangeFilter from "../components/ui/DateRangeFilter";

const USER_SORTS = [
  { label: "Last name A–Z", sort: "name", order: "asc" },
  { label: "Last name Z–A", sort: "name", order: "desc" },
  { label: "Newest first", sort: "createdAt", order: "desc" },
  { label: "Oldest first", sort: "createdAt", order: "asc" },
];
import { formatCreatedPH, formatLastFirst, splitLegacyName } from "../utils/userPresentation";
import {
  IconUsers,
  IconUserPlus,
  IconEdit,
  IconSearch,
  IconLoader,
  IconArchive,
  IconRestore,
} from "../components/icons/Icons";

const EMPTY_FORM = {
  studentId: "",
  lastName: "",
  firstName: "",
  middleName: "",
  email: "",
  password: "",
  role: "student",
  course: "",
  yearLevel: "",
  semester: "",
  schoolYear: "",
  department: "",
};

const INPUT = "min-h-11 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

const ROLES = ["student", "cashier", "teacher", "admin", "super_admin"];
const FILTERS = [
  { label: "All", value: "" },
  { label: "Student", value: "student" },
  { label: "Cashier", value: "cashier" },
  { label: "Teacher", value: "teacher" },
  { label: "Admin", value: "admin" },
  { label: "Super Admin", value: "super_admin" },
];

const roleText = (role) => String(role).split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const UserManagement = () => {
  // Opened from the Super Admin dashboard warning: /user-management?courseIssue=1
  const [initialCourseIssue] = useState(() => new URLSearchParams(window.location.search).get("courseIssue") === "1");
  const { showToast } = useToast();

  const [error] = useState("");
  const [search, setSearch] = useState("");

  const {
    rows: users,
    meta,
    loading,
    fetching,
    error: listError,
    filters,
    setFilter: setQueryFilter,
    setPage,
    setLimit,
    refresh,
    sort,
    order,
    setSorting,
    setDateRange,
    setFilters: setQueryFilters,
  } = usePaginated(
    ({ search: searchTerm, role, courseIssue, ...params }) =>
      getAllUsers({
        ...params,
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(role ? { role } : {}),
        ...(courseIssue ? { courseIssue: "1" } : {}),
      }),
    { initialLimit: 25, initialFilters: { search: "", role: "", courseIssue: initialCourseIssue, from: "", to: "" },
      initialSort: "name", initialOrder: "asc" }
  );

  // Debounce typing so each keystroke does not hit the API.
  useEffect(() => {
    const timer = setTimeout(() => setQueryFilter("search", search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search, setQueryFilter]);

  /* Drawer state */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("create");
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [editingUser, setEditingUser] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const { departments, courses } = useCatalog();
  const [nameGuessed, setNameGuessed] = useState(false);
  const [statusAction, setStatusAction] = useState("");
  const [superAdminExists, setSuperAdminExists] = useState(false);

  // Only one super admin may exist; hide that role choice once it is taken.
  useEffect(() => {
    let active = true;
    getAllUsers({ role: "super_admin", limit: 1 })
      .then((res) => { if (active) setSuperAdminExists((res?.meta?.total ?? 0) > 0); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const resetForm = () => { setForm(EMPTY_FORM); setNameGuessed(false); };

  const openCreate = () => {
    resetForm();
    setDrawerMode("create");
    setDrawerError("");
    setEditingUser(null);
    setDrawerOpen(true);
  };

  const openEdit = (user) => {
    // Older accounts only have a single `name`; pre-fill a best guess to review.
    const legacy = !user.firstName && !user.lastName;
    const parts = legacy ? splitLegacyName(user.name) : user;
    setNameGuessed(legacy && Boolean(user.name));
    setForm({
      studentId: user.studentId || "",
      lastName: parts.lastName || "",
      firstName: parts.firstName || "",
      middleName: parts.middleName || "",
      email: user.email || "",
      password: "",
      role: user.role || "student",
      course: user.course || "",
      department: user.department || "",
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
    if (!form.lastName.trim() || !form.firstName.trim()) {
      setDrawerError("Last name and first name are required."); return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email) ||
        (drawerMode === "create" && form.password.length < 6) ||
        (form.password && form.password.length < 6)) {
      setDrawerError("Enter a valid email and a password of at least 6 characters."); return;
    }
    if (form.role === "admin" && !form.department) {
      setDrawerError("Choose the department this Admin manages."); return;
    }
    if (form.role === "student" && (!form.studentId.trim() || !form.course.trim() ||
      !Number.isInteger(Number(form.yearLevel)) || Number(form.yearLevel) < 1 || Number(form.yearLevel) > 6 ||
      !["1st Semester", "2nd Semester"].includes(form.semester))) {
      setDrawerError("Complete the student's ID and valid academic information."); return;
    }
    setDrawerLoading(true);
    setDrawerError("");

    try {
      if (drawerMode === "create") {
        await createUser(form.role === "student" ? { ...form, schoolYear: currentSchoolYear(), department: "" } :
          { ...form, course: "", yearLevel: "", semester: "", schoolYear: "" });
        showToast("User created successfully.", "success");
      } else {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await updateUser(editingUser._id, form.role === "student" ? { ...payload, schoolYear: currentSchoolYear() } :
          { ...payload, course: "", yearLevel: "", semester: "", schoolYear: "" });
        showToast("User updated successfully.", "success");
      }
      if (form.role === "super_admin") setSuperAdminExists(true);
      setDrawerOpen(false);
      await refresh();
    } catch (err) {
      const msg =
        err.response?.data?.message || "Operation failed. Please try again.";
      setDrawerError(msg);
      showToast(msg, "error");
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleArchive = async (user) => {
    const label = formatLastFirst(user);
    if (!window.confirm(`Archive ${label}? They will not be able to log in until unarchived. Their records are kept.`)) return;
    setStatusAction(user._id);
    try {
      await deactivateUser(user._id);
      showToast(`${label} has been archived.`, "info");
      await refresh();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to archive user.", "error");
    } finally {
      setStatusAction("");
    }
  };

  const handleUnarchive = async (user) => {
    const label = formatLastFirst(user);
    setStatusAction(user._id);
    try {
      await activateUser(user._id);
      showToast(`${label} has been unarchived and can log in again.`, "success");
      await refresh();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to unarchive user.", "error");
    } finally {
      setStatusAction("");
    }
  };

  const editingSuperAdmin = drawerMode === "edit" && editingUser?.role === "super_admin";
  const roleOptions = [
    ...ROLES.filter((role) => role !== "super_admin" || editingSuperAdmin || !superAdminExists),
    ...(drawerMode === "edit" && editingUser?.role === "admin" ? ["admin"] : []),
  ];

  const updateField = (field, value) =>
    setForm((prev) => field === "role" && value !== "student" ?
      { ...prev, role: value, course: "", yearLevel: "", semester: "", schoolYear: "",
        department: value === "admin" ? prev.department : "" } :
      { ...prev, [field]: value });

  // ---- Filters ---------------------------------------------------------------
  const roleCounts = meta?.roleCounts;
  const roleLabel = (value) => FILTERS.find((item) => item.value === value)?.label || value;
  const shortDate = (value) => new Date(`${value}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

  // "Course not in list" is a student-only check, so it and the non-student
  // role pills switch each other off instead of contradicting each other.
  const selectRole = (value) => setQueryFilters({ role: value,
    ...(value && value !== "student" ? { courseIssue: false } : {}) });

  const dateLabel = filters.from && filters.to ? `Created ${shortDate(filters.from)} – ${shortDate(filters.to)}`
    : filters.from ? `Created from ${shortDate(filters.from)}` : filters.to ? `Created until ${shortDate(filters.to)}` : "";
  const activeFilters = [
    filters.role && { key: "role", label: `Role: ${roleLabel(filters.role)}`, clear: () => setQueryFilters({ role: "" }) },
    dateLabel && { key: "date", label: dateLabel, clear: () => setDateRange({ from: "", to: "" }) },
    filters.search && { key: "search", label: `Search: "${filters.search}"`, clear: () => { setSearch(""); setQueryFilters({ search: "" }); } },
    filters.courseIssue && { key: "courseIssue", label: "Course not in list", clear: () => setQueryFilters({ courseIssue: false }) },
  ].filter(Boolean);
  const clearAllFilters = () => {
    setSearch("");
    setQueryFilters({ role: "", search: "", courseIssue: false });
    setDateRange({ from: "", to: "" });
  };
  const who = filters.courseIssue ? "students with a course not in the list"
    : filters.role ? `${roleLabel(filters.role).toLowerCase()} accounts` : "users";
  const emptyMessage = activeFilters.length === 0 ? "No users yet."
    : dateLabel ? `No ${who} were ${dateLabel.charAt(0).toLowerCase()}${dateLabel.slice(1)}${filters.search ? " matching your search" : ""}.`
    : `No ${who} match the current filters.`;

  const columns = [
    {
      key: "name",
      header: "Name (Last, First Middle)",
      priority: "primary",
      render: (user) => (
        <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-600">{formatLastFirst(user)}</p>
      ),
    },
    {
      key: "email",
      header: "Email",
      priority: "meta",
      render: (user) => user.email,
    },
    {
      key: "assignment",
      header: "Course / Department",
      priority: "meta",
      render: (user) => (user.role === "admin" ? (user.department || "No department")
        : user.role === "student" ? (user.course || "—") : "—"),
    },
    {
      key: "studentId",
      header: "Student / Employee ID",
      priority: "meta",
      render: (user) => user.studentId || "—",
    },
    {
      key: "role",
      header: "Role",
      priority: "meta",
      render: (user) => (
        <span className="inline-flex rounded-md bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 shadow-sm">
          {user.role}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Date Created",
      priority: "meta",
      render: (user) => formatCreatedPH(user.createdAt),
    },
    {
      key: "status",
      header: "Status",
      priority: "badge",
      render: (user) => (user.isActive === false ? (
        <span className="inline-flex rounded-md bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 shadow-sm">
          Archived
        </span>
      ) : (
        <span className="inline-flex rounded-md bg-green-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-600 shadow-sm">
          Active
        </span>
      )),
    },
    {
      key: "actions",
      header: "Actions",
      priority: "action",
      render: (user) => (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openEdit(user)}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label={`Edit ${formatLastFirst(user)}`}
          >
            <IconEdit className="h-3.5 w-3.5" />
            Edit
          </button>
          {user.role !== "super_admin" && (user.isActive !== false ? (
            <button
              type="button"
              onClick={() => handleArchive(user)}
              disabled={statusAction === user._id}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60"
              aria-label={`Archive ${formatLastFirst(user)}`}
            >
              {statusAction === user._id ? <IconLoader className="h-3.5 w-3.5" /> : <IconArchive className="h-3.5 w-3.5" />}
              Archive
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleUnarchive(user)}
              disabled={statusAction === user._id}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-green-50 px-3 py-2.5 text-xs font-bold text-green-700 transition hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:opacity-60"
              aria-label={`Unarchive ${formatLastFirst(user)}`}
            >
              {statusAction === user._id ? <IconLoader className="h-3.5 w-3.5" /> : <IconRestore className="h-3.5 w-3.5" />}
              Unarchive
            </button>
          ))}
        </div>
      ),
    },
  ];

  const drawerTitle =
    drawerMode === "create" ? "Create New User" : "Edit User";

  const drawerFooter = (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={() => setDrawerOpen(false)}
        disabled={drawerLoading}
        className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={drawerLoading}
        className="flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-[0_4px_14px_rgba(37,99,235,0.39)] transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-70"
      >
        {drawerLoading ? <IconLoader className="h-4 w-4" /> : null}
        {drawerMode === "create" ? "Create User" : "Save Changes"}
      </button>
    </div>
  );

  const message = error || listError;

  return (
    <div>
      {message && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      {/* Search + actions bar */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 w-full lg:max-w-sm">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <IconSearch className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search by name, email, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-4 text-sm font-medium text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            aria-label="Search users"
          />
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-3 lg:w-auto lg:shrink-0 lg:justify-end">
          <SortSelect options={USER_SORTS} sort={sort} order={order} onChange={setSorting} label="Sort users" />
          <button
            type="button"
            onClick={openCreate}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-sti-gold px-5 py-2.5 text-sm font-black text-sti-blue shadow-[0_8px_20px_rgba(255,199,44,0.25)] transition hover:-translate-y-0.5 hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
          >
            <IconUserPlus className="h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      <div className="mb-4">
        <DateRangeFilter from={filters.from} to={filters.to} onChange={setDateRange} />
      </div>

      {/* Role pills: the count is how many users of that role match the other filters. */}
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((option) => {
          const count = roleCounts?.[option.value || "all"];
          const active = filters.role === option.value;
          return (
            <button
              key={option.value || "all"}
              type="button"
              onClick={() => selectRole(option.value)}
              aria-pressed={active}
              className={[
                "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                active
                  ? "bg-blue-600 text-white shadow-[0_4px_14px_rgba(37,99,235,0.39)]"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              {option.label}
              {count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-black leading-none ${active
                  ? "bg-white/20 text-white" : count === 0 ? "bg-gray-100 text-gray-400" : "bg-blue-50 text-blue-700"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active filters: every filter that narrows the list, each removable. */}
      {activeFilters.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm" aria-label="Active filters">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Filtered by</span>
          {activeFilters.map((item) => (
            <button key={item.key} type="button" onClick={item.clear}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100"
              aria-label={`Remove filter: ${item.label}`}>
              {item.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" onClick={clearAllFilters} className="min-h-9 rounded-full px-3 text-xs font-bold text-gray-500 hover:bg-gray-100">
            Clear all
          </button>
        </div>
      )}
      {activeFilters.length === 0 && <div className="mb-3" />}

      <DataTable
        columns={columns}
        rows={users}
        loading={loading}
        fetching={fetching}
        skeletonRows={5}
        empty={
          <div className="py-2 text-center">
            <EmptyState icon={IconUsers} title="No users found" description={emptyMessage} />
            {activeFilters.length > 0 && (
              <button type="button" onClick={clearAllFilters}
                className="mb-6 min-h-11 rounded-lg bg-blue-50 px-4 text-sm font-bold text-blue-700 hover:bg-blue-100">
                Clear all filters
              </button>
            )}
          </div>
        }
      />

      <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} fetching={fetching} />

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
            <label htmlFor="um-role" className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
            <select id="um-role" value={form.role} onChange={(e) => updateField("role", e.target.value)}
              disabled={editingSuperAdmin}
              className="min-h-11 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm disabled:bg-gray-50 disabled:text-gray-500">
              {roleOptions.map((role) => <option key={role} value={role}>{roleText(role)}</option>)}
            </select>
            {superAdminExists && !editingSuperAdmin && (
              <p className="mt-1 text-xs text-gray-500">Only one Super Admin account is allowed.</p>
            )}
            {editingSuperAdmin && (
              <p className="mt-1 text-xs text-gray-500">The Super Admin's role cannot be changed.</p>
            )}
          </div>

          <div>
            <label
              htmlFor="um-studentId"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              {form.role === "student" ? "Student ID" : "Employee ID (optional)"}
            </label>
            <input
              id="um-studentId"
              type="text"
              value={form.studentId}
              onChange={(e) => updateField("studentId", e.target.value)}
              required={form.role === "student"}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <fieldset className="space-y-4">
            <legend className="mb-1.5 text-sm font-medium text-gray-700">Name</legend>
            {nameGuessed && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This account was saved with a single name. Check the last name / first name split before saving.
              </p>
            )}
            <div>
              <label htmlFor="um-lastName" className="mb-1 block text-xs font-semibold text-gray-600">Last name *</label>
              <input id="um-lastName" type="text" autoComplete="family-name" value={form.lastName}
                onChange={(e) => updateField("lastName", e.target.value)} required placeholder="e.g. Dela Cruz" className={INPUT} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="um-firstName" className="mb-1 block text-xs font-semibold text-gray-600">First name *</label>
                <input id="um-firstName" type="text" autoComplete="given-name" value={form.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)} required placeholder="e.g. Juan" className={INPUT} />
              </div>
              <div>
                <label htmlFor="um-middleName" className="mb-1 block text-xs font-semibold text-gray-600">Middle name</label>
                <input id="um-middleName" type="text" autoComplete="additional-name" value={form.middleName}
                  onChange={(e) => updateField("middleName", e.target.value)} placeholder="Optional" className={INPUT} />
              </div>
            </div>
          </fieldset>

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
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {form.role === "admin" && (
            <div>
              <label htmlFor="um-department" className="mb-1.5 block text-sm font-medium text-gray-700">
                Department <span className="text-red-500">*</span>
              </label>
              <select id="um-department" value={form.department} onChange={(e) => updateField("department", e.target.value)} className={INPUT}>
                <option value="">Select department</option>
                {departments.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-500">This Admin will only see students and exams of this department's courses.</p>
            </div>
          )}

          {form.role === "student" && <>
            <CourseSelect
              idPrefix="um"
              courses={courses.filter((item) => item.active !== false)}
              departments={departments}
              course={form.course}
              onChange={(course) => setForm((prev) => ({ ...prev, course }))}
              className={INPUT}
            />
            <div className="grid grid-cols-1 gap-4">
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
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
                <select
                  id="um-semester"
                  value={form.semester}
                  onChange={(e) => updateField("semester", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Select semester</option><option>1st Semester</option><option>2nd Semester</option>
                </select>
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
                  value={currentSchoolYear()}
                  readOnly
                  aria-readonly="true"
                  title="Set automatically to the current school year"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none cursor-not-allowed bg-gray-50 font-semibold text-gray-700"
                />
                {drawerMode === "edit" && editingUser?.schoolYear && editingUser.schoolYear !== currentSchoolYear() && (
                  <p className="mt-1 text-xs text-amber-700">Saved as {editingUser.schoolYear}; saving updates it to {currentSchoolYear()}.</p>
                )}
              </div>
            </div>
          </>}
        </form>
      </Drawer>
    </div>
  );
};

export default UserManagement;
