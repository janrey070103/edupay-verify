import { useEffect, useState } from "react";
import { getCurrentUser } from "../api/authApi";
import {
  getEligibility,
  generateQR,
  getStudentPermits,
  getMyLedger,
} from "../api/eligibilityApi";
import { opensOn, windowOpen, windowRange, windowSummary } from "../utils/examWindowText";
import Skeleton from "../components/ui/Skeleton";
import Modal from "../components/ui/Modal";
import {
  IconShield,
  IconShieldX,
  IconQrCode,
  IconLoader,
} from "../components/icons/Icons";

const EXAM_PERIODS = [
  { key: "prelim", label: "Prelim", apiValue: "Prelim" },
  { key: "midterm", label: "Midterm", apiValue: "Midterm" },
  { key: "preFinal", label: "Pre-Final", apiValue: "PreFinal" },
  { key: "final", label: "Final", apiValue: "Final" },
];

const ExamPermit = () => {
  const [user, setUser] = useState(null);
  const studentId = user?.studentId;

  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permits, setPermits] = useState([]);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  // The term whose permit (QR) is open in the modal.
  const [openTerm, setOpenTerm] = useState(null);
  // When each term's QR may be used (from the server; one whole month per term).
  const [windows, setWindows] = useState({});
  const [qrWindow, setQrWindow] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => {
      setError("Could not load your account."); setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!studentId) return;

    const fetch = async () => {
      try {
        const [eligibilityData, permitData, ledger] = await Promise.all([
          getEligibility(studentId),
          getStudentPermits(studentId),
          getMyLedger().catch(() => null),
        ]);
        setEligibility(eligibilityData);
        setPermits(permitData);
        setWindows(Object.fromEntries((ledger?.eligibility || []).map((row) => [row.term, row.window])));
        setError("");
      } catch {
        setError("Could not load exam eligibility and permits.");
        setEligibility({
          prelim: false,
          midterm: false,
          preFinal: false,
          final: false,
        });
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [studentId]);

  // Clicking "Valid" (or "Get QR", which claims the permit) opens the QR.
  const openPermit = async (examKey) => {
    if (!studentId) return;
    setOpenTerm(examKey);
    setQrLoading(true);
    setQrData(null);
    setQrWindow(null);
    setQrError("");
    try {
      const examType = EXAM_PERIODS.find((e) => e.key === examKey)?.apiValue;
      const data = await generateQR(studentId, examType);
      setQrData(data.qr);
      setQrWindow(data.window || null);
      setGeneratedAt(new Date());
      setPermits((current) => [...current.filter((permit) => permit.examType !== examType), data.permit]);
    } catch (err) {
      setQrError(err.response?.data?.message || "Could not load your QR code.");
    } finally {
      setQrLoading(false);
    }
  };

  const openPeriod = EXAM_PERIODS.find((period) => period.key === openTerm);
  const openPermitDoc = permits.find((permit) => permit.examType === openPeriod?.apiValue);

  return (
    <div className="w-full">
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Student info card */}
      <div className="mb-5 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">
            Student Information
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-400">
              Full Name
            </label>
            <p className="text-sm font-semibold text-gray-800">
              {user?.name || "—"}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-400">
              Student ID
            </label>
            <p className="text-sm font-semibold text-gray-800">
              {studentId || "—"}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-400">
              Email
            </label>
            <p className="text-sm font-semibold text-gray-800">
              {user?.email || "—"}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-400">
              Role
            </label>
            <p className="text-sm font-semibold capitalize text-gray-800">
              {user?.role || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Exam period eligibility */}
      <div className="mb-5 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">
            Exam Period Eligibility
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Eligibility is based on your payment status. Contact the cashier if
            you believe there is an error.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circle" className="h-10 w-10" />
                  <div>
                    <Skeleton className="h-4 w-20 mb-1.5" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-5 w-14 rounded-md" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            {EXAM_PERIODS.map(({ key, label, apiValue }) => {
              const permit = permits.find((p) => p.examType === apiValue);
              const eligible = eligibility?.[key] ?? false;
              const window = windows[apiValue];
              const inPeriod = windowOpen(window);
              const valid = eligible && !!permit && inPeriod;

              return (
                <div
                  key={key}
                  className={[
                    "flex items-center justify-between rounded-xl border p-5 transition",
                    valid
                      ? "border-blue-200 bg-blue-50/50"
                      : "border-gray-100 bg-gray-50/30",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    {valid ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <IconShield className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                        <IconShieldX className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-gray-800">
                        {label}
                      </p>
                      <p
                        className={`text-xs font-semibold ${valid ? "text-blue-600" : "text-gray-400"}`}
                      >
                        {valid ? "Permit Ready" : eligible
                          ? (inPeriod ? "Eligible — tap Get QR" : window?.state === "upcoming" ? `Paid — opens ${opensOn(window)}` : window?.state === "closed" ? "Paid — permit period ended" : "Paid — semester not set")
                          : "Not Eligible"}
                      </p>
                      {window && <p className="mt-0.5 text-[11px] text-gray-500">{windowSummary(window)}</p>}
                    </div>
                  </div>

                  {/* Valid: shows the QR. Eligible (paid, in its month): claims the permit, then shows the QR. */}
                  {valid || (eligible && inPeriod) ? (
                    <button
                      type="button"
                      onClick={() => openPermit(key)}
                      aria-label={`Show ${label} exam permit QR code`}
                      className={[
                        "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30",
                        valid ? "bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white" : "bg-blue-600 text-white hover:bg-blue-700",
                      ].join(" ")}
                    >
                      <IconQrCode className="h-3.5 w-3.5" />
                      {valid ? "Valid" : "Get QR"}
                    </button>
                  ) : (
                    <span className="inline-flex rounded-md bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {eligible ? (window?.state === "upcoming" ? "Not yet" : window?.state === "closed" ? "Ended" : "Paid") : "Invalid"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!loading && eligibility && !Object.values(eligibility).some(Boolean) && (
          <div className="mx-6 mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            You currently have no eligible exam periods. Please complete your payment to unlock exam permits.
          </div>
        )}
      </div>

      {/* Permit status and scan history */}
      <Modal
        isOpen={!!openTerm}
        onClose={() => setOpenTerm(null)}
        title={`${openPeriod?.label || ""} Exam Permit`}
      >
        {openTerm && (
          <div className="space-y-4">
            <div className="flex flex-col items-center rounded-xl border border-gray-100 bg-gray-50/50 p-5 text-center">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-3 py-10">
                  <IconLoader className="h-8 w-8 text-blue-600" />
                  <p className="text-sm font-medium text-gray-500">Loading your QR code…</p>
                </div>
              ) : qrError ? (
                <p role="alert" className="py-6 text-sm font-semibold text-red-700">{qrError}</p>
              ) : qrData ? (
                <>
                  <img src={qrData} alt="Exam permit QR code" className="h-56 w-56 rounded-lg border border-gray-200 bg-white p-2" />
                  <p className="mt-3 text-sm font-bold text-gray-800">{user?.name}</p>
                  <p className="text-xs text-gray-500">{studentId}</p>
                  <p className="mt-2 text-xs font-semibold text-blue-600">Present this QR to each exam proctor.</p>
                </>
              ) : null}
            </div>

            {!qrLoading && !qrError && qrData && (
              <div className="rounded-lg border border-blue-100 bg-white px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Usable</p>
                <p className="text-sm font-bold text-sti-blue">
                  {qrWindow?.state === "anytime" ? "Any time (no set month)" : windowRange(qrWindow) || "—"}
                </p>
                {generatedAt && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Shown {generatedAt.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}
                  </p>
                )}
              </div>
            )}

            <div>
              <h5 className="text-sm font-bold text-gray-800">Recent scans</h5>
              {openPermitDoc?.scans?.length ? (
                <ul className="mt-2 space-y-2 text-sm text-gray-600">
                  {[...openPermitDoc.scans].reverse().slice(0, 5).map((scan, index) => (
                    <li key={index} className="rounded-lg border border-gray-100 p-2">
                      {scan.teacherName || "Teacher"} · {new Intl.DateTimeFormat("en-PH", {
                        timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
                      }).format(new Date(scan.scannedAt))}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-gray-500">No scans yet.</p>}
            </div>

            <button
              type="button"
              onClick={() => setOpenTerm(null)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default ExamPermit;
