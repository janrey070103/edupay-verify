const Tesseract = require("tesseract.js");

const OCR_ENGINE_VERSION = "tesseract.js@7.0.0/eng";
const OCR_CONFIDENCE_THRESHOLD = 55;
const OCR_PAGE_MODES = ["6", "11"];
const OCR_TRANSFORM = "f_jpg,w_2400,c_limit,e_grayscale,e_contrast:80,e_sharpen:60";
const PDF_TRANSFORM = `pg_1,${OCR_TRANSFORM}`;

const addCloudinaryTransformation = (source, transformation) => {
  const marker = "/upload/";
  if (typeof source !== "string" || !source.includes(marker)) return source;
  return source.replace(marker, `${marker}${transformation}/`);
};

const isPdfSource = (source, mimeType) =>
  mimeType === "application/pdf" || /\.pdf(?:[?#]|$)/i.test(String(source || ""));

const getOcrSources = (source, mimeType) => {
  if (typeof source !== "string" || !source) return [];
  const pdf = isPdfSource(source, mimeType);
  const transformed = addCloudinaryTransformation(source, pdf ? PDF_TRANSFORM : OCR_TRANSFORM);

  // Keep the original as a fallback when the storage provider does not
  // support a requested transformation or PDF page option.
  return [...new Set([transformed, pdf ? source : null, source].filter(Boolean))];
};

const recognize = async (source, pageMode) => {
  const result = await Tesseract.recognize(source, "eng", {
    tessedit_pageseg_mode: pageMode,
    preserve_interword_spaces: "1",
  });
  return {
    text: result.data.text || "",
    confidence: Number.isFinite(Number(result.data.confidence)) ? Number(result.data.confidence) : null,
  };
};

const normalizeOcrText = (text) => String(text || "")
  .replace(/\u00a0/g, " ")
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  // Common OCR substitutions in labels. Apply these only to words so
  // transaction numbers are not silently modified before amount parsing.
  .replace(/\bAM0UNT\b/gi, "AMOUNT")
  .replace(/\bT0TAL\b/gi, "TOTAL")
  .replace(/\bPA1D\b/gi, "PAID")
  .replace(/\bINV0ICE\b/gi, "INVOICE")
  .replace(/\bN0\b/gi, "NO");

const amountLabel = /\b(?:amount\s*(?:paid|due|received)|paid\s*amount|payment\s*amount|total(?:\s+paid|\s+amount)?|grand\s+total|net\s+amount)\b/i;
const amountValue = /(?:PHP|P\s*H\s*P|₱|P)?\s*([0-9OISB][0-9OISB,.'\s]*[0-9OISB])\b/gi;
const standaloneAmountLine = /^\s*(?:(?:PHP|P\s*H\s*P|₱|P)\s*)?[0-9OISB][0-9OISB,.'\s]*[0-9OISB]\s*$/i;

const normalizeAmount = (raw) => {
  let value = String(raw || "")
    .replace(/[OQD]/gi, "0")
    .replace(/[Il]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/\s/g, "")
    .replace(/'/g, "");

  if (!value) return null;
  const commas = (value.match(/,/g) || []).length;
  const dots = (value.match(/\./g) || []).length;

  if (commas && dots) {
    const lastComma = value.lastIndexOf(",");
    const lastDot = value.lastIndexOf(".");
    const decimalIndex = lastComma > lastDot ? lastComma : lastDot;
    const fractional = value.slice(decimalIndex + 1);
    value = fractional.length === 2
      ? `${value.slice(0, decimalIndex).replace(/[,.]/g, "")}.${fractional}`
      : value.replace(/[,.]/g, "");
  } else if (commas) {
    const decimalIndex = value.lastIndexOf(",");
    const fractional = value.slice(decimalIndex + 1);
    value = fractional.length === 2
      ? `${value.slice(0, decimalIndex).replace(/,/g, "")}.${fractional}`
      : value.replace(/,/g, "");
  } else if (dots > 1) {
    value = value.replace(/\./g, "");
  } else if (dots === 1) {
    const fractional = value.slice(value.lastIndexOf(".") + 1);
    if (fractional.length !== 2) value = value.replace(/\./g, "");
  }

  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0 && amount < 100000000 ? amount : null;
};

const parseAmountCandidates = (segment, label) => {
  const values = [];
  for (const match of String(segment || "").matchAll(amountValue)) {
    const amount = normalizeAmount(match[1]);
    if (amount != null) values.push({ value: amount, label, raw: match[1] });
  }
  return values;
};

const extractAmountCandidates = (text) => {
  const lines = normalizeOcrText(text).split(/\r?\n/).map((line) => line.trim());
  const candidates = [];

  for (let index = 0; index < lines.length; index += 1) {
    const labelMatch = lines[index].match(amountLabel);
    if (!labelMatch) continue;
    const label = labelMatch[0].replace(/\s+/g, " ").trim();
    const sameLineValues = parseAmountCandidates(
      lines[index].slice(labelMatch.index + labelMatch[0].length),
      label
    );
    candidates.push(...sameLineValues);

    // Receipt labels and values are frequently separated by a line break.
    // Require the following line to be a standalone amount so dates and
    // reference numbers cannot become candidates.
    if (!sameLineValues.length && standaloneAmountLine.test(lines[index + 1] || "")) {
      candidates.push(...parseAmountCandidates(lines[index + 1], label));
    }
  }

  const unique = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.value}|${candidate.label}`;
    if (!unique.has(key)) unique.set(key, candidate);
  }
  return [...unique.values()];
};

const extractAmountDetails = (text, confidence) => {
  const candidates = extractAmountCandidates(text);
  const distinct = [...new Set(candidates.map((candidate) => candidate.value))];
  const lowConfidence = Number.isFinite(Number(confidence)) && Number(confidence) < OCR_CONFIDENCE_THRESHOLD;

  return distinct.length === 1 && !lowConfidence
    ? { amount: distinct[0], status: "Detected" }
    : { amount: null, status: "Needs Review" };
};

const extractFields = (text) => {
  const normalized = normalizeOcrText(text);
  const invoiceNumber = normalized.match(/\b(?:invoice|receipt|reference|transaction)\s*(?:no\.?|number|#)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{3,})\b/i)?.[1] || "";
  const studentId = normalized.match(/\b(?:student\s*(?:id|no\.?|number)|id)\s*[:#\-]?\s*([0-9][0-9\-]{4,})\b/i)?.[1] || "";
  const dateText = normalized.match(/\b(?:date|transaction\s*date|paid\s*on)\s*[:#\-]?\s*([0-9]{1,4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,4}|[A-Z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4})\b/i)?.[1] || "";
  return { invoiceNumber, studentId, dateText };
};

const buildReviewReason = ({ candidates, confidence }) => {
  const distinct = [...new Set(candidates.map((candidate) => candidate.value))];
  if (!distinct.length) return "No labelled payment amount detected.";
  if (distinct.length > 1) return "Conflicting payment amounts detected.";
  if (Number.isFinite(Number(confidence)) && Number(confidence) < OCR_CONFIDENCE_THRESHOLD) {
    return "OCR confidence is below the verification threshold.";
  }
  return "";
};

const buildStructuredResult = (runs) => {
  const validRuns = runs.filter((run) => run?.text?.trim());
  if (!validRuns.length) throw new Error("OCR could not read the receipt.");
  const rawText = validRuns.map((run) => run.text).join("\n--- OCR VARIANT ---\n");
  const confidenceValues = validRuns
    .map((run) => Number(run.confidence))
    .filter((value) => Number.isFinite(value));
  const confidence = confidenceValues.length
    ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
    : null;
  const amountCandidates = extractAmountCandidates(rawText).map((candidate) => ({
    ...candidate,
    confidence,
  }));

  return {
    text: rawText,
    confidence,
    ocr: {
      status: "Completed",
      rawText,
      confidence,
      amountCandidates,
      fields: extractFields(rawText),
      reviewReason: buildReviewReason({ candidates: amountCandidates, confidence }),
      engineVersion: OCR_ENGINE_VERSION,
      processedAt: new Date(),
    },
  };
};

const extractDetailed = async (source, options = {}) => {
  const sources = getOcrSources(source, options.mimeType);
  const runs = [];

  for (const candidate of sources) {
    for (const pageMode of OCR_PAGE_MODES) {
      try {
        runs.push({ ...await recognize(candidate, pageMode), source: candidate, pageMode });
      } catch {
        // Try the next source/layout. The caller will store a review case if
        // every OCR attempt fails.
      }
    }
  }

  return buildStructuredResult(runs);
};

// Keep the original text-returning function for existing callers while adding
// the structured result used when a payment is created.
const extractText = async (source, options = {}) => (await extractDetailed(source, options)).text;

extractText.extractDetailed = extractDetailed;
extractText.extractAmountCandidates = extractAmountCandidates;
extractText.extractAmountDetails = extractAmountDetails;
extractText.extractFields = extractFields;
extractText.buildStructuredResult = buildStructuredResult;
extractText.getOcrSources = getOcrSources;
extractText.OCR_ENGINE_VERSION = OCR_ENGINE_VERSION;
module.exports = extractText;
