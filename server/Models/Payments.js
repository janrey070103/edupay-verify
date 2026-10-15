const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    studentId: String,

    studentName: String,

    invoiceNumber: String,

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
