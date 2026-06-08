export const studentNav = [
  { label: "Dashboard", path: "/student", icon: "home" },
  { label: "Upload Receipt", path: "/upload", icon: "upload" },
  { label: "Notifications", path: "/notifications", icon: "bell" },
  { label: "Exam Permit", path: "/permit", icon: "ticket" },
];

export const cashierNav = [
  { label: "Dashboard", path: "/cashier", icon: "home" },
  { label: "Verify Payments", path: "/verify-payments", icon: "check" },
  { label: "Reports", path: "/reports", icon: "chart" },
];

export const getNavForRole = (role) => {
  if (role === "student") return studentNav;
  if (role === "cashier") return cashierNav;
  return [];
};
