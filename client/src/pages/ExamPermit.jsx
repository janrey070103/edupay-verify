import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  getEligibility,
  generateQR,
} from "../api/eligibilityApi";
import PageHeader from "../components/ui/PageHeader";
import Skeleton from "../components/ui/Skeleton";
import {
  IconShield,
  IconShieldX,
  IconQrCode,
  IconLoader,
} from "../components/icons/Icons";

const EXAM_PERIODS = [
  { key: "prelim", label: "Prelim" },
  { key: "midterm", label: "Midterm" },
  { key: "preFinal", label: "Pre-Final" },
  { key: "final", label: "Final" },
];

const ExamPermit = () => {
  const { user } = useAuth();
  const studentId = user?.studentId;

  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);

  useEffect(() => {
    if (!studentId) return;

    const fetch = async () => {
      try {
        const data = await getEligibility(studentId);
        setEligibility(data);
        setError("");
      } catch {
        /* Ledger may not exist yet — treat as all false */
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

  const handleGenerateQR = async (examKey) => {
    if (!studentId) return;
    setSelectedExam(examKey);
    setQrLoading(true);
    setQrData(null);
    try {
      const data = await generateQR(studentId, examKey);
      setQrData(data.qr);
    } catch {
      setError("Could not generate QR code.");
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Exam Permit"
        subtitle="View your exam eligibility and generate digital permits."
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Student info card */}
      <div className="mb-8 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">
            Student Information
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
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
      <div className="mb-8 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
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
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
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
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            {EXAM_PERIODS.map(({ key, label }) => {
              const valid = eligibility?.[key] ?? false;

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
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sti-blue/10 text-sti-blue">
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
                        className={`text-xs font-semibold ${valid ? "text-sti-blue" : "text-gray-400"}`}
                      >
                        {valid ? "Eligible" : "Not Eligible"}
                      </p>
                    </div>
                  </div>

                  {/* Badge */}
                  <span
                    className={[
                      "inline-flex rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm",
                      valid
                        ? "bg-sti-blue/10 text-sti-blue"
                        : "bg-gray-100 text-gray-400",
                    ].join(" ")}
                  >
                    {valid ? "Valid" : "Invalid"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Code generation */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">
            Digital Exam Permit (QR)
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Generate a QR code for a valid exam period to use as your digital
            permit.
          </p>
        </div>

        <div className="space-y-6 p-6">
          {/* Exam period selector */}
          <div className="flex flex-wrap gap-3">
            {EXAM_PERIODS.map(({ key, label }) => {
              const valid = eligibility?.[key] ?? false;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!valid || loading}
                  onClick={() => handleGenerateQR(key)}
                  className={[
                    "flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-sti-blue/20",
                    valid
                      ? selectedExam === key
                        ? "bg-sti-blue text-white shadow-[0_4px_14px_rgba(0,61,165,0.35)]"
                        : "border border-sti-blue/20 bg-sti-blue/5 text-sti-blue hover:bg-sti-blue/10"
                      : "cursor-not-allowed border border-gray-100 bg-gray-50 text-gray-300",
                  ].join(" ")}
                  aria-label={`Generate ${label} exam permit QR code`}
                  aria-disabled={!valid}
                >
                  <IconQrCode className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* QR display */}
          {(qrLoading || qrData) && (
            <div className="flex flex-col items-center rounded-xl border border-gray-100 bg-gray-50/50 p-8">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <IconLoader className="h-8 w-8 text-sti-blue" />
                  <p className="text-sm font-medium text-gray-500">
                    Generating QR code…
                  </p>
                </div>
              ) : (
                <>
                  <img
                    src={qrData}
                    alt="Exam permit QR code"
                    className="mb-4 h-52 w-52 rounded-lg border border-gray-200 bg-white p-2"
                  />
                  <p className="text-sm font-bold text-gray-800">
                    {EXAM_PERIODS.find((e) => e.key === selectedExam)?.label}{" "}
                    Exam Permit
                  </p>
                  <p className="text-xs text-gray-500">
                    {user?.name} · {studentId}
                  </p>
                </>
              )}
            </div>
          )}

          {/* No valid periods hint */}
          {!loading &&
            eligibility &&
            !Object.values(eligibility).some(Boolean) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                You currently have no eligible exam periods. Please complete
                your payment to unlock exam permits.
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ExamPermit;
