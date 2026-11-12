const path = require("path");
const Tesseract = require("tesseract.js");

// One long-lived Tesseract worker, created on first use. The English model is
// loaded from server/eng.traineddata, so OCR works offline and does not
// download anything at start-up. Jobs run one at a time (a single worker can
// only process one image), queued in arrival order.
const LANG_DIR = path.join(__dirname, "..", "..");

let workerPromise = null;
let queue = Promise.resolve();

const getWorker = () => {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker("eng", 1, {
      langPath: LANG_DIR, cachePath: LANG_DIR, gzip: false, cacheMethod: "readOnly",
    }).catch((error) => { workerPromise = null; throw error; });
  }
  return workerPromise;
};

/**
 * OCR one image (Buffer or URL). `psm` is Tesseract's page-segmentation mode:
 * "3" automatic layout (screenshots), "4" single column of mixed sizes
 * (remittance forms), "11" sparse text.
 */
const recognize = (image, psm = "3") => {
  const job = queue.then(async () => {
    const worker = await getWorker();
    await worker.setParameters({ tessedit_pageseg_mode: psm, user_defined_dpi: "300" });
    const { data } = await worker.recognize(image);
    return { text: data.text || "", confidence: Math.round(data.confidence || 0) };
  });
  queue = job.catch(() => {});
  return job;
};

/** Stop the worker (tests / shutdown). */
const shutdown = async () => {
  if (!workerPromise) return;
  const worker = await workerPromise.catch(() => null);
  workerPromise = null;
  if (worker) await worker.terminate();
};

module.exports = { recognize, shutdown };
