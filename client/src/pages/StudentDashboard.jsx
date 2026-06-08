import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";

const StudentDashboard = () => {

  const navigate = useNavigate();

  const logout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <div className="dashboard-page">

      <nav className="navbar">
        <h2>EduPay Verify</h2>

        <button
          className="logout-btn"
          onClick={logout}
        >
          Logout
        </button>
      </nav>

      <div className="dashboard-content">

        <h1>Student Dashboard</h1>

        <p>
          Manage your payments and exam permits.
        </p>

        <div className="cards-grid">

          <div
            className="dashboard-card"
            onClick={() => navigate("/upload")}
          >
            <div className="card-icon">📤</div>
            <h3>Upload Receipt</h3>
            <p>Submit payment receipts.</p>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🔔</div>
            <h3>Notifications</h3>
            <p>View payment updates.</p>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🎫</div>
            <h3>Exam Permit</h3>
            <p>View digital permit.</p>
          </div>

        </div>

      </div>

    </div>
  );
};

export default StudentDashboard;