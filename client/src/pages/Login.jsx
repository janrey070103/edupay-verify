import { useEffect, useState } from "react";
import API from "../api/authApi";
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconLoader,
} from "../components/icons/Icons";

const REMEMBER_KEY = "edupay_remember_email";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBER_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

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

      if (res.data.role === "student") {
        window.location.href = "/student";
      } else {
        window.location.href = "/cashier";
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
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
              Upload receipts, track verification status, and access your exam
              permits — all in one place.
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

        <div className="slide-in-right flex w-full flex-col justify-center bg-white p-8 sm:p-12 md:w-1/2 md:p-16">
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
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Institutional Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <IconMail />
                </span>
                <input
                  id="email"
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
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <IconLock />
                </span>
                <input
                  id="password"
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
        </div>
      </div>
    </div>
  );
};

export default Login;
