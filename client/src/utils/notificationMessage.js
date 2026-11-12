// Older approval notifications can contain a missing amount serialized as text.
// Keep their status and description visible without displaying a fictitious amount.
export const displayNotificationMessage = (message) => String(message || "")
  .replace(/\bpayment\s+of\s+₱(?:null|undefined|NaN)\b/gi, "payment");
