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

module.exports =
extractText;