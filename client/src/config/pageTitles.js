const pageTitles = {
  "/student": "Student Dashboard",
  "/cashier": "Cashier Dashboard",
  "/upload": "Upload Receipt",
  "/verify-payments": "Verify Payments",
  "/reports": "Reports",
  "/notifications": "Notifications",
  "/permit": "Exam Permit",
};

export const getPageTitle = (pathname) =>
  pageTitles[pathname] ?? "EduPay Verify";
