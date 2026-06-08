const mongoose =
require("mongoose");

const ledgerSchema =
new mongoose.Schema({

  studentId: String,

  totalTuition: {
    type: Number,
    default: 20000,
  },

  paidAmount: {
    type: Number,
    default: 0,
  },

  remainingBalance: {
    type: Number,
    default: 20000,
  },

  fullyPaid: {
    type: Boolean,
    default: false,
  },

  prelim: {
    type: Boolean,
    default: false,
  },

  midterm: {
    type: Boolean,
    default: false,
  },

  preFinal: {
    type: Boolean,
    default: false,
  },

  final: {
    type: Boolean,
    default: false,
  },

});

module.exports =
mongoose.model(
  "Ledger",
  ledgerSchema
);