const extractText =
require("../services/ocrService");

const Payment =
  require("../Models/Payments");

  const Notification =
require(
"../Models/Notification"
);

  const Ledger =
require("../Models/Ledger");

const createPayment =
async (req, res) => {

  try {

    const text =
        await extractText(
        req.file.path
        );

       


console.log(text);

const invoiceMatch =
text.match(
/INVOICE\s*NO[: ]+(\d+)/i
);

const invoiceNumber =
invoiceMatch
? invoiceMatch[1]
: "";

console.log(
  "Invoice:",
  invoiceNumber
);

const studentMatch =
text.match(
/STUDENT\s*ID[: ]+([0-9\-]+)/i
);

const studentId =
studentMatch
? studentMatch[1]
: (req.body.studentId || "");

console.log(
  "Student:",
  studentId
);

const amountMatch =
text.match(
/AMOUNT[: ]+([\d,.]+)/i
);

const amount =
amountMatch
? amountMatch[1]
: "";

console.log(
  "Amount:",
  amount
);

const dateMatch =
text.match(
/DATE[: ]+([0-9\/\-]+)/i
);

const paymentDate =
dateMatch
? dateMatch[1]
: "";

console.log(
  "Date:",
  paymentDate
);


    const payment =
await Payment.create({

  studentId:
  studentId,

  studentName:
  req.body.studentName,

  invoiceNumber:
  invoiceNumber,

  amount:
  amount,

  paymentDescription:
  req.body.paymentDescription,

  receiptImage:
  req.file.path,

  paymentDate:
  paymentDate,

  status:
  "Pending",

});
    res.status(201).json(
      payment
    );

  } catch (error) {

    res.status(500).json({
      message:
      error.message,
    });

  }

};
const getPayments =
  async (req, res) => {
    try {

      const payments =
        await Payment.find();

      res.json(payments);

    } catch (error) {

      res.status(500).json({
        message:
          error.message,
      });

    }
  };

  const approvePayment =
async (req, res) => {

  try {

    const payment =
      await Payment.findById(
        req.params.id
      );

    payment.status =
      "Approved";

    await Notification.create({
      studentId: payment.studentId,
      title: "Payment Approved",
      message: "Your payment has been approved.",
    });

    await payment.save();

    let ledger =
      await Ledger.findOne({
        studentId:
        payment.studentId,
      });

    if (!ledger) {

      ledger =
      await Ledger.create({
        studentId:
        payment.studentId,
      });

    }

    ledger.paidAmount +=
      Number(payment.amount) || 0;

    ledger.remainingBalance =
      ledger.totalTuition -
      ledger.paidAmount;

    if (
      ledger.remainingBalance <= 0
    ) {

      ledger.fullyPaid =
      true;

      ledger.prelim = true;
      ledger.midterm = true;
      ledger.preFinal = true;
      ledger.final = true;

    }

    await ledger.save();

    res.json({
      message:
      "Approved",
    });

  } catch (error) {

    res.status(500).json({
      message:
      error.message,
    });

  }
};

const rejectPayment =
async (req, res) => {

  try {

    const payment =
      await Payment.findById(
        req.params.id
      );

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found",
      });
    }

    payment.status = "Rejected";

    await Notification.create({
      studentId: payment.studentId,
      title: "Payment Rejected",
      message: "Please upload a clearer receipt.",
    });

    await payment.save();

    res.json({
      message: "Rejected",
    });

  } catch (error) {

    res.status(500).json({
      message: error.message,
    });

  }

};

module.exports = {
  createPayment,
  getPayments,
  approvePayment,
  rejectPayment,
};