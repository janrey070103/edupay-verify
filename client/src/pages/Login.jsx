import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/authApi";
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconLoader,
  IconUser,

  IconIdCard,
  IconCheckCircle,
} from "../components/icons/Icons";
import { getDefaultRoute } from "../hooks/useAuth";
import useCatalog from "../hooks/useCatalog";
import CourseSelect from "../components/ui/CourseSelect";
import { focusField } from "../utils/formNavigation";
import { clearMissing, markMissing } from "../utils/fieldAlerts";
import { currentSchoolYear } from "../utils/schoolYear";
import {
  NAME_EXTENSIONS, STUDENT_ID_PATTERN, extensionProblem, formatExtension, formatName, formatNameInput,
  formatStudentId, middleNameProblem, studentEmail,
} from "../utils/studentIdentity";

const REMEMBER_KEY = "edupay_remember_email";

const YEAR_LEVELS = [
  { label: "1st Year", value: 1 },
  { label: "2nd Year", value: 2 },
  { label: "3rd Year", value: 3 },
  { label: "4th Year", value: 4 },
];

const Login = () => {
  const [mode, setMode] = useState("login"); // "login" | "signup"

  const navigate = useNavigate();

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Login-only
  const [rememberMe, setRememberMe] = useState(false);

  // Sign-up-only
  const [studentId, setStudentId] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [middleTouched, setMiddleTouched] = useState(false);
  const [extensionChoice, setExtensionChoice] = useState(""); // "", a listed suffix, or "other"
  const [otherExtension, setOtherExtension] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [course, setCourse] = useState("");
  const { departments, activeCourses, loading: catalogLoading } = useCatalog();
  const [yearLevel, setYearLevel] = useState("");
  const [semester, setSemester] = useState("");

  // Sign-up email is built from the last name, extension and Student ID.
  const nameExtension = extensionChoice === "other" ? formatExtension(otherExtension) : extensionChoice;
  const signupEmail = studentEmail({ lastName, nameExtension, studentId });
  const middleError = middleTouched ? middleNameProblem(middleName) : "";

  // Alerts (e.g. "Your account is awaiting admin verification") disappear after 5 seconds.
  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);
  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(""), 5000);
    return () => clearTimeout(timer);
  }, [success]);

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
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setStudentId("");
    setLastName("");
    setFirstName("");
    setMiddleName("");
    setMiddleTouched(false);
    setExtensionChoice("");
    setOtherExtension("");
    setCourse("");
    setYearLevel("");
    setSemester("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    clearMissing();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please fill in the highlighted fields.");
      markMissing([!email.trim() && "login-email", !password && "login-password"].filter(Boolean));
      focusField(e.currentTarget, !email.trim() ? "login-email" : "login-password");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email address.");
      markMissing(["login-email"]);
      focusField(e.currentTarget, "login-email");
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

      navigate(getDefaultRoute(res.data.role));
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");

    // Every required field still empty is outlined in red; the cursor goes to the first one.
    const missingIds = [
      [!studentId.trim(), "signup-student-id"], [!lastName.trim(), "signup-lastName"],
      [!firstName.trim(), "signup-firstName"], [extensionChoice === "other" && !otherExtension.trim(), "signup-extension-other"],
      [!password, "signup-password"],
      [!confirmPassword, "signup-confirm"], [!course.trim(), "signup-course"], [!yearLevel, "signup-year"],
      [!semester, "signup-semester"],
    ].filter(([missing]) => missing).map(([, id]) => id);
    if (missingIds.length) {
      setError(`Please fill in the ${missingIds.length === 1 ? "highlighted field" : `${missingIds.length} highlighted fields`} marked with *.`);
      markMissing(missingIds);
      focusField(e.currentTarget, missingIds[0]);
      return;
    }

    if (!STUDENT_ID_PATTERN.test(studentId)) {
      setError("Enter your Student ID in the format 23-1681-428.");
      markMissing(["signup-student-id"]);
      focusField(e.currentTarget, "signup-student-id");
      return;
    }

    const middleProblem = middleNameProblem(middleName);
    if (middleProblem) {
      setMiddleTouched(true);
      setError(middleProblem);
      markMissing(["signup-middleName"]);
      focusField(e.currentTarget, "signup-middleName");
      return;
    }

    const extensionError = extensionProblem(nameExtension);
    if (extensionError) {
      setError(extensionError);
      markMissing(["signup-extension-other"]);
      focusField(e.currentTarget, "signup-extension-other");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      markMissing(["signup-password"]);
      focusField(e.currentTarget, "signup-password");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      markMissing(["signup-confirm"]);
      focusField(e.currentTarget, "signup-confirm");
      return;
    }

    setLoading(true);

    try {
      const res = await API.post("/auth/register", {
        studentId,
        lastName: formatName(lastName),
        firstName: formatName(firstName, { allowPeriod: true }),
        middleName: formatName(middleName),
        nameExtension: nameExtension || undefined,
        email: signupEmail,
        password,
        course: course || undefined,
        yearLevel: yearLevel ? Number(yearLevel) : undefined,
        semester,
        schoolYear: currentSchoolYear(),
      });

      // Registration no longer auto-logs in — show pending message
      setSuccess(
        res.data.message ||
          "Registration successful! Your account is pending admin verification."
      );
      // Reset signup fields and switch to login after short delay
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        switchMode("login");
        setSuccess(
          "Your account has been created and is pending admin verification. You will be notified once approved."
        );
      }, 3000);
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
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-blue-900/40 backdrop-blur-sm"
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

      <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] md:min-h-150 md:flex-row">
        {/* ── Left panel ── */}
        <div className="slide-in-left relative flex w-full flex-col justify-between overflow-hidden bg-linear-to-br from-blue-700 to-blue-600 p-8 text-white sm:p-12 md:w-1/2 md:p-12">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-blue-400/20"
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
            STI College - Secure institutional access only
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

              {success && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

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
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
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
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-11 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
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
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-sti-gold focus:ring-sti-gold"
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
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sti-gold py-3.5 text-sm font-black text-sti-blue shadow-lg shadow-sti-gold/40 transition hover:-translate-y-0.5 hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-gold/50 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {loading ? (
                    <>
                      <IconLoader className="h-4 w-4" />
                      Signing in...
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
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="e.g. 23-1681-428"
                      value={studentId}
                      onChange={(e) => setStudentId(formatStudentId(e.target.value))}
                      disabled={loading}
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Name: last name first */}
                <div>
                  <label
                    htmlFor="signup-lastName"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <IconUser />
                    </span>
                    <input
                      id="signup-lastName"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Dela Cruz"
                      value={lastName}
                      onChange={(e) => setLastName(formatNameInput(e.target.value))}
                      onBlur={() => setLastName(formatName(lastName))}
                      disabled={loading}
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="signup-firstName" className="mb-1.5 block text-sm font-medium text-gray-700">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="signup-firstName"
                      type="text"
                      autoComplete="given-name"
                      placeholder="Juan"
                      value={firstName}
                      onChange={(e) => setFirstName(formatNameInput(e.target.value, { allowPeriod: true }))}
                      onBlur={() => setFirstName(formatName(firstName, { allowPeriod: true }))}
                      disabled={loading}
                      className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-middleName" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Middle Name <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <input
                      id="signup-middleName"
                      type="text"
                      autoComplete="additional-name"
                      placeholder="Full middle name"
                      value={middleName}
                      onChange={(e) => setMiddleName(formatNameInput(e.target.value))}
                      onBlur={() => { setMiddleName(formatName(middleName)); setMiddleTouched(true); }}
                      aria-invalid={middleError ? "true" : undefined}
                      aria-describedby="signup-middleName-help"
                      disabled={loading}
                      className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
                    />
                    <p id="signup-middleName-help" className={`mt-1 text-xs ${middleError ? "text-red-600" : "text-gray-400"}`}>
                      {middleError || "Full name only, no initials."}
                    </p>
                  </div>
                </div>

                {/* Name extension */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="signup-extension" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Extension <span className="font-normal text-gray-400">(if applicable)</span>
                    </label>
                    <select
                      id="signup-extension"
                      value={extensionChoice}
                      onChange={(e) => { setExtensionChoice(e.target.value); if (e.target.value !== "other") setOtherExtension(""); }}
                      disabled={loading}
                      className="block w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-8 text-sm font-medium text-gray-900 shadow-sm outline-none transition focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
                    >
                      <option value="">None</option>
                      {NAME_EXTENSIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                      <option value="other">Other (type it)</option>
                    </select>
                  </div>
                  {extensionChoice === "other" && (
                    <div>
                      <label htmlFor="signup-extension-other" className="mb-1.5 block text-sm font-medium text-gray-700">
                        Other extension <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="signup-extension-other"
                        type="text"
                        maxLength={6}
                        placeholder="e.g. II"
                        value={otherExtension}
                        onChange={(e) => setOtherExtension(e.target.value.replace(/[^\p{L}.]/gu, ""))}
                        onBlur={() => setOtherExtension(formatExtension(otherExtension))}
                        disabled={loading}
                        className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
                      />
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="signup-email"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Institutional Email <span className="font-normal text-gray-400">· automatic</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <IconMail />
                    </span>
                    <input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      placeholder="lastname.681428@wnu.sti.edu.ph"
                      value={signupEmail}
                      readOnly
                      aria-readonly="true"
                      aria-describedby="signup-email-help"
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60 cursor-not-allowed bg-gray-50"
                    />
                  </div>
                  <p id="signup-email-help" className="mt-1 text-xs text-gray-400">
                    Last name + extension + Student ID without its first 3 digits. Use it to sign in.
                  </p>
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
                        className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-11 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
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
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Re-enter"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-11 text-sm font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Course (official list) */}
                <CourseSelect
                  idPrefix="signup"
                  courses={activeCourses}
                  departments={departments}
                  course={course}
                  disabled={loading || catalogLoading}
                  onChange={setCourse}
                  className="block w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-8 text-sm font-medium text-gray-900 shadow-sm outline-none transition focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
                />

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label
                      htmlFor="signup-year"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Year Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="signup-year"
                      value={yearLevel}
                      onChange={(e) => setYearLevel(e.target.value)}
                      disabled={loading}
                      className="block w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-8 text-sm font-medium text-gray-900 shadow-sm outline-none transition focus:border-sti-gold focus:ring-2 focus:ring-sti-gold/20 disabled:opacity-60"
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div><label htmlFor="signup-semester" className="mb-1.5 block text-sm font-medium text-gray-700">Semester <span className="text-red-500">*</span></label>
                    <select id="signup-semester" value={semester} onChange={(e) => setSemester(e.target.value)}
                      className="min-h-11 w-full rounded-xl border border-gray-200 px-4 text-sm">
                      <option value="">Select semester</option><option>1st Semester</option><option>2nd Semester</option>
                    </select></div>
                  <div><label htmlFor="signup-school-year" className="mb-1.5 block text-sm font-medium text-gray-700">School year <span className="font-normal text-gray-400">· current</span></label>
                    <input id="signup-school-year" value={currentSchoolYear()} readOnly aria-readonly="true"
                      title="Set automatically to the current school year"
                      className="min-h-11 w-full rounded-xl border border-gray-200 px-4 text-sm cursor-not-allowed bg-gray-50 font-semibold text-gray-700" /></div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sti-gold py-3.5 text-sm font-black text-sti-blue shadow-lg shadow-sti-gold/40 transition hover:-translate-y-0.5 hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-gold/50 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {loading ? (
                    <>
                      <IconLoader className="h-4 w-4" />
                      Creating account...
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
