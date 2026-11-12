const mongoose = require("mongoose");
const { CHANNEL_KEYS } = require("../config/paymentChannels");

const paymentSchema = new mongoose.Schema(
  {
    studentId: String,

    studentName: String,

    invoiceNumber: String,

    // What the student typed when uploading (receipt uploads only).
    claimedAmount: { type: Number, required: false },
    referenceNumber: { type: String, required: false, trim: true },
    // Letters and digits only, for duplicate-receipt checks ("ABM-20-72278-VPN" -> "ABM2072278VPN").
    referenceKey: { type: String, required: false },

    // Automatic receipt check (extracted fields and scores only, never the full
    // receipt text): per-field match status, detected amount/date, flags for the cashier.
    ocr: { type: mongoose.Schema.Types.Mixed, required: false },
    // The OCR's own amount reading, kept even after the cashier confirms the real amount.
    ocrAmount: { type: Number, required: false },

    amount: Number,
    amountStatus: {
      type: String,
      enum: ["Detected", "Needs Review", "Confirmed by Cashier"],
      default: "Needs Review",
    },

    paymentDescription: String,

    receiptDate: Date,

    receiptImage: String,

    examCoverage: {
      type: String,
      enum: [
        "Prelim",
        "Midterm",
        "PreFinal",
        "Final",
      ],
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "Approved",
        "Rejected",
        "Need Review",
        "Direct Payment",
      ],
      default: "Pending",
    },

    remarks: {
      type: String,
      required: false,
    },

    rejectionReason: {
      type: String,
      enum: [
        "blurry",
        "incomplete",
        "invalid",
        "duplicate",
        "other",
      ],
      required: false,
    },

    paymentMethod: {
      type: String,
      enum: ["receipt", "direct"],
      default: "receipt",
    },

    // "Term" pays for one exam term; "Full Tuition" pays the whole remaining
    // balance (approved in full, it clears all four terms at once).
    paymentType: {
      type: String,
      enum: ["Term", "Full Tuition"],
      default: "Term",
    },

    // Where the student paid (receipt uploads only): palawan / online / bank.
    paymentChannel: {
      type: String,
      enum: CHANNEL_KEYS,
      required: false,
    },

    approvedBy: {
      type: String,
      required: false,
    },

    approvedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// List/filter indexes: every payment listing sorts by createdAt and may filter
// by status, coverage term, or student.
paymentSchema.index({ createdAt: -1, _id: -1 });
paymentSchema.index({ status: 1, createdAt: -1, _id: -1 });
paymentSchema.index({ studentId: 1, createdAt: -1, _id: -1 });
// Duplicate-receipt lookups by reference number.
paymentSchema.index({ referenceKey: 1 }, { sparse: true });

module.exports =
  mongoose.model("Payment", paymentSchema);
