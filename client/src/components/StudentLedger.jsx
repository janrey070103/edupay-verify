import { useCallback, useEffect, useState } from "react";
import { getMyLedger } from "../api/eligibilityApi";
import { NAV_BADGES_EVENT } from "../utils/navBadges";
import TuitionDonut from "./ui/TuitionDonut";
import Skeleton from "./ui/Skeleton";
import ExamEligibility from "./ExamEligibility";

const peso = (amount) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(amount) || 0);
const TERMS = [
  { key: "Prelim", label: "Prelim" },
  { key: "Midterm", label: "Midterm" },
  { key: "PreFinal", label: "Pre-Final" },
  { key: "Final", label: "Final" },
];
const POLL_MS = 30000;

/**
 * Tuition Ledger: a live donut of paid vs not paid, with receipts awaiting
 * approval and the next progress payment shown as tentative amounts.
 * Refreshes every 30 s, when the tab regains focus, and when a notification
 * arrives (e.g. "Payment Approved").
 */
export default function StudentLedger() {
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => getMyLedger()
    .then((value) => { setLedger(value); setError(""); })
    .catch(() => setError("Could not load your tuition ledger.")), []);

  useEffect(() => {
    let active = true;
    const refresh = () => { if (active && document.visibilityState !== "hidden") load(); };
    getMyLedger()
      .then((value) => { if (active) { setLedger(value); setError(""); } })
      .catch(() => { if (active) setError("Could not load your tuition ledger."); });
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener(NAV_BADGES_EVENT, refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NAV_BADGES_EVENT, refresh);
    };
  }, [load]);

  const total = Math.max(0, Number(ledger?.totalTuition) || 0);
  const paid = Math.min(total, Math.max(0, Number(ledger?.paidAmount) || 0));
  const remaining = Math.max(0, Number(ledger?.remainingBalance ?? total - paid) || 0);
  const tentative = Math.min(remaining, Math.max(0, Number(ledger?.tentative?.amount) || 0));
  const unpaid = Math.max(0, remaining - tentative);
  const terms = ledger?.terms || { Prelim: ledger?.prelim, Midterm: ledger?.midterm, PreFinal: ledger?.preFinal, Final: ledger?.final };
  const unread = ledger?.tentative?.unreadCount || 0;
  const next = ledger?.nextPayment;

  return (
    <section className="mb-5 rounded-xl border border-gray-100 bg-white p-5 shadow-sm" aria-busy={!ledger && !error}>
      <h2 className="text-lg font-bold text-gray-800">Tuition Ledger</h2>

      {error && !ledger ? (
        <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>
      ) : !ledger ? (
        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
          <Skeleton variant="circle" className="h-44 w-44" />
          <div className="w-full space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-5">
          {/* Left: exam eligibility. Right: donut analytics and tentative amounts. */}
          <div className="min-w-0 lg:col-span-2">
            <ExamEligibility rows={ledger.eligibility || TERMS.map(({ key }) => ({ term: key, status: terms[key] ? "approved" : "not_open" }))} />
          </div>
          <div className="min-w-0 lg:col-span-3">
            <div>
              <TuitionDonut paid={paid} tentative={tentative} unpaid={unpaid} total={total}
                centerNote={ledger.fullyPaid ? "paid in full ✓" : "paid"} />
            </div>

            {(next || tentative > 0 || unread > 0) && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {next && (
                  <div className="w-full max-w-xs rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Next progress payment · tentative</p>
                    <p className="mt-0.5 text-base font-black text-gray-900">{peso(next.amount)}</p>
                    <p className="text-xs text-gray-500">
                      to be cleared for {TERMS.find((term) => term.key === next.term)?.label || next.term} (tuition split over 4 terms)
                    </p>
                  </div>
                )}
                {(tentative > 0 || unread > 0) && (
                  <div className="w-full max-w-xs rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Awaiting cashier approval</p>
                    <p className="mt-0.5 text-base font-black text-gray-900">{peso(tentative)}</p>
                    <p className="text-xs text-gray-500">
                      {ledger.tentative.count} receipt(s) submitted
                      {unread > 0 ? ` · ${unread} with the amount still to be confirmed` : ""}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
