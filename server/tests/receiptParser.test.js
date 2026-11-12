const test = require("node:test");
const assert = require("node:assert/strict");
const p = require("../services/ocr/receiptParser");

// Real OCR output of a photographed Palawan Express "Send Money Form" after ink
// isolation (dot-matrix print). Names replaced; misreads kept exactly.
// Printed values: code ABM-20-72278-VPN, date 06/01/2025, receiver
// "220989552 VPN STI WEST NEGROS", amount 8,927.00 (EIGHT THOUSAND NINE
// HUNDRED TWENTY-SEVEN PESOS ONLY), fee 30.00, total 8,957.00.
const PALAWAN_OCR = `f—— FPRRL PADALA
Palawan Pavnshop Building. 170 Riza! Avonue, Punrto Princesa City 5300
Branch Tel Ho:
(NBME 722 TIVE | Deter
' : "= N 03:21:07
iiobiia Mo. JUAN DELA CRUZ Se CanlMo- J |
Nighile ive ZECER8552 VEN ITI WEST HEGRC
2TI BEET HNICROT DNIVERSIZY IHMC. -
Smang oo EIGET TACUSMID WINE HUNDRED
TERRACE FEI0E muro i §,227.0C
TLE 5,957, Ap | stig! that
30% PE IPRT URES KOPERPLENS B27] 06/01/2025 a3: i; <- E Vursion 6.00.22`;

// E-wallet screenshot layout (label and value on separate lines).
const EWALLET = `GCash
PAID
Sent via GCash
Amount
₱5,000.00
REF NO: 1023 456 789012
Date: Oct 09, 2026 3:15 PM
Successful transaction`;

// Official-receipt layout with a fee and a total.
const OFFICIAL = `Receipt No. A 2024-0012345 PAYMENT
Date : October 09, 2026 Payment Fee 15.00
OR No. : 0012345
TOTAL AMOUNT PAID 5,015.00
Amount 5,000.00`;

test("amounts: priority labels, next-line values, fees excluded", () => {
  const amounts = p.parseAmounts(OFFICIAL);
  assert.ok(amounts.some((a) => a.value === 5015 && a.tier === 1));
  assert.ok(amounts.some((a) => a.value === 5000 && a.tier === 3));
  assert.ok(amounts.some((a) => a.value === 15 && a.fee), "fee line recognised as a fee");
  assert.deepEqual(p.extractAmountDetails(OFFICIAL), { amount: 5015, status: "Detected" });
  assert.deepEqual(p.extractAmountDetails(EWALLET), { amount: 5000, status: "Detected" }, "value on the next line");
  assert.deepEqual(p.extractAmountDetails("Amount: ₱5,000"), { amount: 5000, status: "Detected" }, "no decimals needed");
  // Original safety rules still hold.
  assert.deepEqual(p.extractAmountDetails("REFERENCE 2500\nACCOUNT 123456"), { amount: null, status: "Needs Review" });
  assert.deepEqual(p.extractAmountDetails("AMOUNT PAID: 2,500.00\nTOTAL PAID: 3,000.00"), { amount: null, status: "Needs Review" });
  assert.deepEqual(p.moneyValues("REF 1023456789012"), [], "long reference numbers are not money");
});

test("amount in words", () => {
  assert.equal(p.amountToWords(8927).join(" "), "EIGHT THOUSAND NINE HUNDRED TWENTY SEVEN");
  assert.equal(p.amountToWords(20000).join(" "), "TWENTY THOUSAND");
  assert.equal(p.amountToWords(1500).join(" "), "ONE THOUSAND FIVE HUNDRED");
});

test("the typed amount is confirmed even when dot-matrix digits are misread", () => {
  const palawan = p.confirmAmount(PALAWAN_OCR, 8927);
  assert.notEqual(palawan.status, "not_found", "8,927.00 read as §,227.0C plus EIGET ... WINE HUNDRED");
  assert.equal(p.confirmAmount(EWALLET, 5000).status, "matched");
  assert.equal(p.confirmAmount(OFFICIAL, 5000).status, "matched");
  assert.equal(p.confirmAmount(EWALLET, 7350).status, "not_found", "a different amount is not confirmed");
});

