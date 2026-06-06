import React from "react";
import "../styles/Dashboard.css";

const CashierDashboard = () => {
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
        <h1>Cashier Dashboard</h1>
        <p>Manage and verify student payments.</p>

        <div className="stats-grid">
          <div className="stat-card pending">
            <h3>Pending Payments</h3>
            <h1>145</h1>
          </div>

          <div className="stat-card verified">
            <h3>Verified Payments</h3>
            <h1>98</h1>
          </div>

          <div className="stat-card rejected">
            <h3>Rejected Payments</h3>
            <h1>12</h1>
          </div>
        </div>

        <div className="cards-grid">
          <div className="dashboard-card">
            <div className="card-icon">✅</div>
            <h3>Verify Payments</h3>
            <p>Approve or reject submitted receipts.</p>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <h3>Reports</h3>
            <p>View payment verification reports.</p>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">👨‍🎓</div>
            <h3>Students</h3>
            <p>Manage student payment records.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashierDashboard;