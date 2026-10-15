const jwt =
require("jsonwebtoken");
const User = require("../Models/User");

const protect =
async (req,res,next)=>{

 try{

   const token =
   req.headers.authorization;

   if(!token){

     return res
     .status(401)
     .json({
       message:"No Token"
     });

   }

   const decoded =
   jwt.verify(
    token.split(" ")[1],
    process.env.JWT_SECRET
   );

   const account = await User.findById(decoded.id).select("role isActive verificationStatus");
   if (!account || account.isActive === false || decoded.role !== account.role ||
       (account.role === "student" && account.verificationStatus !== "verified")) {
     return res.status(401).json({ message: "Account is not active or verified" });
   }
   req.user = { id: account.id, role: account.role };

   next();

 }catch(error){

   res.status(401).json({
     message:
     "Invalid Token"
   });

 }

};

module.exports =
protect;
