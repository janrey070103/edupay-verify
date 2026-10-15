import { useEffect, useState } from "react";
import { getCurrentUser } from "../api/authApi";
import {
  getEligibility,
  generateQR,
  getStudentPermits,
} from "../api/eligibilityApi";
import PageHeader from "../components/ui/PageHeader";
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
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedPermitForModal, setSelectedPermitForModal] = useState(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => {
      setError("Could not load your account."); setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!studentId) return;

    const fetch = async () => {
      try {
        const [eligibilityData, permitData] = await Promise.all([
          getEligibility(studentId),
          getStudentPermits(studentId),
        ]);
        setEligibility(eligibilityData);
        setPermits(permitData);
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

  const handleGenerateQR = async (examKey) => {
    if (!studentId) return;
    setSelectedExam(examKey);
    setQrLoading(true);
    setQrData(null);
    try {
      const examType = EXAM_PERIODS.find((e) => e.key === examKey)?.apiValue;
      const data = await generateQR(studentId, examType);
      setQrData(data.qr);
      setPermits((current) => [...current.filter((permit) => permit.examType !== examType), data.permit]);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not generate QR code.");
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
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
            {EXAM_PERIODS.map(({ key, label, apiValue }) => {
              const permit = permits.find((p) => p.examType === apiValue);
              const eligible = eligibility?.[key] ?? false;
              const valid = eligible && !!permit;

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
                        {valid ? "Permit Ready" : eligible ? "Eligible — generate permit" : "Not Eligible"}
                      </p>
                    </div>
                  </div>

                  {/* Badge */}
                  <span
                    onClick={() => {
                      if (valid) {
                        setSelectedPermitForModal({ permit, label });
                      }
                    }}
                    className={[
                      "inline-flex rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm transition-colors",
                      valid
                        ? "cursor-pointer hover:bg-blue-600 hover:text-white bg-blue-50 text-blue-700"
                        : "bg-gray-100 text-gray-400",
                    ].join(" ")}
                  >
                    {valid ? "Valid" : eligible ? "Eligible" : "Invalid"}
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
                    "flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                    valid
                      ? selectedExam === key
                        ? "bg-blue-600 text-white shadow-[0_4px_14px_rgba(37,99,235,0.39)]"
                        : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
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
                  <IconLoader className="h-8 w-8 text-blue-600" />
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

      {/* Permit status and scan history */}
      <Modal
        isOpen={!!selectedPermitForModal}
        onClose={() => setSelectedPermitForModal(null)}
        title="Exam Permit Status"
      >
        {selectedPermitForModal && selectedPermitForModal.permit && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 mb-3 shadow-sm">
                <IconQrCode className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-gray-800 text-lg">Permit Ready</h4>
              <p className="text-sm text-blue-600 font-semibold mt-1">Present this QR to each exam proctor.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                 <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Term</label>
                 <p className="text-sm font-semibold text-gray-800">{selectedPermitForModal.label}</p>
               </div>
               
            </div>
            <div>
              <h5 className="text-sm font-bold text-gray-800">Recent scans</h5>
              {selectedPermitForModal.permit.scans?.length ?
                <ul className="mt-2 space-y-2 text-sm text-gray-600">
                  {[...selectedPermitForModal.permit.scans].reverse().slice(0, 5).map((scan, index) =>
                    <li key={index} className="rounded-lg border border-gray-100 p-2">
                      {scan.teacherName || "Teacher"} · {new Intl.DateTimeFormat("en-PH", {
                        timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
                      }).format(new Date(scan.scannedAt))}
                    </li>)}
                </ul> : <p className="mt-1 text-sm text-gray-500">No scans yet.</p>}
            </div>
            
            <div className="mt-6">
              <button 
                onClick={() => setSelectedPermitForModal(null)}
                className="w-full bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors py-2.5"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default ExamPermit;
