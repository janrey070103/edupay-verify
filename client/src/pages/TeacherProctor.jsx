import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { scanExamPermit } from "../api/eligibilityApi";
import { getAssignedExams } from "../api/examApi";
import { singleScanCallback } from "../utils/singleScan";
import { IconLoader, IconCheckCircle, IconLock, IconXCircle } from "../components/icons/Icons";

const timePH = (value, options) => value ? new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", ...options,
}).format(new Date(value)) : "—";
const manilaDay = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(value));
const yearLabel = (n) => (n ? `${({ 1: "1st", 2: "2nd", 3: "3rd" })[Number(n)] || `${n}th`} year` : "All years");
const extractToken = (raw) => {
  const value = raw.trim();
  try { return JSON.parse(value).token || value; } catch { return value; }
};
const examLabel = (exam) => `${exam.subjectCode} – ${exam.subject} · ${exam.examType}${exam.room ? ` · Room ${exam.room}` : ""} · ${exam.schedule || ""}`;

const ResultRows = ({ rows }) => (
  <dl className="mt-4 space-y-1 text-sm">
    {rows.map(([label, value]) => (
      <div key={label} className="flex justify-between gap-4 border-b border-gray-100 py-2">
        <dt className="text-gray-500">{label}</dt><dd className="text-right font-semibold text-gray-800">{value || "—"}</dd>
      </div>
    ))}
  </dl>
);

