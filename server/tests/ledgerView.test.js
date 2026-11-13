const test = require("node:test");
const assert = require("node:assert/strict");
const { buildLedgerView } = require("../controllers/eligibilityController");

const ledger = (overrides = {}) => ({ _id: "l1", studentId: "S1", totalTuition: 20000, paidAmount: 0,
  remainingBalance: 20000, prelim: false, midterm: false, preFinal: false, final: false, ...overrides });

test("a new student owes everything; the next progress payment is the Prelim share", () => {
  const view = buildLedgerView(ledger());
  assert.equal(view.paidAmount, 0);
  assert.equal(view.remainingBalance, 20000);
  assert.deepEqual(view.nextPayment, { term: "Prelim", amount: 5000 });
  assert.deepEqual(view.tentative, { amount: 0, count: 0, unreadCount: 0 });
});

test("receipts waiting for approval are tentative, capped at the balance; unreadable ones are counted", () => {
  const view = buildLedgerView(ledger({ paidAmount: 18000, remainingBalance: 2000, prelim: true, midterm: true, preFinal: true }),
    [{ amount: 1500 }, { amount: 1500 }, { amount: null }]);
  assert.equal(view.tentative.amount, 2000, "never more than what is still owed");
  assert.equal(view.tentative.count, 3);
  assert.equal(view.tentative.unreadCount, 1);
  assert.deepEqual(view.nextPayment, { term: "Final", amount: 2000 });
});

test("the next payment catches up to the term's even share", () => {
  // Paid 3,000 and cleared Prelim: Midterm target is 10,000 cumulative -> 7,000 due.
  const view = buildLedgerView(ledger({ paidAmount: 3000, remainingBalance: 17000, prelim: true }));
  assert.deepEqual(view.nextPayment, { term: "Midterm", amount: 7000 });
  assert.deepEqual(view.terms, { Prelim: true, Midterm: false, PreFinal: false, Final: false });
  assert.equal(view.prelim, true, "original flags kept for other pages");
});

test("a fully paid ledger has no next payment", () => {
  const view = buildLedgerView(ledger({ paidAmount: 20000, remainingBalance: 0, prelim: true, midterm: true, preFinal: true, final: true }));
  assert.equal(view.fullyPaid, true);
  assert.equal(view.nextPayment, null);
});

test("each exam term gets one eligibility status, most advanced first", () => {
  const { buildEligibility } = require("../controllers/eligibilityController");
  const terms = { Prelim: true, Midterm: true, PreFinal: false, Final: false };
  const result = buildEligibility(terms, {
    student: { semester: "1st Semester", schoolYear: "2026-2027" }, now: new Date("2026-09-10T04:00:00Z"), // Prelim month
    permits: [{ examType: "Prelim", permitStatus: "Valid" }],
    termPayments: [
      { examCoverage: "PreFinal", status: "Pending" },
      { examCoverage: "Final", status: "Rejected" },
    ],
    schedules: [{ examType: "Prelim", examDate: new Date("2026-10-20") }],
  });
  assert.deepEqual(result.map((row) => row.status), ["permit_ready", "opens_later", "pending", "rejected"]);
  assert.ok(result[0].examDate, "published date is included");

  const unpaid = buildEligibility({ Prelim: false, Midterm: false, PreFinal: false, Final: false },
    { schedules: [{ examType: "Prelim", examDate: new Date("2026-10-20") }],
      termPayments: [{ examCoverage: "Midterm", status: "Pending" }, { examCoverage: "Midterm", status: "Rejected" }] });
  assert.deepEqual(unpaid.map((row) => row.status), ["payment_due", "pending", "not_open", "not_open"],
    "a waiting receipt outranks an older rejection");

  const revoked = buildEligibility({ Prelim: true }, { student: { semester: "1st Semester", schoolYear: "2026-2027" },
    now: new Date("2026-09-10T04:00:00Z"), permits: [{ examType: "Prelim", permitStatus: "Revoked" }] });
  assert.equal(revoked[0].status, "revoked");
});

test("each term's QR is usable only in its own month", () => {
  const { termWindow, windowProblem, describeWindow } = require("../config/examWindows");
  const first = { semester: "1st Semester", schoolYear: "2026-2027" };
  const second = { semester: "2nd Semester", schoolYear: "2026-2027" };
  const day = (iso) => new Date(`${iso}T12:00:00+08:00`);

  // 1st semester months fall in the first year, 2nd semester months in the second.
  assert.equal(termWindow(first.semester, first.schoolYear, "Prelim").start.toISOString(), "2026-08-31T16:00:00.000Z"); // Sep 1, 00:00 PH
  assert.equal(termWindow(first.semester, first.schoolYear, "Final").end.toISOString(), "2026-12-31T15:59:59.999Z"); // Dec 31, 23:59:59.999 PH
  assert.equal(termWindow(second.semester, second.schoolYear, "Prelim").start.toISOString(), "2026-12-31T16:00:00.000Z"); // Jan 1, 2027 PH
  assert.equal(termWindow(second.semester, second.schoolYear, "Final").end.toISOString(), "2027-04-30T15:59:59.999Z");

  assert.equal(windowProblem(first, "Midterm", day("2026-10-31")), null, "last day of October is inside");
  assert.match(windowProblem(first, "Midterm", day("2026-09-30")), /can only be used from Oct 1, 2026/);
  assert.match(windowProblem(first, "Midterm", day("2026-11-01")), /ended on Oct 31, 2026/);
  // There is no Summer term: an old "Summer" value is treated as not set.
  assert.match(windowProblem({ semester: "Summer", schoolYear: "2026-2027" }, "Final", day("2027-06-01")), /semester and school year are not set/);
  assert.match(windowProblem({ semester: "", schoolYear: "" }, "Prelim"), /semester and school year are not set/);
  assert.equal(describeWindow(second, "PreFinal", day("2027-03-15")).state, "open");

  const { buildEligibility } = require("../controllers/eligibilityController");
  const paid = { Prelim: true, Midterm: true, PreFinal: true, Final: false };
  const rows = buildEligibility(paid, { student: first, now: day("2026-10-10"),
    permits: [{ examType: "Prelim", permitStatus: "Valid" }, { examType: "Midterm", permitStatus: "Valid" }] });
  assert.deepEqual(rows.map((row) => row.status), ["period_ended", "permit_ready", "opens_later", "not_open"]);
  assert.equal(rows[2].window.state, "upcoming");
});
