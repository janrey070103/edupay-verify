import { PAYMENT_CHANNELS } from "../../utils/paymentChannels";

// Cashier filter: where the payment was made. "unspecified" = receipts
// uploaded before students were asked for a payment mode.
const PaidViaSelect = ({ value = "", onChange, className = "" }) => (
  <label className={`flex flex-col text-xs font-semibold text-gray-500 ${className}`}>
    Paid via
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 min-h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
    >
      <option value="">All payment modes</option>
      {PAYMENT_CHANNELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      <option value="direct">Cash at cashier (direct)</option>
      <option value="unspecified">Not specified (older receipts)</option>
    </select>
  </label>
);

export default PaidViaSelect;
