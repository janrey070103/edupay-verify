const pageTitles = {
  "/student": "Student Dashboard",
  "/cashier": "Cashier Dashboard",
  "/upload": "Upload Receipt",
  "/verify-payments": "Verify Payments",
  "/reports": "Reports",
  "/notifications": "Notifications",
  "/permit": "Exam Permit",
  "/super-admin": "Super Admin Dashboard",
  "/user-management": "User Management",
};

export const getPageTitle = (pathname) =>
  pageTitles[pathname] ?? "EduPay Verify";
