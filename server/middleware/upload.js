const multer =
require("multer");

const {
 CloudinaryStorage
} = require(
"multer-storage-cloudinary"
);

const cloudinary =
require(
"../config/cloudinary"
);

const storage =
new CloudinaryStorage({

 cloudinary,

 params: {

   folder:
   "edupay-receipts",

   allowed_formats: [
    "jpg",
    "png",
    "pdf",
   ],

 },

});

const upload =
multer({
 storage,
 limits: { fileSize: 10 * 1024 * 1024 },
 fileFilter: (_req, file, callback) => {
   const allowed = ["image/jpeg", "image/png", "application/pdf"];
   callback(allowed.includes(file.mimetype) ? null : new Error("Only JPG, PNG, and PDF receipts are allowed."), allowed.includes(file.mimetype));
 },
});

module.exports =
upload;
