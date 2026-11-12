// How a student paid before uploading the receipt. Keep in sync with
// server/config/paymentChannels.js (the server validates the key).
export const PAYMENT_CHANNELS = [
  { value: "palawan", label: "Palawan Express", short: "Palawan", hint: "Pera Padala branch payment" },
  { value: "mlhuillier", label: "M Lhuillier", short: "M Lhuillier", hint: "Kwarta Padala branch payment" },
  { value: "online", label: "Online (GCash / Maya / online banking)", short: "Online", hint: "E-wallet or app transfer" },
  { value: "bank", label: "Bank deposit / transfer", short: "Bank", hint: "Over-the-counter deposit or bank transfer" },
];

export const channelLabel = (value) => PAYMENT_CHANNELS.find((item) => item.value === value)?.label || "—";

/** Short form for table cells: Palawan / Online / Bank. */
export const channelShort = (value) => PAYMENT_CHANNELS.find((item) => item.value === value)?.short || "—";

/** "Palawan 2 · Online 1" from { palawan: 2, online: 1 }; older receipts count as "Not specified". */
export const channelBreakdown = (counts = {}) => [
  ...PAYMENT_CHANNELS.map((item) => [item.short, counts[item.value]]),
  ["Not specified", counts.unspecified],
].filter(([, count]) => count > 0).map(([label, count]) => `${label} ${count}`).join(" · ");

// Where the reference number is printed on each kind of receipt (Upload Receipt form).
const REFERENCE_HINTS = {
  palawan: { label: "Transaction code", placeholder: "e.g. ABM-20-72278-VPN", hint: "Printed at the top of the Send Money Form, beside \"Transaction Code\"." },
  mlhuillier: { label: "KPTN (Kwarta Padala transaction number)", placeholder: "e.g. KPTN number on your receipt", hint: "The KPTN printed on your M Lhuillier receipt." },
  online: { label: "Reference number", placeholder: "e.g. 1023 456 789012", hint: "The \"Ref No.\" shown on your GCash / Maya / bank app receipt." },
  bank: { label: "Reference / transaction number", placeholder: "e.g. deposit slip or transfer reference", hint: "Printed on the validated deposit slip or transfer confirmation." },
};
export const referenceHint = (value) => REFERENCE_HINTS[value]
  || { label: "Reference number", placeholder: "Reference or transaction number", hint: "The reference or transaction number printed on your receipt." };