export default function TeacherProctor() {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRunRef = useRef(0);
  const busyRef = useRef(false);
  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState(null); // { kind: "verified" | "locked", data }
  const [verifiedList, setVerifiedList] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");

  // Only exams this teacher proctors today can be scanned (the server enforces it too).
  useEffect(() => {
    let active = true;
    getAssignedExams()
      .then((data) => { if (active) setExams(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) { setExams([]); setError("Could not load your assigned exams."); } });
    return () => { active = false; };
  }, []);
  const todays = useMemo(() => (exams || []).filter((exam) =>
    exam.status !== "Cancelled" && manilaDay(exam.examDate) === manilaDay(new Date())), [exams]);
  const selected = todays.find((exam) => exam._id === examId) || null;

  const stopCamera = () => {
    cameraRunRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
  };
  useEffect(() => () => stopCamera(), []);

  const verify = async (raw) => {
    if (busyRef.current) return;
    if (!examId) { setError("Select the exam you are proctoring before scanning."); return; }
    const token = extractToken(raw);
    if (!token) { setError("Scan or paste a QR code first."); return; }
    stopCamera();
    busyRef.current = true;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await scanExamPermit(token, examId);
      setResult({ kind: "verified", data });
      setVerifiedList((list) => [{ ...data.student, at: data.verifiedAt }, ...list.filter((item) => item.studentId !== data.student.studentId)]);
      setManualCode("");
    } catch (err) {
      const body = err.response?.data;
      if (body?.locked) setResult({ kind: "locked", data: body });
      else setError(body?.message || "Could not verify this QR code.");
    } finally { busyRef.current = false; setLoading(false); }
  };

  const startCamera = async () => {
    if (!examId) { setError("Select the exam you are proctoring before scanning."); return; }
    setCameraMessage(""); setError(""); stopCamera();
    const cameraRun = cameraRunRef.current;
    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current,
        singleScanCallback(
          () => cameraRunRef.current === cameraRun && !busyRef.current,
          (raw) => { cameraRunRef.current += 1; void verify(raw); }
        ));
      if (cameraRunRef.current === cameraRun) controlsRef.current = controls;
      else controls.stop();
    } catch {
      if (cameraRunRef.current === cameraRun) {
        setCameraMessage("Could not open the camera. Check browser permission or paste the QR payload.");
      }
    }
  };

  const exam = result?.data?.exam;
  return <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-800">Scan Exam Permit</h2>
      <p className="mt-1 text-sm text-gray-500">Choose the exam you are proctoring now. Each QR is verified once per subject; only students of that course and year level are accepted.</p>
      <label htmlFor="scan-exam" className="mt-5 block text-sm font-semibold text-gray-700">Exam you are proctoring today</label>
      {exams === null ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-gray-500"><IconLoader className="h-4 w-4" /> Loading your exams…</p>
      ) : todays.length === 0 ? (
        <p className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">You have no exams assigned for today.</p>
      ) : (
        <select id="scan-exam" value={examId} onChange={(e) => { stopCamera(); setExamId(e.target.value); setResult(null); setVerifiedList([]); }}
          className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3 focus:border-sti-blue focus:outline-none">
          <option value="">Select an exam</option>
          {todays.map((item) => <option key={item._id} value={item._id}>{examLabel(item)}</option>)}
        </select>
      )}
      {selected && (
        <p className="mt-2 text-xs text-gray-500">
          Accepts: <strong>{selected.course || "course not set"}</strong> · {yearLabel(selected.courseYear)} · {selected.examType} permits
        </p>
      )}
      <video ref={videoRef} muted playsInline className="mt-5 aspect-video w-full rounded-lg bg-gray-950 object-cover" />
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={startCamera} disabled={loading || !examId} className="min-h-11 rounded-lg bg-sti-blue px-4 font-bold text-white disabled:opacity-50">Start camera</button>
        <button type="button" onClick={stopCamera} className="min-h-11 rounded-lg border border-gray-200 px-4 font-bold text-gray-700">Stop camera</button>
      </div>
      {cameraMessage && <p className="mt-3 text-sm text-amber-700">{cameraMessage}</p>}
      <label htmlFor="scan-code" className="mt-5 block text-sm font-semibold text-gray-700">QR payload or token</label>
      <textarea id="scan-code" rows={3} value={manualCode} onChange={(e) => setManualCode(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-200 p-3 focus:border-sti-blue focus:outline-none" />
      <button type="button" onClick={() => verify(manualCode)} disabled={loading || !manualCode.trim() || !examId}
        aria-busy={loading}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-sti-gold px-5 font-black text-sti-blue disabled:opacity-50">
        {loading && <IconLoader className="h-4 w-4" />}
        {loading ? "Verifying…" : "Verify permit"}
      </button>
      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <IconXCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
    </section>

    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm" aria-live="polite">
      <h2 className="text-lg font-bold text-gray-800">Verification result</h2>
      {!result ? <p className="mt-5 text-sm text-gray-500">Scan a permit to see the student, subject, room and verification time.</p> : (
        <>
          {result.kind === "verified" ? (
            <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-5 text-center">
              <p className="flex items-center justify-center gap-2 text-2xl font-black text-green-800"><IconCheckCircle className="h-7 w-7" /> VERIFIED</p>
              <p className="text-sm font-semibold text-green-700">{exam?.subjectCode} – {exam?.subject}</p>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5 text-center">
              <p className="flex items-center justify-center gap-2 text-2xl font-black text-amber-800"><IconLock className="h-7 w-7" /> ALREADY USED</p>
              <p className="text-sm font-semibold text-amber-800">{result.data.message}</p>
            </div>
          )}
          <ResultRows rows={[
            ["Student", result.data.student?.name], ["Student ID", result.data.student?.studentId],
            ...(result.kind === "verified" ? [["Course / Year", `${result.data.student?.course || "—"} · ${yearLabel(result.data.student?.yearLevel)}`]] : []),
            ["Subject", exam ? `${exam.subjectCode} – ${exam.subject}` : null],
            ["Exam", exam ? `${exam.examType} · ${exam.course || "—"} · ${yearLabel(exam.courseYear)}` : null],
            ["Room", exam?.room], ["Schedule", exam?.schedule],
            ["Verified by", result.data.verifiedBy?.name],
            ["Verified at", timePH(result.data.verifiedAt, { dateStyle: "medium", timeStyle: "short" })],
          ]} />
        </>
      )}
      {verifiedList.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-gray-800">Verified for this exam ({verifiedList.length})</h3>
          <ul className="mt-2 divide-y divide-gray-100 text-sm">
            {verifiedList.map((item) => (
              <li key={item.studentId} className="flex justify-between gap-3 py-1.5">
                <span><strong>{item.studentId}</strong> · {item.name}</span>
                <span className="text-gray-500">{timePH(item.at, { timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  </div>;
}
