// Pure text functions for reading payment receipts. No I/O here, so every
// rule is unit-tested with sample receipt layouts (tests/receiptParser.test.js).
//
// OCR is used to CONFIRM what the student typed (amount + reference), not to
// guess blindly: dot-matrix forms (Palawan, M Lhuillier) are misread too often
// for exact extraction, but close matches are still strong evidence.

// ---------- small helpers ----------

/** Levenshtein distance (iterative, two rows). */
const distance = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
};

/** 1 = identical, 0 = nothing in common. */
const similarity = (a, b) => {
  const longest = Math.max(a.length, b.length);
  return longest ? 1 - distance(a, b) / longest : 1;
};

// Characters OCR commonly confuses with digits (seen on real receipts:
// "§,227.0C" for "8,927.00", "ZECER8552" for "220989552").
const CONFUSABLE_DIGITS = { O: "0", Q: "0", D: "0", C: "0", U: "0", I: "1", L: "1", "|": "1", "!": "1",
  Z: "2", S: "5", "$": "5", "§": "8", B: "8", G: "6", T: "7" };

/** Canonical form for comparing references / IDs: uppercase, letters that look like digits become digits. */
const canonical = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9|!$§]/g, "")
  .replace(/./g, (ch) => CONFUSABLE_DIGITS[ch] || ch);

/** Uppercase letters and digits only (for exact reference keys). */
const referenceKey = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Best similarity of `needle` against any same-length window of `haystack`. */
const bestWindow = (haystack, needle) => {
  if (!needle) return 0;
  if (haystack.includes(needle)) return 1;
  let best = 0;
  for (let size = Math.max(1, needle.length - 1); size <= needle.length + 1; size += 1) {
    for (let i = 0; i + size <= haystack.length; i += 1) {
      best = Math.max(best, similarity(haystack.slice(i, i + size), needle));
      if (best === 1) return 1;
    }
  }
  return best;
};

// ---------- amounts ----------

const FEE_LINE = /\b(fee|charge|service|commission|balance|change|discount|rebate)\b/i;
const AMOUNT_TIERS = [
  { tier: 1, label: /\b(total\s*amount\s*paid|amount\s*paid|paid\s*amount|payment\s*amount|total\s*paid)\b/i },
  { tier: 2, label: /\b(grand\s*total|total\s*amount|total)\b/i },
  { tier: 3, label: /\b(amount\s*sent|principal|amount)\b/i },
];

/** Numbers that look like money in a piece of text (handles "₱5,000", "PHP 2,500.00", "P5,000"). */
const moneyValues = (text) => {
  const values = [];
  const pattern = /(?:PHP|P\.?H\.?P\.?|₱|\bP)?\s*(\d{1,3}(?:,\d{3})+|\d{1,7})(?:\.(\d{2}))?(?!\d)/gi;
  let match;
  while ((match = pattern.exec(text))) {
    const whole = Number(match[1].replace(/,/g, ""));
    const cents = match[2] ? Number(match[2]) / 100 : 0;
    const value = Math.round((whole + cents) * 100) / 100;
    // Long digit runs without separators are reference numbers, not money;
    // short bare numbers ("5", "30") are counts or times unless they have cents.
    if (!match[1].includes(",") && !match[2] && (match[1].length > 5 || match[1].length < 3)) continue;
    if (value > 0 && value <= 1000000) values.push(value);
  }
  return values;
};

/**
 * Labelled amounts on the receipt: [{ value, tier, fee, line }]. A label with no
 * number on its own line takes the number on the next line (e-wallet layouts).
 */
const parseAmounts = (text) => {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const found = [];
  lines.forEach((line, index) => {
    const tier = AMOUNT_TIERS.find(({ label }) => label.test(line));
    if (!tier) {
      // "Service Fee 30.00" style lines carry no amount label but must still be
      // known as fees (e.g. to explain total = amount + fee).
      const feeAt = line.search(FEE_LINE);
      if (feeAt !== -1) moneyValues(line.slice(feeAt)).forEach((value) => found.push({ value, tier: 4, fee: true, line }));
      return;
    }
    const fee = FEE_LINE.test(line);
    const afterLabel = line.slice(line.search(tier.label));
    let values = moneyValues(afterLabel.replace(tier.label, ""));
    if (!values.length && lines[index + 1] && !AMOUNT_TIERS.some(({ label }) => label.test(lines[index + 1]))) {
      values = moneyValues(lines[index + 1]);
    }
    values.forEach((value) => found.push({ value, tier: tier.tier, fee, line }));
  });
  return found;
};

