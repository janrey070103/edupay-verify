import Modal from "./Modal";
import StatusBadge from "./StatusBadge";

const datePH = (value) => value ? new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
}).format(new Date(value)) : "—";
const peso = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

export default function PaymentDetailsModal({ isOpen, onClose, payment }) {
  if (!payment) return null;
  const details = [
    ["Student full name", payment.studentName], ["Student ID", payment.studentId],
    ["Payment description", payment.paymentDescription],
    ["Actual amount paid", payment.status === "Approved" && payment.amount != null && Number.isFinite(Number(payment.amount))
      ? peso(payment.amount) : "Awaiting cashier verification"],
    ["Transaction date", datePH(payment.receiptDate || payment.createdAt)],
    ["Reference number", payment.invoiceNumber || "—"],
    ["Exam coverage", payment.examCoverage || "—"],
    ["Cashier verified at", datePH(payment.approvedAt)],
    ["Cashier ID", payment.approvedBy || "—"],
  ];
  return <Modal isOpen={isOpen} onClose={onClose} title="Payment Details">
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center"><StatusBadge status={payment.status} /></div>
      <dl className="divide-y divide-gray-100">{details.map(([label, value]) =>
        <div key={label} className="flex justify-between gap-4 py-2 text-sm"><dt className="text-gray-500">{label}</dt>
          <dd className="text-right font-semibold text-gray-800">{value || "—"}</dd></div>)}</dl>
      {payment.status === "Rejected" && payment.remarks && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><strong>Rejection remarks:</strong> {payment.remarks}</p>}
      <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-gray-200 px-4 text-sm font-bold">Close</button>
    </div>
  </Modal>;
}
