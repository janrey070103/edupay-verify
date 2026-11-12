const Payment = require("../Models/Payments");
const Ledger = require("../Models/Ledger");
const { escapeRegex, paginate, readDateRange, readPaging, readSort } = require("../utils/pagination");
const { channelFilter } = require("../config/paymentChannels");

const STATUSES = ["Pending", "Approved", "Rejected", "Need Review", "Direct Payment"];

const readFilters = (query) => {
  const filter = {};
  const statuses = String(query.status || "")
    .split(",")
    .map((status) => status.trim())
    .filter((status) => STATUSES.includes(status));
  if (statuses.length) filter.status = { $in: statuses };
  const range = readDateRange(query);
  if (range) filter.createdAt = range;
  Object.assign(filter, channelFilter(query.channel));
  return filter;
};

// Paginated payment report. Status tabs and date range are applied on the
// server so paging never walks over a filtered subset in the browser.
const getPaymentsReport = async (req, res) => {
  try {
    const filter = readFilters(req.query);
    const studentId = String(req.query.studentId || "").trim().slice(0, 64);
    if (studentId) filter.studentId = new RegExp(`^${escapeRegex(studentId)}$`, "i");
    const paging = readPaging(req.query, { limit: 25 });
    const sort = readSort(req.query, ["createdAt", "amount", "studentName", "status"]);
    return res.json(await paginate(Payment, filter, paging, sort));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getReportSummary = async (req, res) => {
  try {
    const filter = readFilters({ from: req.query.from, to: req.query.to, channel: req.query.channel });
    const [grouped, approvedAmount, fullyPaid] = await Promise.all([
      Payment.aggregate([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Payment.aggregate([
        { $match: { ...filter, status: "Approved" } },
        { $group: { _id: null, sum: { $sum: "$amount" } } },
      ]),
      Ledger.countDocuments({ fullyPaid: true }),
    ]);
    const summary = {
      total: 0, pending: 0, approved: 0, rejected: 0, needReview: 0, directPayment: 0,
      approvedAmount: approvedAmount[0]?.sum || 0, fullyPaid,
    };
    const key = { Pending: "pending", Approved: "approved", Rejected: "rejected",
      "Need Review": "needReview", "Direct Payment": "directPayment" };
    grouped.forEach((row) => {
      if (key[row._id]) summary[key[row._id]] = row.count;
      summary.total += row.count;
    });
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { getPaymentsReport, getReportSummary };
