import { useEffect, useState } from "react";
import { getMyLedger } from "../api/eligibilityApi";

const peso = (amount) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
export default function StudentLedger() {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const load = () => getMyLedger().then((value) => { setLedger(value); setError(""); })
      .catch(() => setError("Could not load your tuition ledger."))
      .finally(() => setLoading(false));
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);
  const hasConfiguredTotal = ledger?.tuitionConfigured === true
    && Number.isFinite(Number(ledger?.totalTuition))
    && Number(ledger.totalTuition) > 0;
  const total = hasConfiguredTotal ? Number(ledger.totalTuition) : 0;
  const paid = Math.max(0, Number(ledger?.paidAmount) || 0);
  const remaining = hasConfiguredTotal ? Math.max(0, Number(ledger?.remainingBalance) || 0) : null;
  const percent = hasConfiguredTotal ? Math.min(100, Math.max(0, paid / total * 100)) : null;
  return <section className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-bold text-gray-800">Tuition Ledger</h2>
    {loading ? <p className="mt-4 text-sm text-gray-500">Loading ledger…</p> : error ?
      <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : <>
      {!ledger?._id && <p className="mt-3 text-sm text-gray-500">No approved payments have been recorded yet.</p>}
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
        <div><dt className="text-gray-500">Total Paid So Far</dt><dd className="font-bold text-gray-800">{peso(paid)}</dd></div>
        <div><dt className="text-gray-500">Payment Status</dt><dd className="font-bold text-gray-800">{ledger?.fullyPaid ? "Paid in Full" : paid > 0 ? "In Progress" : "No Payments"}</dd></div>
        <div><dt className="text-gray-500">Remaining Balance</dt><dd className="font-bold text-gray-800">{hasConfiguredTotal ? peso(remaining) : "Tuition target not configured"}</dd></div>
      </dl>
      {hasConfiguredTotal ? <>
        <p className="mt-5 text-sm font-semibold text-gray-700">Payment progress: {percent.toFixed(1)}%</p>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Tuition paid">
          <div className="h-full rounded-full bg-sti-blue" style={{ width: `${percent}%` }} /></div>
      </> : null}
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">{[["Prelim", ledger.prelim], ["Midterm", ledger.midterm],
        ["PreFinal", ledger.preFinal], ["Final", ledger.final]].map(([term, eligible]) =>
          <span key={term} className={`rounded-full px-3 py-1 ${eligible ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
            {term}: {eligible ? "Eligible" : "Not yet eligible"}</span>)}</div>
    </>}
  </section>;
}