/**
 * Best single amount when nothing was typed: the highest-priority labelled
 * amount, only if that priority level has exactly one value. Conflicting
 * values ("AMOUNT PAID 2,500 / TOTAL PAID 3,000") are never guessed.
 */
const extractAmountDetails = (text) => {
  const amounts = parseAmounts(text).filter((item) => !item.fee);
  for (const { tier } of AMOUNT_TIERS) {
    const distinct = [...new Set(amounts.filter((item) => item.tier === tier).map((item) => item.value))];
    if (distinct.length === 1) return { amount: distinct[0], status: "Detected" };
    if (distinct.length > 1) return { amount: null, status: "Needs Review" };
  }
  return { amount: null, status: "Needs Review" };
};

// ---------- amount in words ----------

const ONES = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE",
  "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
const TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
const underThousand = (n) => {
  const words = [];
  if (n >= 100) { words.push(ONES[Math.floor(n / 100)], "HUNDRED"); n %= 100; }
  if (n >= 20) { words.push(TENS[Math.floor(n / 10)]); n %= 10; }
  if (n > 0) words.push(ONES[n]);
  return words;
};
/** 8927 -> ["EIGHT","THOUSAND","NINE","HUNDRED","TWENTY","SEVEN"] (pesos only). */
const amountToWords = (amount) => {
  let n = Math.floor(Number(amount) || 0);
  if (n <= 0) return [];
  const words = [];
  if (n >= 1000000) { words.push(...underThousand(Math.floor(n / 1000000)), "MILLION"); n %= 1000000; }
  if (n >= 1000) { words.push(...underThousand(Math.floor(n / 1000)), "THOUSAND"); n %= 1000; }
  words.push(...underThousand(n));
  return words;
};

/** Share of the amount's words found in order in the text (tolerating OCR typos). */
const wordsMatchRatio = (text, amount) => {
  const target = amountToWords(amount);
  if (!target.length) return 0;
  const tokens = String(text || "").toUpperCase().split(/[^A-Z]+/).filter((word) => word.length >= 3);
  let position = 0;
  let hits = 0;
  for (const word of target) {
    for (let i = position; i < tokens.length && i < position + 6; i += 1) {
      if (similarity(tokens[i], word) >= 0.6) { hits += 1; position = i + 1; break; }
    }
  }
  return hits / target.length;
};

// ---------- confirming what the student typed ----------

/** Status from a 0..1 score. */
const statusFrom = (score, matched = 0.9, partial = 0.7) => (score >= matched ? "matched" : score >= partial ? "partial" : "not_found");

/**
 * Does the receipt show the amount the student typed? Checks figures (exact,
 * then OCR-tolerant digit comparison) and the amount written in words.
 */
const confirmAmount = (text, claimed) => {
  const value = Number(claimed);
  if (!Number.isFinite(value) || value <= 0) return { status: "not_found", score: 0 };
  if (parseAmounts(text).some((item) => Math.abs(item.value - value) < 0.005) || moneyValues(text).some((v) => Math.abs(v - value) < 0.005)) {
    return { status: "matched", score: 1, via: "figure" };
  }
  const target = canonical(value.toFixed(2).replace(".", ""));
  const tokens = String(text || "").split(/\s+/).map(canonical).filter((token) => token.length >= target.length - 2);
  const figure = tokens.reduce((best, token) => Math.max(best, bestWindow(token, target)), 0);
  const words = wordsMatchRatio(text, value);
  const score = Math.max(figure, words);
  // Two independent partial signals (figure + words) count as a match.
  if (figure >= 0.8 && words >= 0.5) return { status: "matched", score: Math.max(score, 0.9), via: "figure+words" };
  return { status: statusFrom(score, 0.95, 0.75), score: Math.round(score * 100) / 100, via: figure >= words ? "figure" : "words" };
};

