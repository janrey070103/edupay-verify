import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { uploadPayment } from "../api/paymentApi";
import { getCurrentUser } from "../api/authApi";
import { getMyLedger } from "../api/eligibilityApi";
import { IconLoader } from "../components/icons/Icons";
import { PAYMENT_CHANNELS, channelLabel, referenceHint } from "../utils/paymentChannels";
import ReceiptCheckSummary from "../components/ReceiptCheckSummary";
import { markMissing } from "../utils/fieldAlerts";

const TERMS = ["Prelim", "Midterm", "PreFinal", "Final"];

const ReadOnlyField = ({ id, value, loading }) => (
  <div className="relative">
    <input id={id} readOnly value={loading ? "" : value || "—"}
      className="min-h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
    {loading && (
      <span className="absolute inset-y-0 left-3 flex items-center gap-2 text-sm text-gray-400">
        <IconLoader className="h-4 w-4" /> Loading…
      </span>
    )}
  </div>
);
const peso = (amount) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

export default function UploadReceipt() {
  const descriptionRef = useRef(null);
  const fileRef = useRef(null);
  const [account, setAccount] = useState(null);
  const [term, setTerm] = useState("");
  const [paymentType, setPaymentType] = useState("Term"); // "Term" | "Full Tuition"
  const [ledger, setLedger] = useState(null);
  const remaining = Math.max(0, Number(ledger?.remainingBalance) || 0);
  // Fully paid: no balance left (the server refuses any further receipt).
  const fullyPaid = Boolean(ledger?.fullyPaid) || (ledger?.hasLedger && remaining <= 0);
  const clearedTerms = ledger?.terms || {};
  const [channel, setChannel] = useState("");
  const channelRef = useRef(null);
  const [file, setFile] = useState(null);
  // Typed by the student; the server reads the receipt to confirm them.
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const amountRef = useRef(null);
  const referenceRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => { getCurrentUser().then(setAccount).catch(() => setError("Could not load your account.")); }, []);
  // Remaining balance for the full tuition option (best effort).
  useEffect(() => { getMyLedger().then(setLedger).catch(() => {}); }, []);
  const focusMissing = (ref, message) => {
    setError(message);
    markMissing([ref]);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    ref.current?.focus();
  };
  const submit = async (event) => {
    event.preventDefault(); setError("");
    if (paymentType === "Term" && !term) return focusMissing(descriptionRef, "Please select an examination term.");
    if (!channel) return focusMissing(channelRef, "Please select how you paid.");
    if (!(Number(amount) > 0)) return focusMissing(amountRef, "Please enter the amount you sent to the school.");
    if (reference.replace(/[^a-z0-9]/gi, "").length < 4) return focusMissing(referenceRef, "Please enter the reference number on your receipt.");
    if (!file) return focusMissing(fileRef, "Please upload your payment receipt.");
    if (!account) return setError("Your account is still loading. Try again shortly.");
    setLoading(true);
    try {
      const data = new FormData();
      data.append("receipt", file);
      data.append("paymentType", paymentType);
      data.append("paymentDescription", paymentType === "Full Tuition" ? "Full Tuition Payment" : `Tuition - ${term}`);
      if (paymentType === "Term") data.append("examCoverage", term);
      data.append("paymentChannel", channel);
      data.append("claimedAmount", amount);
      data.append("referenceNumber", reference.trim());
      setSubmitted(await uploadPayment(data));
    } catch (err) { setError(err.response?.data?.message || "Upload failed. Please try again."); }
    finally { setLoading(false); }
  };

  if (submitted) return <section className="w-full rounded-xl border border-green-200 bg-white p-5 shadow-sm" aria-live="polite">
    <h2 className="text-xl font-bold text-green-800">Receipt submitted for cashier review</h2>
    <p className="mt-2 text-sm text-gray-600">Your payment remains pending until a cashier verifies its amount and approves it.</p>
    <dl className="mt-5 space-y-2 text-sm">
      <div className="flex justify-between gap-4"><dt>Description</dt><dd className="font-semibold">{submitted.paymentDescription}</dd></div>
      <div className="flex justify-between gap-4"><dt>Payment mode</dt><dd className="text-right font-semibold">{channelLabel(submitted.paymentChannel)}</dd></div>
      <div className="flex justify-between gap-4"><dt>Amount sent</dt><dd className="font-semibold">{peso(submitted.claimedAmount ?? submitted.amount)}</dd></div>
      <div className="flex justify-between gap-4"><dt>Reference no.</dt><dd className="text-right font-semibold">{submitted.referenceNumber || "—"}</dd></div>
      <div className="flex justify-between gap-4"><dt>Status</dt><dd className="font-semibold">{submitted.status}</dd></div>
    </dl>
    <ReceiptCheckSummary ocr={submitted.ocr} />
    <Link to="/history" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-sti-blue px-5 font-bold text-white">View payment history</Link>
  </section>;

  if (fullyPaid) return <section className="w-full rounded-xl border border-green-200 bg-white p-5 shadow-sm" aria-live="polite">
    <h2 className="text-xl font-bold text-green-800">Your tuition is fully paid</h2>
    <p className="mt-2 text-sm text-gray-600">
      You have paid {peso(Number(ledger.paidAmount) || 0)} of {peso(Number(ledger.totalTuition) || 0)}, and all four exam terms are cleared.
      No more payments are needed, so receipts can no longer be uploaded.
    </p>
    <div className="mt-6 flex flex-wrap gap-3">
      <Link to="/history" className="inline-flex min-h-11 items-center rounded-lg bg-sti-blue px-5 font-bold text-white">View payment history</Link>
      <Link to="/student-exams" className="inline-flex min-h-11 items-center rounded-lg border border-gray-200 px-5 font-bold text-gray-700">My exams</Link>
    </div>
  </section>;

  return <form onSubmit={submit} noValidate className="w-full rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
    <h2 className="text-xl font-bold text-gray-800">Upload Receipt</h2>
    <p className="mt-1 text-sm text-gray-500">Your receipt will be reviewed by a cashier before it affects your ledger.</p>
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-6 space-y-5">
      <div><label htmlFor="upload-id" className="mb-1 block text-sm font-semibold">Student ID</label>
        <ReadOnlyField id="upload-id" value={account?.studentId} loading={!account && !error} /></div>
      <div><label htmlFor="upload-name" className="mb-1 block text-sm font-semibold">Full name</label>
        <ReadOnlyField id="upload-name" value={account?.name} loading={!account && !error} /></div>
      <div><label htmlFor="upload-payment-type" className="mb-1 block text-sm font-semibold">Payment type *</label>
        <select id="upload-payment-type" value={paymentType}
          onChange={(e) => {
            const next = e.target.value;
            setPaymentType(next);
            setTerm("");
            // Full tuition: start from the remaining balance (the student can still edit it).
            if (next === "Full Tuition" && !amount && remaining > 0) setAmount(String(remaining));
          }}
          className="min-h-11 w-full rounded-lg border border-gray-200 px-3 focus:border-sti-blue focus:outline-none">
          <option value="Term">Exam term payment</option>
          <option value="Full Tuition" disabled={fullyPaid}>Full tuition payment{fullyPaid ? " (already fully paid)" : ""}</option>
        </select></div>
      {paymentType === "Term" ? (
        <div><label htmlFor="upload-description" className="mb-1 block text-sm font-semibold">Examination term *</label>
          <select id="upload-description" ref={descriptionRef} value={term} onChange={(e) => setTerm(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-gray-200 px-3 focus:border-sti-blue focus:outline-none">
            <option value="">Select an examination term</option>
            {TERMS.map((value) => (
              <option key={value} value={value} disabled={clearedTerms[value]}>
                Tuition - {value}{clearedTerms[value] ? " (already paid)" : ""}
              </option>
            ))}
          </select>
          {TERMS.some((value) => clearedTerms[value]) && (
            <p className="mt-1 text-xs text-gray-500">Terms you have already paid cannot be selected.</p>
          )}</div>
      ) : (
        <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
          This pays your whole remaining tuition{remaining > 0 ? <> of <strong>{peso(remaining)}</strong></> : ""} for{" "}
          {account?.semester || "the current semester"} ({account?.schoolYear || "the current school year"}).
          Once the cashier confirms the full amount, all four exam terms are cleared at once.
        </p>
      )}
      <div><label htmlFor="upload-channel" className="mb-1 block text-sm font-semibold">Payment mode *</label>
        <select id="upload-channel" ref={channelRef} value={channel} onChange={(e) => setChannel(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-gray-200 px-3 focus:border-sti-blue focus:outline-none">
          <option value="">Select how you paid</option>
          {PAYMENT_CHANNELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {PAYMENT_CHANNELS.find((item) => item.value === channel)?.hint || "Where you made the payment shown on your receipt."}
        </p></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="upload-amount" className="mb-1 block text-sm font-semibold">Amount sent to the school *</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-gray-500">₱</span>
            <input id="upload-amount" ref={amountRef} type="number" min="1" step="0.01" inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
              className="min-h-11 w-full rounded-lg border border-gray-200 pl-7 pr-3 focus:border-sti-blue focus:outline-none" />
          </div>
          <p className="mt-1 text-xs text-gray-500">The amount on the receipt, <strong>not including</strong> any service fee.</p></div>
        <div><label htmlFor="upload-reference" className="mb-1 block text-sm font-semibold">{referenceHint(channel).label} *</label>
          <input id="upload-reference" ref={referenceRef} type="text" autoComplete="off" maxLength={40} value={reference}
            onChange={(e) => setReference(e.target.value)} placeholder={referenceHint(channel).placeholder}
            className="min-h-11 w-full rounded-lg border border-gray-200 px-3 uppercase focus:border-sti-blue focus:outline-none" />
          <p className="mt-1 text-xs text-gray-500">{referenceHint(channel).hint}</p></div>
      </div>
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
    {loading && (
      <div role="status" aria-live="polite" className="mt-6 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
        <IconLoader className="h-6 w-6 shrink-0 text-sti-blue" />
        <div>
          <p className="text-sm font-bold text-sti-blue">Uploading and reading your receipt…</p>
          <p className="text-xs text-blue-700">This can take several seconds. Please keep this page open.</p>
          <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-blue-100">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-sti-blue" />
          </div>
        </div>
      </div>
    )}
    <button type="submit" disabled={loading || !account} aria-busy={loading}
      className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-sti-gold px-5 font-black text-sti-blue disabled:cursor-wait disabled:opacity-60">
      {loading && <IconLoader className="h-4 w-4" />}
      {loading ? "Uploading…" : "Submit receipt for review"}</button>
  </form>;
}
