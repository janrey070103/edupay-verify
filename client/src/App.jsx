import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import CashierDashboard from "./pages/CashierDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import UploadReceipt from "./pages/UploadReceipt";
import VerifyPayments from "./pages/VerifyPayments";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import ExamPermit from "./pages/ExamPermit";


function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/student"
          element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cashier"
          element={
            <ProtectedRoute>
              <CashierDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload"
          element={
            <UploadReceipt />
          }
          />

        <Route
 path="/verify-payments"
 element={
  <ProtectedRoute>
   <VerifyPayments />
  </ProtectedRoute>
 }
/>

<Route
 path="/reports"
 element={
  <ProtectedRoute>
   <Reports />
  </ProtectedRoute>
 }
/>

<Route
 path="/notifications"
 element={
  <ProtectedRoute>
   <Notifications />
  </ProtectedRoute>
 }
/>

<Route
 path="/permit"
 element={
  <ProtectedRoute>
   <ExamPermit />
  </ProtectedRoute>
 }
/>



      </Routes>
    </BrowserRouter>
  );
}

export default App;