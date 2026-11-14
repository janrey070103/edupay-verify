import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDirectPayment,
  getPayments,
  getStudentPaymentOverview,
  searchStudents,
} from "../api/paymentApi";
import { useToast } from "../context/ToastContext";
import { formatLastFirst } from "../utils/userPresentation";
import { refreshNavBadges } from "../utils/navBadges";
import StatusBadge from "./ui/StatusBadge";
import Skeleton from "./ui/Skeleton";
import { IconLoader, IconSearch, IconX, IconCheckCircle, IconAlertCircle } from "./icons/Icons";

const TERMS = [
  { value: "Prelim", label: "Prelim" },
  { value: "Midterm", label: "Midterm" },
  { value: "PreFinal", label: "Pre-Final" },
  { value: "Final", label: "Final" },
];
const peso = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value) || 0);
const shortDate = (value) => (value ? new Date(value).toLocaleDateString("en-PH", {
  timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }) : "—");
const CARD = "rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] sm:p-5";
const INPUT = "min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20";
const EMPTY_FORM = { amount: "", examCoverage: "", paymentDescription: "" };

const accountProblem = (student) => {
  if (!student) return "";
  if (student.isActive === false) return "Archived account";
  if (student.verificationStatus === "pending") return "Waiting for verification";
  if (student.verificationStatus === "rejected") return "Registration rejected";
  return "";
};

// Mirrors the server's ledger update so the cashier sees the result before saving.
const previewLedger = (ledger, amount, term) => {
  if (!ledger) return null;
  const paid = (Number(ledger.paidAmount) || 0) + (Number(amount) || 0);
  const remaining = Math.max(0, (Number(ledger.totalTuition) || 0) - paid);
  const terms = { ...ledger.terms };
  if (remaining === 0) TERMS.forEach(({ value }) => { terms[value] = true; });
  if (term) terms[term] = true;
  return { paid, remaining, terms, fullyPaid: remaining === 0 };
};

