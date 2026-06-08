const statusStyles = {
  Pending: "bg-sti-gold/10 text-sti-blue",
  Approved: "bg-blue-50 text-sti-blue border border-blue-100",
  Rejected: "bg-red-50 text-red-700",
  "Need Review": "bg-sti-gold/20 text-sti-blue",
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${statusStyles[status] ?? "bg-gray-100 text-gray-600"}`}
  >
    {status ?? "Unknown"}
  </span>
);

export default StatusBadge;
