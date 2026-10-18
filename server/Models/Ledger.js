const mongoose =
require("mongoose");

const ledgerSchema =
new mongoose.Schema({

  studentId: String,

  totalTuition: {
    type: Number,
    min: 0,
    default: null,
  },

  tuitionConfigured: {
    type: Boolean,
    default: false,
  },

  paidAmount: {
    type: Number,
    default: 0,
  },

  remainingBalance: {
    type: Number,
    min: 0,
    default: null,
  },

  termTuition: {
    prelim: { type: Number, min: 0 },
    midterm: { type: Number, min: 0 },
    preFinal: { type: Number, min: 0 },
    final: { type: Number, min: 0 },
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
ledgerSchema.index({ studentId: 1 }, { unique: true, name: "uniq_ledger_student_id",
  partialFilterExpression: { studentId: { $type: "string" } } });

module.exports =
mongoose.model(
  "Ledger",
  ledgerSchema
);