/** Student search as you type, with keyboard support. */
const StudentSearch = ({ onSelect }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return undefined;
    let current = true;
    const timer = setTimeout(() => {
      setSearching(true);
      searchStudents(term)
        .then((data) => {
          if (!current) return;
          setResults(Array.isArray(data) ? data : []);
          setMessage(Array.isArray(data) && data.length === 0 ? "No students match." : "");
          setActive(-1);
          setOpen(true);
        })
        .catch((err) => { if (current) { setResults([]); setMessage(err.response?.data?.message || "Search failed."); setOpen(true); } })
        .finally(() => { if (current) setSearching(false); });
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [query]);

  const choose = (student) => {
    onSelect(student);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (!open || !results.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => (i + 1) % results.length); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => (i <= 0 ? results.length - 1 : i - 1)); }
    if (event.key === "Enter" && active >= 0) { event.preventDefault(); choose(results[active]); }
    if (event.key === "Escape") setOpen(false);
  };

  return (
    <div className="relative">
      <label htmlFor="direct-search" className="mb-1 block text-sm font-semibold text-gray-700">Find student</label>
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          id="direct-search"
          type="text"
          autoComplete="off"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim().length < 2) { setOpen(false); setResults([]); } }}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Type a student ID or name (at least 2 characters)…"
          role="combobox"
          aria-expanded={open}
          aria-controls="direct-search-results"
          className={`${INPUT} pl-9 pr-10`}
        />
        {searching && <IconLoader className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sti-blue" />}
      </div>
      {open && (
        <ul id="direct-search-results" role="listbox"
          className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
          {message && <li className="px-4 py-3 text-sm text-gray-500">{message}</li>}
          {results.map((student, index) => {
            const problem = accountProblem(student);
            return (
              <li key={student._id} role="option" aria-selected={index === active}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(student)}
                  className={`flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left hover:bg-blue-50 ${index === active ? "bg-blue-50" : ""}`}>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-gray-800">{student.studentId}</span>
                    <span className="block truncate text-sm text-gray-600">{formatLastFirst(student)}</span>
                    <span className="block text-xs text-gray-400">
                      {student.course || "No course"} · Year {student.yearLevel || "—"}
                    </span>
                  </span>
                  {problem && (
                    <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">{problem}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const DirectPaymentPanel = ({ onRecorded }) => {
  const { showToast } = useToast();
  const [studentId, setStudentId] = useState("");
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [descriptionEdited, setDescriptionEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState(null);
  const amountRef = useRef(null);

  const loadRecent = useCallback(() => getPayments({ method: "direct", limit: 8, sort: "createdAt", order: "desc" })
    .then((result) => setRecent(result?.data || []))
    .catch(() => setRecent([])), []);

  const loadOverview = useCallback((id) => getStudentPaymentOverview(id)
    .then((data) => { setOverview(data); setOverviewError(""); })
    .catch((err) => setOverviewError(err.response?.data?.message || "Could not load the student's account.")), []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  useEffect(() => {
    if (!studentId) return undefined;
    let current = true;
    getStudentPaymentOverview(studentId)
      .then((data) => { if (current) { setOverview(data); setOverviewError(""); } })
      .catch((err) => { if (current) setOverviewError(err.response?.data?.message || "Could not load the student's account."); });
    return () => { current = false; };
  }, [studentId]);

  const selectStudent = (student) => {
    setOverview(null);
    setOverviewError("");
    setForm(EMPTY_FORM);
    setDescriptionEdited(false);
    setStudentId(student.studentId);
  };

  const clearStudent = () => {
    setStudentId("");
    setOverview(null);
    setOverviewError("");
    setForm(EMPTY_FORM);
    setDescriptionEdited(false);
  };

  const ledger = overview?.ledger;
  const amount = Number(form.amount);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const preview = useMemo(() => (amountValid ? previewLedger(ledger, amount, form.examCoverage) : null),
    [ledger, amount, amountValid, form.examCoverage]);
  const overpay = ledger && amountValid && amount > (Number(ledger.remainingBalance) || 0);
  const termAlreadyCleared = form.examCoverage && ledger?.terms?.[form.examCoverage];

  const chooseTerm = (term) => setForm((prev) => ({
    ...prev,
    examCoverage: term,
    // Same wording as receipt uploads, unless the cashier typed their own.
    paymentDescription: descriptionEdited ? prev.paymentDescription : (term ? `Tuition - ${term}` : ""),
  }));

  const submit = async (event) => {
    event.preventDefault();
    if (!overview?.canPay) return;
    if (!amountValid) { showToast("Enter an amount greater than zero.", "error"); amountRef.current?.focus(); return; }
    setSaving(true);
    try {
      await createDirectPayment({
        studentId: overview.student.studentId,
        amount,
        paymentDescription: form.paymentDescription.trim() || "Direct Payment",
        examCoverage: form.examCoverage || null,
      });
      showToast(`Payment of ${peso(amount)} recorded for ${overview.student.studentId}.`, "success");
      setForm(EMPTY_FORM);
      setDescriptionEdited(false);
      refreshNavBadges();
      await Promise.all([loadOverview(overview.student.studentId), loadRecent()]);
      onRecorded?.();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to record direct payment.", "error");
    } finally {
      setSaving(false);
    }
  };

  const student = overview?.student;
  const problem = accountProblem(student);
  const paidInFull = Boolean(ledger?.fullyPaid) || (ledger?.exists && Number(ledger?.remainingBalance) <= 0);

  return (
    <div className="grid gap-4">
      <section className={CARD}>
        <StudentSearch onSelect={selectStudent} />
        {!studentId && (
          <p className="mt-3 text-sm text-gray-500">Search by student ID or name. Pick a student to see their balance before recording a payment.</p>
        )}
      </section>

      {studentId && (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Live account panel */}
          <section className={`${CARD} lg:col-span-2`} aria-live="polite">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-gray-800">Student account</h3>
              <button type="button" onClick={clearStudent} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Choose another student">
                <IconX className="h-5 w-5" />
              </button>
            </div>
            {overviewError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{overviewError}</p>
            ) : !overview ? (
              <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-24 w-full" /></div>
            ) : (
              <>
                <p className="text-sm font-bold text-gray-800">{student.studentId}</p>
                <p className="text-sm text-gray-700">{formatLastFirst(student)}</p>
                <p className="text-xs text-gray-500">
                  {student.course || "No course"} · Year {student.yearLevel || "—"} · {student.semester || "—"} {student.schoolYear || ""}
                </p>
                {problem && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {problem}: payments cannot be recorded for this account.
                  </p>
                )}
                {!problem && paidInFull && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
                    <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> Fully paid: all terms are cleared. No payment can be recorded.
                  </p>
                )}
                <dl className="mt-4 grid grid-cols-3 gap-2">
                  {[["Tuition", ledger.totalTuition], ["Paid", ledger.paidAmount], ["Balance", ledger.remainingBalance]].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-gray-50/80 px-3 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
                      <dd className={`mt-0.5 text-sm font-black ${label === "Balance" && Number(value) > 0 ? "text-red-600" : "text-gray-800"}`}>{peso(value)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Cleared terms</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {TERMS.map(({ value, label }) => (
                    <span key={value} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${ledger.terms[value]
                      ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {ledger.terms[value] && <IconCheckCircle className="h-3.5 w-3.5" />} {label}
                    </span>
                  ))}
                </div>
                {overview.pendingReceipts > 0 && (
                  <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                    {overview.pendingReceipts} uploaded receipt(s) are waiting for review. Check them in Receipt Verification first to avoid recording the same payment twice.
                  </p>
                )}
                {overview.recentPayments?.length > 0 && (
                  <>
                    <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Latest payments</p>
                    <ul className="mt-1.5 divide-y divide-gray-50 text-sm">
                      {overview.recentPayments.map((payment) => (
                        <li key={payment._id} className="flex items-center justify-between gap-2 py-1.5">
                          <span className="min-w-0 truncate text-gray-600">
                            {shortDate(payment.createdAt)} · {payment.paymentDescription || payment.examCoverage || "Payment"}
                            {payment.paymentMethod === "direct" ? " · direct" : ""}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="font-semibold text-gray-800">{payment.amount != null ? peso(payment.amount) : "—"}</span>
                            <StatusBadge status={payment.status} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>

          {/* Payment form with live preview */}
          <form onSubmit={submit} className={`${CARD} lg:col-span-3`} noValidate>
            <h3 className="mb-4 text-lg font-bold text-gray-800">Record payment</h3>
            <fieldset disabled={!overview?.canPay || saving} className="grid gap-4 disabled:opacity-60">
              <div>
                <label htmlFor="direct-term" className="mb-1 block text-sm font-semibold text-gray-700">Exam coverage</label>
                <select id="direct-term" value={form.examCoverage} onChange={(e) => chooseTerm(e.target.value)} className={INPUT}>
                  <option value="">None (balance payment only)</option>
                  {TERMS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}{ledger?.terms?.[value] ? " (already cleared)" : ""}</option>
                  ))}
                </select>
                {termAlreadyCleared && (
                  <p className="mt-1 text-xs text-amber-700">This student is already cleared for {form.examCoverage}. Make sure this is not a duplicate.</p>
                )}
              </div>

              <div>
                <label htmlFor="direct-amount" className="mb-1 block text-sm font-semibold text-gray-700">Amount (PHP) <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-0 flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-gray-500">₱</span>
                    <input id="direct-amount" ref={amountRef} type="number" min="0.01" step="0.01" inputMode="decimal"
                      value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00" className={`${INPUT} pl-7`} />
                  </div>
                  {ledger && Number(ledger.remainingBalance) > 0 && (
                    <button type="button" onClick={() => setForm((prev) => ({ ...prev, amount: String(ledger.remainingBalance) }))}
                      className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-sti-blue hover:bg-blue-100">
                      Full balance {peso(ledger.remainingBalance)}
                    </button>
                  )}
                </div>
                {overpay && (
                  <p className="mt-1 text-xs text-amber-700">This is more than the remaining balance of {peso(ledger.remainingBalance)}.</p>
                )}
              </div>

              <div>
                <label htmlFor="direct-description" className="mb-1 block text-sm font-semibold text-gray-700">Description</label>
                <input id="direct-description" type="text" value={form.paymentDescription}
                  onChange={(e) => { setDescriptionEdited(true); setForm((prev) => ({ ...prev, paymentDescription: e.target.value })); }}
                  placeholder="Filled in from the exam coverage, or type your own" className={INPUT} />
              </div>

              {preview && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900" aria-live="polite">
                  <p className="font-bold">After this payment</p>
                  <p>Paid {peso(preview.paid)} · Balance {peso(preview.remaining)}{preview.fullyPaid ? " · Fully paid" : ""}</p>
                  <p>Cleared: {TERMS.filter(({ value }) => preview.terms[value]).map(({ label }) => label).join(", ") || "none yet"}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
                <button type="submit" disabled={!amountValid} aria-busy={saving}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-sti-gold px-5 text-sm font-black text-sti-blue shadow-[0_8px_20px_rgba(255,199,44,0.25)] hover:bg-sti-gold-hover disabled:opacity-60 sm:flex-none">
                  {saving && <IconLoader className="h-4 w-4" />}
                  {saving ? "Recording…" : amountValid ? `Record ${peso(amount)}` : "Record payment"}
                </button>
                <button type="button" onClick={() => { setForm(EMPTY_FORM); setDescriptionEdited(false); }}
                  className="min-h-11 rounded-lg border border-gray-200 px-4 text-sm font-bold text-gray-600 hover:bg-gray-50">
                  Reset form
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      )}

      {/* Recent direct payments (all cashiers) */}
      <section className={CARD}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Recent direct payments</h3>
          <button type="button" onClick={loadRecent} className="min-h-11 rounded-lg px-3 text-sm font-bold text-sti-blue hover:bg-blue-50">Refresh</button>
        </div>
        {recent === null ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-gray-500">No direct payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recent.map((payment) => (
              <li key={payment._id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => selectStudent({ studentId: payment.studentId })} className="min-w-0 text-left hover:underline">
                  <span className="text-sm font-bold text-gray-800">{payment.studentId}</span>
                  <span className="ml-2 text-sm text-gray-600">{payment.studentName}</span>
                </button>
                <span className="text-sm text-gray-600">
                  {payment.paymentDescription || "Direct Payment"} · <strong className="text-gray-800">{peso(payment.amount)}</strong> · {shortDate(payment.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default DirectPaymentPanel;
