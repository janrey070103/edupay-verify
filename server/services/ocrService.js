const Tesseract =
require(
"tesseract.js"
);

const extractText =
async (imageUrl) => {

 const result =
 await Tesseract.recognize(
 imageUrl,
 "eng"
 );

 return result.data.text;

};

const extractAmount = (text) => {
 const normalizedText = text.replace(/[\r\n]+/g, " ");
 const amountPatterns = [
  /(?:AMOUNT\s*PAID|PAID\s*AMOUNT|PAYMENT\s*AMOUNT)\s*[:#-]?\s*(?:PHP|P\.?H\.?P\.?|₱|USD|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:TOTAL\s*AMOUNT\s*DUE|AMOUNT\s*DUE|TOTAL\s*PAID|GRAND\s*TOTAL|TOTAL\s*AMOUNT|TOTAL)\s*[:#-]?\s*(?:PHP|P\.?H\.?P\.?|₱|USD|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:AMOUNT|PAYABLE)\s*[:#-]?\s*(?:PHP|P\.?H\.?P\.?|₱|USD|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i,
 ];

 for (const amountPattern of amountPatterns) {
  const amountMatch = normalizedText.match(amountPattern);

  if (amountMatch) {
   const amount = Number(amountMatch[1].replace(/,/g, ""));

   if (Number.isFinite(amount)) {
	return amount;
   }
  }
 }

 return "";
};

extractText.extractAmount = extractAmount;

module.exports =
extractText;