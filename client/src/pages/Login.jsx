import { useEffect, useState } from "react";
import API from "../api/authApi";
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconLoader,
  IconUser,
  IconBook,
  IconIdCard,
  IconCheckCircle,
} from "../components/icons/Icons";
import { getDefaultRoute } from "../hooks/useAuth";

const REMEMBER_KEY = "edupay_remember_email";

const YEAR_LEVELS = [
  { label: "1st Year", value: 1 },
  { label: "2nd Year", value: 2 },
  { label: "3rd Year", value: 3 },
  { label: "4th Year", value: 4 },
];

const Login = () => {
  const [mode, setMode] = useState("login"); // "login" | "signup"

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Login-only
  const [rememberMe, setRememberMe] = useState(false);

  // Sign-up-only
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState("");

  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBER_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const res = await API.post("/auth/login", {
        email,
        password,
      });

      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      if (res.data.user) {
        localStorage.setItem("user", JSON.stringify(res.data.user));
      }

      window.location.href = getDefaultRoute(res.data.role);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");

    if (!studentId.trim() || !name.trim() || !email.trim() || !password) {
      setError("All fields marked with * are required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await API.post("/auth/register", {
        studentId: studentId.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
        course: course || undefined,
        yearLevel: yearLevel ? Number(yearLevel) : undefined,
      });

      // Auto-login after successful registration
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      if (res.data.user) {
        localStorage.setItem("user", JSON.stringify(res.data.user));
      }

      window.location.href = getDefaultRoute(res.data.role);
    } catch (err) {
      setError(
        err.response?.data?.message || "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden p-4 sm:p-8">
      <div
        className="absolute inset-0 bg-gradient-to-br from-sti-blue via-sti-blue-light to-sti-blue"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <div
        className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-white/5 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-sti-gold/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] md:min-h-[600px] md:flex-row">
        {/* ── Left panel ── */}
        <div className="slide-in-left relative flex w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-sti-blue to-sti-blue-light p-8 text-white sm:p-12 md:w-1/2 md:p-12">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-sti-gold/10"
            aria-hidden="true"
          />

          <div className="relative z-10">
            <img
              src="/sti-logo.jpg"
              alt="STI West Negros University"
              className="mb-6 h-20 w-20 rounded-xl object-cover shadow-lg"
            />
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              EduPay Verify
            </h1>
            <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-blue-100">
              Payment Verification System
            </p>
          </div>

          <div className="relative z-10 mt-10 md:mt-0">
            <p className="text-lg font-semibold leading-relaxed text-white/95">
              {mode === "login"
                ? "Upload receipts, track verification status, and access your exam permits — all in one place."
                : "Create your student account to start submitting payment receipts and tracking your exam permit eligibility."}
            </p>
            <ul className="mt-6 space-y-3 text-sm text-blue-100">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sti-gold" />
                Submit payment receipts digitally
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sti-gold" />
                Cashier verification with OCR
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sti-gold" />
                Exam permit eligibility tracking
              </li>
            </ul>
          </div>

          <p className="relative z-10 mt-8 text-xs text-blue-200/80">
            STI College · Secure institutional access only
          </p>
        </div>

        {/* ── Right panel ── */}
        <div className="slide-in-right flex w-full flex-col justify-center bg-white p-8 sm:p-12 md:w-1/2 md:p-16">
          {mode === "login" ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-black tracking-tight text-gray-800">
                  Welcome back
                </h2>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Sign in with your institutional email to continue.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="login-email"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Institutional Email
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <IconMail />
                    </span>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@school.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <IconLock />
                    </span>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-11 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-sti-blue focus:ring-sti-blue"
                  />
                  <label
                    htmlFor="remember"
                    className="ml-2 cursor-pointer text-sm font-medium text-gray-600"
                  >
                    Remember my email
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sti-gold py-3.5 text-sm font-black text-sti-blue shadow-[0_8px_20px_rgba(255,199,44,0.25)] transition hover:-translate-y-0.5 hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {loading ? (
                    <>
                      <IconLoader className="h-4 w-4" />
                      Signing in…
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm font-medium text-gray-500">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-bold text-sti-blue transition hover:text-sti-blue-light"
                >
                  Create Account
                </button>
              </p>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-black tracking-tight text-gray-800">
                  Create your account
                </h2>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Register as a student to start using EduPay Verify.
                </p>
              </div>

              {success && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleSignUp} className="space-y-4" noValidate>
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Student ID */}
                <div>
                  <label
                    htmlFor="signup-student-id"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Student ID <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <IconIdCard />
                    </span>
                    <input
                      id="signup-student-id"
                      type="text"
                      placeholder="e.g. 2024-00123"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      disabled={loading}
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label
                    htmlFor="signup-name"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <IconUser />
                    </span>
                    <input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Juan Dela Cruz"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loading}
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="signup-email"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <IconMail />
                    </span>
                    <input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@school.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Password + Confirm side by side */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="signup-password"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <IconLock />
                      </span>
                      <input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Min. 6 chars"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-11 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="signup-confirm"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Confirm <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <IconLock />
                      </span>
                      <input
                        id="signup-confirm"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Re-enter"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>

                {/* Course + Year Level side by side */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="signup-course"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Course
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <IconBook />
                      </span>
                      <input
                        id="signup-course"
                        type="text"
                        placeholder="e.g. BSIT"
                        value={course}
                        onChange={(e) => setCourse(e.target.value)}
                        disabled={loading}
                        className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="signup-year"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Year Level
                    </label>
                    <select
                      id="signup-year"
                      value={yearLevel}
                      onChange={(e) => setYearLevel(e.target.value)}
                      disabled={loading}
                      className="block w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-8 text-sm font-medium text-gray-900 shadow-sm outline-none transition focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
                    >
                      <option value="">Select year</option>
                      {YEAR_LEVELS.map((y) => (
                        <option key={y.value} value={y.value}>
                          {y.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sti-gold py-3.5 text-sm font-black text-sti-blue shadow-[0_8px_20px_rgba(255,199,44,0.25)] transition hover:-translate-y-0.5 hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {loading ? (
                    <>
                      <IconLoader className="h-4 w-4" />
                      Creating account…
                    </>
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm font-medium text-gray-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-bold text-sti-blue transition hover:text-sti-blue-light"
                >
                  Sign In
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
