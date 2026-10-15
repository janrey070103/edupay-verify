const pageTitles = {
  "/student": "Student Dashboard",
  "/cashier": "Cashier Dashboard",
  "/upload": "Upload Receipt",
  "/verify-payments": "Verify Payments",
  "/reports": "Reports",
  "/notifications": "Notifications",
  "/permit": "Exam Permit",
  "/teacher": "Exam Proctor",
  "/super-admin": "Super Admin Dashboard",
  "/user-management": "User Management",
  "/history": "Payment History",
  "/my-exams": "My Exams",
  "/exam-schedule": "Exam Schedule",
  "/student-exams": "My Exams",
};

export const getPageTitle = (pathname) =>
  pageTitles[pathname] ?? "EduPay Verify";
