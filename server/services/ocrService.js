// Compatibility wrapper. Receipt reading now lives in services/ocr/
// (ocrEngine: shared Tesseract worker, imagePrep: photo preparation,
// receiptParser: field rules, receiptAnalyzer: confirm what the student typed).
const { recognize } = require("./ocr/ocrEngine");
const { extractAmountDetails } = require("./ocr/receiptParser");

const extractText = async (image) => (await recognize(image)).text;

extractText.extractAmountDetails = extractAmountDetails;
extractText.extractAmount = (text) => extractAmountDetails(text).amount;
module.exports = extractText;
