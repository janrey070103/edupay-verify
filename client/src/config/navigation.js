export const studentNav = [
  { label: "Dashboard", path: "/student", icon: "home" },
  { label: "Upload Receipt", path: "/upload", icon: "upload" },
  { label: "Payment History", path: "/history", icon: "inbox" },
  { label: "Notifications", path: "/notifications", icon: "bell" },
  { label: "Exam Permit", path: "/permit", icon: "ticket" },
  { label: "My Exams", path: "/student-exams", icon: "calendar" },
];

export const cashierNav = [
  { label: "Dashboard", path: "/cashier", icon: "home" },
  { label: "Verify Payments", path: "/verify-payments", icon: "check" },
  { label: "Notifications", path: "/notifications", icon: "bell" },
  { label: "Reports", path: "/reports", icon: "chart" },
];

export const teacherNav = [
  { label: "Exam Proctor", path: "/teacher", icon: "qr" },
  { label: "My Exams", path: "/my-exams", icon: "calendar" },
  { label: "Notifications", path: "/notifications", icon: "bell" },
];

export const superAdminNav = [
  { label: "Dashboard", path: "/super-admin", icon: "home" },
  { label: "Exam Schedule", path: "/exam-schedule", icon: "calendar" },
  { label: "User Management", path: "/user-management", icon: "users" },
  { label: "Pending Students", path: "/pending-students", icon: "users" },
  { label: "Notifications", path: "/notifications", icon: "bell" },
  { label: "Reports", path: "/reports", icon: "chart" },
];

export const getNavForRole = (role) => {
  if (role === "student") return studentNav;
  if (role === "cashier") return cashierNav;
  if (role === "teacher") return teacherNav;
  if (role === "super_admin") return superAdminNav;
  return [];
};
