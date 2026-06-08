import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import CashierDashboard from "./pages/CashierDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import UploadReceipt from "./pages/UploadReceipt";
import VerifyPayments from "./pages/VerifyPayments";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import ExamPermit from "./pages/ExamPermit";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <UploadReceipt />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/permit"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <ExamPermit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cashier"
            element={
              <ProtectedRoute allowedRoles={["cashier"]}>
                <CashierDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verify-payments"
            element={
              <ProtectedRoute allowedRoles={["cashier"]}>
                <VerifyPayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={["cashier"]}>
                <Reports />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
