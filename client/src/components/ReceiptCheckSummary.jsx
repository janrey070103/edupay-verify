import { IconAlertCircle, IconCheckCircle, IconClock, IconXCircle } from "./icons/Icons";

// Result of the automatic receipt check (server: services/ocr). Students see
// whether their typed amount / reference were found; cashiers also see the
// student-ID match, receipt date, what the OCR read, and warnings.
const STATUS = {
  matched: { label: "Found on receipt", Icon: IconCheckCircle, chip: "bg-green-50 text-green-700 ring-green-200" },
  partial: { label: "Partly matched", Icon: IconClock, chip: "bg-amber-50 text-amber-700 ring-amber-200" },
  not_found: { label: "Not found", Icon: IconXCircle, chip: "bg-gray-100 text-gray-600 ring-gray-200" },
};
const peso = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value) || 0);
const day = (value) => (value ? new Date(value).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }) : "—");

const Chip = ({ status }) => {
  const meta = STATUS[status] || STATUS.not_found;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${meta.chip}`}>
      <meta.Icon className="h-3.5 w-3.5" /> {meta.label}
    </span>
  );
};

const Row = ({ label, value, status }) => (
  <div className="flex items-center justify-between gap-3 py-2 text-sm">
    <span className="min-w-0 text-gray-500">{label}{value ? <strong className="ml-1.5 text-gray-800">{value}</strong> : null}</span>
    {status && <Chip status={status} />}
  </div>
);

const ReceiptCheckSummary = ({ ocr, detailed = false, claimedAmount, referenceNumber }) => {
  if (!ocr) return null;
  const flags = ocr.flags || [];
  const failed = ocr.status === "failed";
  return (
    <section className="mt-5 rounded-xl border border-gray-100 bg-gray-50/60 p-4" aria-label="Receipt check">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-800">Receipt check</h3>
        {detailed && !failed && (
          <span className="text-[11px] text-gray-400">
            Read quality {ocr.confidence ?? "—"}% · {ocr.passes || 1} pass{(ocr.passes || 1) === 1 ? "" : "es"} · {((ocr.durationMs || 0) / 1000).toFixed(1)}s
          </span>
        )}
      </div>
      {failed ? (
        <p className="mt-2 text-sm text-gray-600">The receipt could not be read automatically. {detailed ? "Check it against the image." : "The cashier will check it manually."}</p>
      ) : (
        <div className="mt-1 divide-y divide-gray-100">
          <Row label="Amount" value={claimedAmount != null ? peso(claimedAmount) : null} status={ocr.amount?.status} />
          <Row label="Reference" value={referenceNumber || null} status={ocr.reference?.status} />
          {detailed && <Row label="Student ID on receipt" status={ocr.studentId?.status} />}
          {detailed && (
            <Row label="Receipt date" value={day(ocr.receiptDate)} />
          )}
          {detailed && ocr.detectedAmount?.status === "Detected" && (
            <Row label="Amount read by OCR" value={peso(ocr.detectedAmount.amount)} />
          )}
        </div>
      )}
      {!detailed && !failed && (
        <p className="mt-2 text-xs text-gray-500">This is an automatic check to speed up review. The cashier still confirms every payment.</p>
      )}
      {detailed && flags.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Warnings">
          {flags.map((flag) => (
            <li key={flag.code} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {flag.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ReceiptCheckSummary;