/** Does the receipt show this reference / transaction code (OCR-tolerant)? */
const confirmReference = (text, reference) => {
  const target = canonical(reference);
  if (target.length < 4) return { status: "not_found", score: 0 };
  const score = bestWindow(canonical(text), target);
  return { status: statusFrom(score, 0.9, 0.7), score: Math.round(score * 100) / 100 };
};

/**
 * Does the receipt show the student's ID (e.g. "220989552" for 22-0989-552)?
 * Long IDs use a lower "partial" bar: dot-matrix print turns 220989552 into
 * "ZECER8552" (~0.56), while an unrelated number scores about 0.3.
 */
const confirmStudentId = (text, studentId) => {
  const target = canonical(studentId);
  if (target.length < 6) return { status: "not_found", score: 0 };
  const score = bestWindow(canonical(text), target);
  return { status: statusFrom(score, 0.9, target.length >= 9 ? 0.55 : 0.7), score: Math.round(score * 100) / 100 };
};

// ---------- references found on the receipt ----------

const REFERENCE_LABEL = /\b(ref(?:erence)?\.?\s*(?:no\.?|number|#)?|transaction\s*(?:no\.?|code|number)(?:\s*\/\s*reference)?|control\s*(?:no\.?|number)|kptn|trace\s*no\.?|receipt\s*no\.?|o\.?r\.?\s*no\.?|invoice\s*no\.?)\s*[:#.]?\s*([A-Z0-9][A-Z0-9-]{3,30}(?:[ \t][A-Z0-9]{1,8}){0,3})/gi;

/** Reference-like values printed next to a known label. */
const parseReferences = (text) => {
  const refs = [];
  let match;
  REFERENCE_LABEL.lastIndex = 0;
  while ((match = REFERENCE_LABEL.exec(String(text || "")))) {
    const value = match[2].trim();
    if (/\d/.test(value)) refs.push({ label: match[1].replace(/\s+/g, " ").trim(), value });
  }
  return refs;
};

// ---------- dates ----------

const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const manilaDate = (year, month, day) => {
  const date = new Date(Date.UTC(year, month, day, 4)); // noon in Manila, safe from timezone shifts
  return date.getUTCMonth() === month && date.getUTCDate() === day ? date : null;
};

/**
 * Dates on the receipt. Numeric dates are read as MM/DD/YYYY (the format on
 * Philippine remittance forms, e.g. Palawan "06/01/2025" = June 1, 2025).
 */
const parseDates = (text) => {
  const source = String(text || "");
  const found = [];
  const push = (date) => { if (date && date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= 2100) found.push(date); };
  let m;
  const iso = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g;
  while ((m = iso.exec(source))) push(manilaDate(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const us = /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/g;
  while ((m = us.exec(source))) push(manilaDate(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
  const named = /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/gi;
  while ((m = named.exec(source))) push(manilaDate(Number(m[3]), MONTHS[m[1].toUpperCase()], Number(m[2])));
  const dayFirst = /\b(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?,?\s+(20\d{2})\b/gi;
  while ((m = dayFirst.exec(source))) push(manilaDate(Number(m[3]), MONTHS[m[2].toUpperCase()], Number(m[1])));
  return found;
};

// ---------- payment mode hints ----------

const CHANNEL_HINTS = [
  { channel: "palawan", pattern: /palawan|pera\s*padala/i },
  { channel: "mlhuillier", pattern: /lhuillier|kwarta\s*padala|\bkptn\b/i },
  { channel: "online", pattern: /gcash|g-cash|\bmaya\b|paymaya|instapay|pesonet|e-?wallet/i },
  { channel: "bank", pattern: /\b(bdo|bpi|landbank|metrobank|security\s*bank|unionbank|pnb|chinabank|rcbc|eastwest|deposit\s*slip)\b/i },
];

/** Payment modes the receipt text mentions (e.g. ["palawan"]). */
const channelHints = (text) => CHANNEL_HINTS.filter(({ pattern }) => pattern.test(String(text || ""))).map(({ channel }) => channel);

module.exports = {
  similarity, canonical, referenceKey,
  moneyValues, parseAmounts, extractAmountDetails,
  amountToWords, wordsMatchRatio,
  confirmAmount, confirmReference, confirmStudentId,
  parseReferences, parseDates, channelHints,
};
