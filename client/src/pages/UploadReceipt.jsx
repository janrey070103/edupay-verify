import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { uploadPayment } from "../api/paymentApi";
import { getCurrentUser } from "../api/authApi";

const TERMS = ["Prelim", "Midterm", "PreFinal", "Final"];
const peso = (amount) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

export default function UploadReceipt() {
  const descriptionRef = useRef(null);
  const fileRef = useRef(null);
  const [account, setAccount] = useState(null);
  const [paymentType, setPaymentType] = useState("Term");
  const [term, setTerm] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => { getCurrentUser().then(setAccount).catch(() => setError("Could not load your account.")); }, []);
  const focusMissing = (ref, message) => {
    setError(message);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    ref.current?.focus({ preventScroll: true });
  };
  const submit = async (event) => {
    event.preventDefault(); setError("");
    if (paymentType === "Term" && !term) return focusMissing(descriptionRef, "Please select an examination term.");
    if (!file) return focusMissing(fileRef, "Please upload your payment receipt.");
    if (!account) return setError("Your account is still loading. Try again shortly.");
    setLoading(true);
    try {
      const data = new FormData();
      data.append("receipt", file);
      data.append("paymentType", paymentType);
      data.append("paymentDescription", paymentType === "Full Tuition" ? "Full Tuition Payment" : `Tuition - ${term}`);
      if (paymentType === "Term") data.append("examCoverage", term);
      setSubmitted(await uploadPayment(data));
    } catch (err) { setError(err.response?.data?.message || "Upload failed. Please try again."); }
    finally { setLoading(false); }
  };

  if (submitted) return <section className="mx-auto max-w-2xl rounded-xl border border-green-200 bg-white p-6 shadow-sm" aria-live="polite">
    <h2 className="text-xl font-bold text-green-800">Receipt submitted for cashier review</h2>
    <p className="mt-2 text-sm text-gray-600">Your payment remains pending until a cashier verifies its amount and approves it.</p>
    <dl className="mt-5 space-y-2 text-sm">
      <div className="flex justify-between gap-4"><dt>Description</dt><dd className="font-semibold">{submitted.paymentDescription}</dd></div>
      <div className="flex justify-between gap-4"><dt>OCR amount</dt><dd className="font-semibold">{submitted.amountStatus === "Detected" ? peso(submitted.amount) : "Needs cashier review"}</dd></div>
      <div className="flex justify-between gap-4"><dt>Status</dt><dd className="font-semibold">{submitted.status}</dd></div>
    </dl>
    <Link to="/history" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-sti-blue px-5 font-bold text-white">View payment history</Link>
  </section>;

  return <form onSubmit={submit} noValidate className="mx-auto max-w-2xl rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold text-gray-800">Upload Receipt</h2>
    <p className="mt-1 text-sm text-gray-500">Your receipt will be reviewed by a cashier before it affects your ledger.</p>
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-6 space-y-5">
      <div><label htmlFor="upload-name" className="mb-1 block text-sm font-semibold">Full name</label>
        <input id="upload-name" readOnly value={account?.name || "Loading…"} className="min-h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" /></div>
      <div><label htmlFor="upload-id" className="mb-1 block text-sm font-semibold">Student ID</label>
        <input id="upload-id" readOnly value={account?.studentId || ""} className="min-h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" /></div>
      <div><label htmlFor="upload-payment-type" className="mb-1 block text-sm font-semibold">Payment type *</label>
        <select id="upload-payment-type" value={paymentType} onChange={(e) => { setPaymentType(e.target.value); setTerm(""); }}
          className="min-h-11 w-full rounded-lg border border-gray-200 px-3 focus:border-sti-blue focus:outline-none">
          <option value="Term">Examination term payment</option>
          <option value="Full Tuition">Full tuition payment</option>
        </select></div>
      {paymentType === "Term" && <div><label htmlFor="upload-description" className="mb-1 block text-sm font-semibold">Examination term *</label>
        <select id="upload-description" ref={descriptionRef} value={term} onChange={(e) => setTerm(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-gray-200 px-3 focus:border-sti-blue focus:outline-none">
          <option value="">Select an examination term</option>
          {TERMS.map((value) => <option key={value} value={value}>Tuition - {value}</option>)}
        </select></div>}
      {paymentType === "Full Tuition" && <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
        This payment covers your remaining tuition for {account?.semester || "the current semester"} ({account?.schoolYear || "the current school year"}). A cashier will confirm the amount before all exam permits are enabled.
      </p>}
      <div><label htmlFor="upload-file" className="mb-1 block text-sm font-semibold">Payment receipt *</label>
        <input id="upload-file" ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => {
            const selected = e.target.files?.[0] || null;
            if (selected && selected.size > 10 * 1024 * 1024) { setFile(null); setError("Receipt must be 10 MB or smaller."); e.target.value = ""; }
            else { setFile(selected); setError(""); }
          }}
          className="block min-h-11 w-full rounded-lg border border-gray-200 p-2 text-sm" />
        <p className="mt-1 text-xs text-gray-500">JPG, PNG, or PDF; maximum 10 MB.</p></div>
    </div>
    <button type="submit" disabled={loading || !account} className="mt-7 min-h-11 rounded-lg bg-sti-gold px-5 font-black text-sti-blue disabled:opacity-50">
      {loading ? "Uploading…" : "Submit receipt for review"}</button>
  </form>;
}
