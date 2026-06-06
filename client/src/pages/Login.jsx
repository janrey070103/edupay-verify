import React, { useState } from "react";
import API from "../api/authApi";
import "../styles/Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await API.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);

      if (res.data.role === "student") {
        window.location.href = "/student";
      } else {
        window.location.href = "/cashier";
      }
    } catch (error) {
      alert(error.response?.data?.message || "Login Failed");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo-container">
          <div className="logo-circle">STI</div>
          <h1>EduPay Verify</h1>
          <p>Payment Verification System</p>
        </div>

        <input
          type="email"
          placeholder="Institutional Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field"
        />

        <button onClick={handleLogin} className="login-btn">
          Login
        </button>
      </div>
    </div>
  );
};

export default Login;