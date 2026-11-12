const sharp = require("sharp");

const MAX_BYTES = 15 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15000;

/**
 * Cloudinary URL to download for OCR. Tesseract cannot read PDFs, so a PDF
 * receipt is fetched as an image of its first page (Cloudinary converts it).
 */
const ocrSourceUrl = (url) => {
  const value = String(url || "");
  if (!/\.pdf(\?|$)/i.test(value)) return value;
  return value.replace("/upload/", "/upload/pg_1,f_jpg/").replace(/\.pdf(\?|$)/i, ".jpg$1");
};

/** Download the receipt image (bounded size and time). */
const downloadImage = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(ocrSourceUrl(url), { signal: controller.signal });
    if (!response.ok) throw new Error(`Receipt download failed (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) throw new Error("Receipt image too large for OCR");
    return buffer;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Standard pass for screenshots and clean scans: honour phone rotation,
 * bring the width into Tesseract's comfortable range, greyscale, stretch contrast.
 */
const standardImage = async (buffer) => {
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 1600;
  const target = width < 1200 ? 1600 : Math.min(width, 2000);
  return sharp(buffer).rotate().resize({ width: target }).grayscale().normalize()
    .withMetadata({ density: 300 }).png().toBuffer();
};

/**
 * Pass for photographed remittance forms (Palawan, M Lhuillier): the values are
 * dot-matrix print in purple/violet ink over blue pre-printed labels. Keep only
 * dark pixels whose green is close to red and below blue (the ink), drop blue
 * labels (green much higher than red), paper and the table behind the slip,
 * then blur slightly so the printer's dots join into solid strokes.
 * Calibrated on a real Palawan Express "Send Money Form" photo.
 */
const inkIsolatedImage = async (buffer) => {
  const { data, info } = await sharp(buffer).rotate().resize({ width: 2000 }).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const mask = Buffer.alloc(info.width * info.height);
  for (let i = 0, p = 0; i < data.length; i += 3, p += 1) {
    const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
    const ink = (r + g + b) / 3 < 160 && g - r < 35 && b > g + 8;
    mask[p] = ink ? 0 : 255;
  }
  return sharp(mask, { raw: { width: info.width, height: info.height, channels: 1 } })
    .blur(1.5).threshold(215).withMetadata({ density: 300 }).png().toBuffer();
};

module.exports = { ocrSourceUrl, downloadImage, standardImage, inkIsolatedImage };