test("references and student IDs are matched with OCR-tolerant comparison", () => {
  assert.equal(p.confirmReference(EWALLET, "1023456789012").status, "matched", "spaces ignored");
  assert.equal(p.confirmReference(OFFICIAL, "0012345").status, "matched");
  assert.equal(p.confirmReference(EWALLET, "9999999999").status, "not_found");
  assert.notEqual(p.confirmStudentId(PALAWAN_OCR, "22-0989-552").status, "not_found", "220989552 read as ZECER8552");
  assert.equal(p.confirmStudentId(EWALLET, "22-0989-552").status, "not_found");
  assert.equal(p.referenceKey(" abm-20-72278-vpn "), "ABM2072278VPN");
  assert.ok(p.parseReferences(EWALLET).some((r) => r.value.startsWith("1023")));
  assert.ok(p.parseReferences(OFFICIAL).some((r) => r.value === "0012345"));
});

test("dates: numeric MM/DD/YYYY, ISO and month names", () => {
  const iso = (d) => d.toISOString().slice(0, 10);
  assert.deepEqual(p.parseDates(PALAWAN_OCR).map(iso), ["2025-06-01"]);
  assert.deepEqual(p.parseDates(EWALLET).map(iso), ["2026-10-09"]);
  assert.deepEqual(p.parseDates(OFFICIAL).map(iso), ["2026-10-09"]);
  assert.deepEqual(p.parseDates("Date: 2026-11-03").map(iso), ["2026-11-03"]);
  assert.deepEqual(p.parseDates("13/45/2026").map(iso), [], "impossible dates ignored");
});

test("payment mode hints", () => {
  assert.deepEqual(p.channelHints(PALAWAN_OCR), ["palawan"]);
  assert.deepEqual(p.channelHints(EWALLET), ["online"]);
  assert.deepEqual(p.channelHints("M LHUILLIER KWARTA PADALA KPTN 123"), ["mlhuillier"]);
  assert.deepEqual(p.channelHints("BDO deposit slip"), ["bank"]);
});

test("cashier flags: old/future date, wrong payment mode, total typed instead of amount", () => {
  const { buildFlags } = require("../services/ocr/receiptAnalyzer");
  const now = new Date("2026-11-12T02:00:00Z");
  const base = { confidence: 70, amount: { status: "partial" }, reference: { status: "not_found" },
    detectedAmount: { amount: null, status: "Needs Review" } };
  const codes = (flags) => flags.map((f) => f.code);

  assert.deepEqual(codes(buildFlags(PALAWAN_OCR, { ...base, receiptDate: "2025-06-01T04:00:00Z" },
    { amount: 8927, channel: "palawan" }, { schoolYear: "2026-2027", now })), ["old_receipt"]);
  assert.deepEqual(codes(buildFlags(PALAWAN_OCR, { ...base, receiptDate: "2027-01-05T04:00:00Z" },
    { amount: 8927, channel: "palawan" }, { schoolYear: "2026-2027", now })), ["future_date"]);
  assert.deepEqual(codes(buildFlags(EWALLET, { ...base, receiptDate: "2026-10-09T04:00:00Z" },
    { amount: 5000, channel: "bank" }, { schoolYear: "2026-2027", now })), ["channel_mismatch"]);
  assert.deepEqual(codes(buildFlags(OFFICIAL, { ...base, receiptDate: null },
    { amount: 5015, channel: "online" }, { schoolYear: "2026-2027", now })), ["includes_fee"],
    "5,015 = 5,000 sent + 15 fee");
  assert.deepEqual(codes(buildFlags(EWALLET, { ...base, receiptDate: null, detectedAmount: { amount: 5000, status: "Detected" } },
    { amount: 7350, channel: "online" }, { now })), ["amount_differs"]);
  assert.deepEqual(codes(buildFlags("blurry", { ...base, confidence: 20, amount: { status: "not_found" }, receiptDate: null },
    { amount: 5000 }, { now })), ["hard_to_read"]);
});
