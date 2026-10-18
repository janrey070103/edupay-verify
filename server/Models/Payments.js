const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    studentId: String,

    studentName: String,

    invoiceNumber: String,
    invoiceKey: String,

    amount: Number,
    amountStatus: {
      type: String,
      enum: ["Detected", "Needs Review", "Confirmed by Cashier"],
      default: "Needs Review",
    },

    paymentDescription: String,

    paymentType: {
      type: String,
      enum: ["Term", "Full Tuition"],
      default: "Term",
    },

    semester: String,
    schoolYear: String,

    receiptDate: Date,

    receiptImage: String,
    receiptHash: String,

    validation: {
      duplicate: { type: Boolean, default: false },
      repeatedTerm: { type: Boolean, default: false },
      amountMismatch: { type: Boolean, default: false },
      expectedAmount: Number,
      remainingBalance: Number,
      duplicateOf: String,
      reviewReasons: [String],
      checkedAt: Date,
    },

    ocr: {
      status: {
        type: String,
        enum: ["Completed", "Failed"],
      },
      rawText: String,
      confidence: Number,
      amountCandidates: [{
        value: Number,
        label: String,
        raw: String,
        confidence: Number,
      }],
      fields: {
        invoiceNumber: String,
        studentId: String,
        dateText: String,
      },
      reviewReason: String,
      engineVersion: String,
      processedAt: Date,
      error: String,
    },

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

module.exports =
  mongoose.model("Payment", paymentSchema);
