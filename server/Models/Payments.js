const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    studentId: String,

    studentName: String,

    invoiceNumber: String,

    amount: Number,

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
      ],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model("Payment", paymentSchema);