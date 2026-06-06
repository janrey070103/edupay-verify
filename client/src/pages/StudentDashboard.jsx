import React from "react";
import "../styles/Dashboard.css";

const StudentDashboard = () => {
  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  return (
    <div className="dashboard-page">
      <nav className="navbar">
        <h2>EduPay Verify</h2>
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </nav>

      <div className="dashboard-content">
        <h1>Welcome Student</h1>
        <p>Manage your payment receipts and permits.</p>

        <div className="cards-grid">
          <div className="dashboard-card">
            <div className="card-icon">📤</div>
            <h3>Upload Receipt</h3>
            <p>Submit payment receipts for verification.</p>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🔔</div>
            <h3>Notifications</h3>
            <p>Check verification updates and alerts.</p>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📄</div>
            <h3>Exam Permit</h3>
            <p>Download your approved exam permit.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;