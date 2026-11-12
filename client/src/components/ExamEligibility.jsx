import { Link } from "react-router-dom";
import {
  IconTicket,
  IconCheckCircle,
  IconClock,
  IconXCircle,
  IconLock,
  IconAlertCircle,
  IconShieldX,
} from "./icons/Icons";
import { opensOn, windowRange } from "../utils/examWindowText";

const TERM_META = {
  Prelim: { label: "Prelim", Icon: FlagIcon },
  Midterm: { label: "Midterm", Icon: HalfCircleIcon },
  PreFinal: { label: "Pre-finals", Icon: TargetIcon },
  Final: { label: "Finals", Icon: TrophyIcon },
};

// Every status pairs a colour with an icon and a label, so it never relies on colour alone.
const STATUS = {
  permit_ready: { label: "Permit ready", Icon: IconTicket, chip: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200", link: "/permit" },
  approved: { label: "Approved", Icon: IconCheckCircle, chip: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200", link: "/permit" },
  pending: { label: "Pending", Icon: IconClock, chip: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200", link: "/history" },
  rejected: { label: "Rejected", Icon: IconXCircle, chip: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200", link: "/history" },
  revoked: { label: "Permit revoked", Icon: IconShieldX, chip: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200", link: "/permit" },
  payment_due: { label: "Payment due", Icon: IconAlertCircle, chip: "bg-white text-red-700 ring-1 ring-inset ring-red-300", link: "/upload" },
  not_open: { label: "Not yet open", Icon: IconLock, chip: "text-gray-500", link: null },
  // Paid, but outside the term's QR month.
  opens_later: { label: "Paid · opens later", Icon: IconClock, chip: "bg-blue-50 text-sti-blue ring-1 ring-inset ring-blue-200", link: "/permit" },
  period_ended: { label: "Period ended", Icon: IconLock, chip: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200", link: null },
  semester_missing: { label: "Ask Admin", Icon: IconAlertCircle, chip: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200", link: null },
};
const HINT = {
  permit_ready: "Open your exam permit",
  approved: "Generate your exam permit",
  pending: "Receipt waiting for the cashier",
  rejected: "See why and upload again",
  revoked: "Contact the cashier",
  payment_due: "Upload your receipt",
  opens_later: "Your QR can be generated once the period starts",
  semester_missing: "Your semester and school year are not set",
};

const examDay = (value) => (value ? new Date(value).toLocaleDateString("en-PH", {
  timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" }) : null);

const StatusChip = ({ status, compact = false, window }) => {
  const base = STATUS[status] || STATUS.not_open;
  // "Opens Aug 1" is more useful than a generic label when the date is known.
  const meta = status === "opens_later" && window?.start ? { ...base, label: `Opens ${opensOn(window)}` } : base;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md font-bold ${compact
      ? "gap-1 px-1.5 py-0.5 text-[11px]" : "gap-1.5 px-2.5 py-1 text-xs"} ${meta.chip}`}>
      <meta.Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {meta.label}
    </span>
  );
};

/** Per-term exam eligibility: one row per term with a live status badge. */
const ExamEligibility = ({ rows = [] }) => {
  const present = [...new Set(rows.map((row) => row.status))];
  return (
    <section aria-labelledby="exam-eligibility-title" className="overflow-hidden rounded-xl border border-gray-100">
      <h3 id="exam-eligibility-title" className="border-b border-gray-100 bg-gray-50/50 px-4 py-3 text-sm font-bold text-gray-800">
        Exam eligibility
      </h3>
      <ul className="divide-y divide-gray-100">
        {rows.map((row) => {
          const term = TERM_META[row.term] || { label: row.term, Icon: FlagIcon };
          const meta = STATUS[row.status] || STATUS.not_open;
          const date = examDay(row.examDate);
          const body = (
            <>
              <term.Icon className="h-5 w-5 shrink-0 text-gray-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-800">{term.label}</span>
                <span className="block truncate text-xs text-gray-400">
                  {date ? `Exam ${date}` : "Date not published"}
                </span>
                {windowRange(row.window) && (
                  <span className="block truncate text-[11px] text-gray-500">QR usable {windowRange(row.window)}</span>
                )}
              </span>
              <StatusChip status={row.status} window={row.window} />
            </>
          );
          return (
            <li key={row.term}>
              {meta.link ? (
                <Link to={meta.link} title={HINT[row.status]} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sti-blue/20"
                  aria-label={`${term.label}: ${meta.label}. ${HINT[row.status] || ""}`}>
                  {body}
                </Link>
              ) : (
                <div className="flex min-h-14 items-center gap-3 px-4 py-2.5" aria-label={`${term.label}: ${meta.label}`}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {present.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 bg-gray-50/40 px-4 py-2" aria-hidden="true">
          {Object.keys(STATUS).filter((key) => present.includes(key)).map((key) => <StatusChip key={key} status={key} compact />)}
        </div>
      )}
    </section>
  );
};

/* Term icons (line style, matching the app's icon set). */
function FlagIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 22V4" /><path d="M4 4h12l-2 4 2 4H4" />
    </svg>
  );
}
function HalfCircleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
function TargetIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
function TrophyIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 6h2a2 2 0 0 1 0 4h-2" /><path d="M7 6H5a2 2 0 0 0 0 4h2" />
    </svg>
  );
}

export default ExamEligibility;
