export const studentNav = [
  { label: "Dashboard", path: "/student", icon: "home" },
  { label: "Upload Receipt", path: "/upload", icon: "upload" },
  { label: "Payment History", path: "/history", icon: "inbox" },
  { label: "Notifications", path: "/notifications", icon: "bell", badge: "notifications" },
  { label: "Exam Permit", path: "/permit", icon: "ticket" },
  { label: "My Exams", path: "/student-exams", icon: "calendar" },
  { label: "Settings", path: "/settings", icon: "settings" },
];

export const cashierNav = [
  { label: "Dashboard", path: "/cashier", icon: "home" },
  { label: "Verify Payments", path: "/verify-payments", icon: "check", badge: "pendingPayments" },
  { label: "Notifications", path: "/notifications", icon: "bell", badge: "notifications" },
  { label: "Reports", path: "/reports", icon: "chart" },
  { label: "Settings", path: "/settings", icon: "settings" },
];

export const teacherNav = [
  { label: "Exam Proctor", path: "/teacher", icon: "qr" },
  { label: "My Exams", path: "/my-exams", icon: "calendar" },
  { label: "Notifications", path: "/notifications", icon: "bell", badge: "notifications" },
  { label: "Settings", path: "/settings", icon: "settings" },
];

// Department Admin: runs exams and student verification for one department.
export const adminNav = [
  { label: "Dashboard", path: "/admin", icon: "home" },
  { label: "Exam Schedule", path: "/exam-schedule", icon: "calendar" },
  { label: "Pending Students", path: "/pending-students", icon: "users", badge: "pendingStudents" },
  { label: "Reports", path: "/reports", icon: "chart" },
  { label: "Notifications", path: "/notifications", icon: "bell", badge: "notifications" },
  { label: "Settings", path: "/settings", icon: "settings" },
];

export const superAdminNav = [
  { label: "Dashboard", path: "/super-admin", icon: "home" },
  { label: "User Management", path: "/user-management", icon: "users" },
  { label: "Notifications", path: "/notifications", icon: "bell", badge: "notifications" },
  { label: "Reports", path: "/reports", icon: "chart" },
  { label: "Settings", path: "/settings", icon: "settings" },
];

export const getNavForRole = (role) => {
  if (role === "student") return studentNav;
  if (role === "cashier") return cashierNav;
  if (role === "teacher") return teacherNav;
  if (role === "admin") return adminNav;
  if (role === "super_admin") return superAdminNav;
  return [];
};
