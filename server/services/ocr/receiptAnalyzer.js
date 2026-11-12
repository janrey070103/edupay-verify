const parser = require("./receiptParser");
const engine = require("./ocrEngine");
const prep = require("./imagePrep");

const OVERALL_TIMEOUT_MS = 30000;
const DAY = 24 * 60 * 60 * 1000;
const CHANNEL_NAMES = { palawan: "Palawan Express", mlhuillier: "M Lhuillier", online: "an online payment (GCash / Maya / bank app)", bank: "a bank" };
const peso = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
const phDate = (date) => date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
const POINTS = { matched: 2, partial: 1, not_found: 0 };

/** How well one OCR pass supports what the student typed. */
const evaluate = (text, claims) => {
  const amount = parser.confirmAmount(text, claims.amount);
  const reference = parser.confirmReference(text, claims.reference);
  const studentId = parser.confirmStudentId(text, claims.studentId);
  return { amount, reference, studentId, score: POINTS[amount.status] + POINTS[reference.status] + POINTS[studentId.status] };
};

/**
 * Warnings for the cashier. Never blocks an upload; each flag explains itself.
 * `context.now` and `context.schoolYear` make date checks testable.
 */
const buildFlags = (text, result, claims, context = {}) => {
  const flags = [];
  const now = context.now || new Date();
  const add = (code, message, severity = "warning") => flags.push({ code, message, severity });

  if (result.confidence < 40 && result.amount.status === "not_found" && result.reference.status === "not_found") {
    add("hard_to_read", "The receipt image is hard to read. Check the amount and reference against the picture.");
  }

  const hints = parser.channelHints(text);
  if (claims.channel && hints.length && !hints.includes(claims.channel)) {
    add("channel_mismatch", `Student chose ${CHANNEL_NAMES[claims.channel] || claims.channel}, but the receipt looks like ${CHANNEL_NAMES[hints[0]] || hints[0]}.`);
  }

  const date = result.receiptDate ? new Date(result.receiptDate) : null;
  if (date) {
    const firstYear = Number(String(context.schoolYear || "").slice(0, 4));
    const schoolYearStart = firstYear ? new Date(Date.UTC(firstYear, 5, 1)) : null; // June 1
    if (date.getTime() > now.getTime() + DAY) add("future_date", `Receipt is dated ${phDate(date)}, which is in the future.`);
    else if ((schoolYearStart && date < schoolYearStart) || now.getTime() - date.getTime() > 365 * DAY) {
      add("old_receipt", `Receipt is dated ${phDate(date)}, before the student's current school year.`);
    }
  }

  const claimed = Number(claims.amount);
  const amounts = parser.parseAmounts(text);
  const fees = amounts.filter((item) => item.fee).map((item) => item.value);
  const sameAs = (a, b) => Math.abs(a - b) < 0.5;
  // Typed the total (amount + service fee) instead of the amount sent?
  const feeIncluded = fees.find((fee) => amounts.some((item) => !item.fee && sameAs(item.value, claimed - fee)));
  if (feeIncluded) {
    add("includes_fee", `${peso(claimed)} looks like the total including a ${peso(feeIncluded)} service fee. The amount sent may be ${peso(claimed - feeIncluded)}.`);
  } else if (result.detectedAmount.status === "Detected" && !sameAs(result.detectedAmount.amount, claimed) &&
      result.amount.status !== "matched") {
    add("amount_differs", `Student typed ${peso(claimed)}, but the receipt seems to show ${peso(result.detectedAmount.amount)}.`);
  }
  return flags;
};

const withTimeout = (promise, ms) => Promise.race([
  promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Receipt reading timed out")), ms)),
]);

/**
 * Read a receipt and compare it with what the student typed.
 * claims: { amount, reference, studentId, channel }, context: { schoolYear, now }.
 * Returns only extracted fields and scores - never the full receipt text.
 */
const analyzeReceipt = async (url, claims, context = {}) => {
  const started = Date.now();
  try {
    return await withTimeout((async () => {
      const original = await prep.downloadImage(url);
      const passes = [];
      const runPass = async (name, image, psm) => {
        const ocr = await engine.recognize(image, psm);
        const evaluation = evaluate(ocr.text, claims);
        const pass = { name, text: ocr.text, confidence: ocr.confidence, ...evaluation };
        passes.push(pass);
        return pass;
      };

      const first = await runPass("standard", await prep.standardImage(original), "3");
      // Photos of dot-matrix forms read poorly as-is: try ink isolation when
      // the first pass is unsure about the amount or barely legible.
      if (first.confidence < 60 || first.amount.status !== "matched") {
        // Two layout readings of the same cleaned image: block layout (6)
        // and single column (4) pick up different lines on remittance forms.
        const ink = await prep.inkIsolatedImage(original);
        const second = await runPass("ink", ink, "6");
        const dateSoFar = parser.parseDates(passes.map((pass) => pass.text).join("\n")).length > 0;
        if (second.amount.status !== "matched" || !dateSoFar) await runPass("ink-column", ink, "4");
      }
      const best = passes.reduce((a, b) => (b.score > a.score || (b.score === a.score && b.confidence > a.confidence) ? b : a));
      // Each pass catches different fragments: confirm fields against all of them.
      const allText = passes.map((pass) => pass.text).join("\n");
      const combined = evaluate(allText, claims);
      const pick = (field) => (POINTS[combined[field].status] > POINTS[best[field].status] ? combined[field] : best[field]);
      const dates = parser.parseDates(best.text).concat(parser.parseDates(allText));

      const result = {
        status: "read",
        engine: "tesseract",
        pass: best.name,
        passes: passes.length,
        confidence: best.confidence,
        amount: pick("amount"),
        reference: pick("reference"),
        studentId: pick("studentId"),
        detectedAmount: parser.extractAmountDetails(best.text),
        referencesFound: parser.parseReferences(allText).map((ref) => ref.value).slice(0, 3),
        receiptDate: dates[0] ? dates[0].toISOString() : null,
        channelHints: parser.channelHints(allText),
        durationMs: Date.now() - started,
      };
      result.flags = buildFlags(allText, result, claims, context);
      return result;
    })(), OVERALL_TIMEOUT_MS);
  } catch (error) {
    return {
      status: "failed", engine: "tesseract", error: error.message, durationMs: Date.now() - started,
      amount: { status: "not_found", score: 0 }, reference: { status: "not_found", score: 0 },
      studentId: { status: "not_found", score: 0 }, detectedAmount: { amount: null, status: "Needs Review" },
      flags: [{ code: "not_read", severity: "warning", message: "The receipt could not be read automatically. Check it manually." }],
    };
  }
};

module.exports = { analyzeReceipt, buildFlags, evaluate };
