// Category (for the Notifications tabs) and the page each notification opens.
// Applied to new notifications when saved and to older ones when read, so
// notifications created before these fields existed still work.
const ROLE_HOME = { student: "/student", cashier: "/cashier", teacher: "/teacher", admin: "/admin", super_admin: "/super-admin" };

const META = {
  "New Receipt Submitted": { category: "payments", link: { cashier: "/verify-payments" } },
  "Payment Approved": { category: "payments", link: { student: "/history" } },
  "Payment Rejected": { category: "payments", link: { student: "/history" } },
  "Direct Payment Recorded": { category: "payments", link: { student: "/history" } },
  "Exam Coming Up - Not Cleared": { category: "payments", link: { student: "/upload" } },
  "Exam Schedule Published": { category: "exams", link: { student: "/student-exams" } },
  "Term Schedule Published": { category: "exams", link: { admin: "/exam-schedule" } },
  "New Exam Assigned": { category: "exams", link: { teacher: "/my-exams" } },
  "Exam Schedule Updated": { category: "exams", link: { teacher: "/my-exams" } },
  "Exam Assignment Removed": { category: "exams", link: { teacher: "/my-exams" } },
  "Exam Cancelled": { category: "exams", link: { teacher: "/my-exams" } },
  "Exams Without Proctor": { category: "exams", link: { admin: "/exam-schedule" } },
  "Exam Permit Verified": { category: "exams", link: { student: "/student-exams" } },
  "New Student Registration": { category: "accounts", link: { admin: "/pending-students", super_admin: "/user-management" } },
  // A "New Student Registration" becomes one of these once it is acted on.
  "User is verified": { category: "accounts", link: { admin: "/admin", super_admin: "/user-management" } },
  "User is rejected": { category: "accounts", link: { admin: "/admin", super_admin: "/user-management" } },
  "Students Waiting for Verification": { category: "accounts", link: { admin: "/pending-students" } },
  "Account Verified": { category: "accounts" },
  "Account Rejected": { category: "accounts" },
  "Account Archived": { category: "accounts" },
  "Account Restored": { category: "accounts" },
  "Welcome to EduPay Verify": { category: "accounts", link: { "*": "/settings" } },
};

const CATEGORIES = ["payments", "exams", "accounts", "general"];

/** { category, link } for a notification title and recipient role. */
const describe = (title, role) => {
  const meta = META[title];
  return {
    category: meta?.category || "general",
    link: meta?.link?.[role] || meta?.link?.["*"] || ROLE_HOME[role] || "/",
  };
};

/** Titles that belong to a category (for notifications saved without one). */
const titlesFor = (category) => Object.entries(META)
  .filter(([, meta]) => meta.category === category).map(([title]) => title);

module.exports = { describe, titlesFor, CATEGORIES, ROLE_HOME };
