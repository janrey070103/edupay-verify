const cashierOnly =
(req,res,next)=>{

 if(
  req.user.role !==
  "cashier"
 ){

   return res
   .status(403)
   .json({

     message:
     "Access Denied"

   });

 }

 next();

};

module.exports =
cashierOnly;