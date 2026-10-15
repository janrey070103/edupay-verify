import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { scanExamPermit } from "../api/eligibilityApi";
import { singleScanCallback } from "../utils/singleScan";

const TERMS = ["Prelim", "Midterm", "PreFinal", "Final"];
const timePH = (value, options) => value ? new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", ...options,
}).format(new Date(value)) : "—";
const extractToken = (raw) => {
  const value = raw.trim();
  try { return JSON.parse(value).token || value; } catch { return value; }
};

export default function TeacherProctor() {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRunRef = useRef(0);
  const busyRef = useRef(false);
  const [term, setTerm] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");

  const stopCamera = () => {
    cameraRunRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
  };
  useEffect(() => () => stopCamera(), []);

  const verify = async (raw) => {
    if (busyRef.current) return;
    if (!term) { setError("Select the examination term before scanning."); return; }
    const token = extractToken(raw);
    if (!token) { setError("Scan or paste a QR code first."); return; }
    stopCamera();
    busyRef.current = true;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await scanExamPermit(token, term);
      setResult(data);
      setManualCode("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not verify this QR code.");
    } finally { busyRef.current = false; setLoading(false); }
  };

  const startCamera = async () => {
    if (!term) { setError("Select the examination term before scanning."); return; }
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

  return <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-800">Scan Exam Permit</h2>
      <p className="mt-1 text-sm text-gray-500">Select the term you are proctoring. Each camera start scans one permit; start it again for the next student.</p>
      <label htmlFor="scan-term" className="mt-5 block text-sm font-semibold text-gray-700">Examination term</label>
      <select id="scan-term" value={term} onChange={(e) => { stopCamera(); setTerm(e.target.value); setResult(null); }}
        className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3 focus:border-sti-blue focus:outline-none">
        <option value="">Select a term</option>{TERMS.map((value) => <option key={value}>{value}</option>)}
      </select>
      <video ref={videoRef} muted playsInline className="mt-5 aspect-video w-full rounded-lg bg-gray-950 object-cover" />
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={startCamera} disabled={loading} className="min-h-11 rounded-lg bg-sti-blue px-4 font-bold text-white disabled:opacity-50">Start camera</button>
        <button type="button" onClick={stopCamera} className="min-h-11 rounded-lg border border-gray-200 px-4 font-bold text-gray-700">Stop camera</button>
      </div>
      {cameraMessage && <p className="mt-3 text-sm text-amber-700">{cameraMessage}</p>}
      <label htmlFor="scan-code" className="mt-5 block text-sm font-semibold text-gray-700">QR payload or token</label>
      <textarea id="scan-code" rows={3} value={manualCode} onChange={(e) => setManualCode(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-200 p-3 focus:border-sti-blue focus:outline-none" />
      <button type="button" onClick={() => verify(manualCode)} disabled={loading || !manualCode.trim()}
        className="mt-3 min-h-11 rounded-lg bg-sti-gold px-5 font-black text-sti-blue disabled:opacity-50">
        {loading ? "Verifying…" : "Verify permit"}
      </button>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>

    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm" aria-live="polite">
      <h2 className="text-lg font-bold text-gray-800">Verification result</h2>
      {!result ? <p className="mt-5 text-sm text-gray-500">Scan a permit to see student and schedule details.</p> : <>
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-5 text-center">
          <p className="text-2xl font-black text-green-800">VERIFIED</p>
          <p className="text-sm font-semibold text-green-700">Eligible for {result.examType} examination</p>
        </div>
        <dl className="mt-5 space-y-2 text-sm">
          {[["Student", result.student?.name], ["Student ID", result.student?.studentId],
            ["Course", result.student?.course], ["Year level", result.student?.yearLevel],
            ["Exam term", result.examType], ["Status", result.verificationStatus],
            ["Date scanned", timePH(result.scannedAt, { dateStyle: "medium" })],
            ["Time scanned", timePH(result.scannedAt, { timeStyle: "short" })]
          ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-gray-100 py-2">
            <dt className="text-gray-500">{label}</dt><dd className="text-right font-semibold text-gray-800">{value || "—"}</dd>
          </div>)}
        </dl>
        {result.schedules?.length > 0 && <div className="mt-5">
          <h3 className="font-bold text-gray-800">Published schedule</h3>
          {result.schedules.map((schedule) => <p key={schedule._id} className="mt-2 text-sm text-gray-600">
            {timePH(schedule.examDate, { dateStyle: "full" })} · {schedule.semester} · {schedule.schoolYear}
          </p>)}
        </div>}
        {result.scheduledExams?.length > 0 && <div className="mt-5">
          <h3 className="font-bold text-gray-800">Subject examinations</h3>
          <ul className="mt-2 space-y-2 text-sm text-gray-600">{result.scheduledExams.map((exam) => <li key={exam._id}>
            {exam.subject} ({exam.subjectCode}) · {timePH(exam.examDate, { dateStyle: "medium" })} · {exam.schedule}
          </li>)}</ul>
        </div>}
      </>}
    </section>
  </div>;
}
