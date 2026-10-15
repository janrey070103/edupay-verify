const Tesseract = require("tesseract.js");

const extractText = async (imageUrl) => {
  const result = await Tesseract.recognize(imageUrl, "eng");
  return result.data.text;
};

// Only labelled transaction totals are candidates. Reference numbers and dates
// must never become a financial amount because they happen to contain digits.
const extractAmountDetails = (text) => {
  const lines = String(text || "").split(/\r?\n/);
  const candidates = [];
  const label = /\b(?:amount\s*paid|paid\s*amount|payment\s*amount|total\s*paid|grand\s*total|total\s*amount)\b/i;
  const value = /(?:PHP|P\.?H\.?P\.?|₱)?\s*([\d,]+\.\d{2})\b/i;
  for (const line of lines) {
    const match = line.match(label);
    if (!match) continue;
    const amountMatch = line.slice(match.index + match[0].length).match(value);
    if (!amountMatch) continue;
    const amount = Number(amountMatch[1].replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) candidates.push(amount);
  }
  const distinct = [...new Set(candidates)];
  return distinct.length === 1
    ? { amount: distinct[0], status: "Detected" }
    : { amount: null, status: "Needs Review" };
};

extractText.extractAmountDetails = extractAmountDetails;
extractText.extractAmount = (text) => extractAmountDetails(text).amount;
module.exports = extractText;
