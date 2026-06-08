const Ledger =
require("../Models/Ledger");

// Prelim
const getPrelimEligible =
async(req,res)=>{

 try{

   const students =
   await Ledger.find({
     prelim:true
   });

   res.json(students);

 }catch(error){

   res.status(500).json({
     message:error.message
   });

 }

};

// Midterm
const getMidtermEligible =
async(req,res)=>{

 try{

   const students =
   await Ledger.find({
     midterm:true
   });

   res.json(students);

 }catch(error){

   res.status(500).json({
     message:error.message
   });

 }

};

// Pre Final
const getPreFinalEligible =
async(req,res)=>{

 try{

   const students =
   await Ledger.find({
     preFinal:true
   });

   res.json(students);

 }catch(error){

   res.status(500).json({
     message:error.message
   });

 }

};

// Final
const getFinalEligible =
async(req,res)=>{

 try{

   const students =
   await Ledger.find({
     final:true
   });

   res.json(students);

 }catch(error){

   res.status(500).json({
     message:error.message
   });

 }

};

module.exports = {

 getPrelimEligible,
 getMidtermEligible,
 getPreFinalEligible,
 getFinalEligible

};