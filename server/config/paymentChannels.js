// How a student paid before uploading the receipt (shown to the cashier).
// Keys are stored; labels are what people see. Keep in sync with
// client/src/utils/paymentChannels.js.
const PAYMENT_CHANNELS = {
  palawan: "Palawan Express",
  mlhuillier: "M Lhuillier",
  online: "Online (GCash / Maya / online banking)",
  bank: "Bank deposit / transfer",
};

const CHANNEL_KEYS_LIST = Object.keys(PAYMENT_CHANNELS);
module.exports = { PAYMENT_CHANNELS, CHANNEL_KEYS: CHANNEL_KEYS_LIST };

/**
 * Query filter for a "Paid via" choice: a payment-mode key, "direct" for
 * cashier-recorded payments, or "unspecified" for receipts uploaded before the
 * payment mode was asked. Anything else means no filter.
 */
const channelFilter = (value) => {
  if (CHANNEL_KEYS_LIST.includes(value)) return { paymentChannel: value };
  if (value === "direct") return { paymentMethod: "direct" };
  if (value === "unspecified") return { paymentMethod: { $ne: "direct" }, paymentChannel: { $in: [null] } };
  return {};
};

module.exports.channelFilter = channelFilter;
