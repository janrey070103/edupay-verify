const Payment =
require("../Models/Payments");

const Ledger =
require("../Models/Ledger");

// All Payments
const getAllPayments =
async (req,res)=>{

  try{

    const payments =
    await Payment.find();

    res.json(payments);

  }catch(error){

    res.status(500).json({
      message:error.message
    });

  }

};

// Approved Payments
const getApprovedPayments =
async (req,res)=>{

  try{

    const payments =
    await Payment.find({
      status:"Approved"
    });

    res.json(payments);

  }catch(error){

    res.status(500).json({
      message:error.message
    });

  }

};

// Rejected Payments
const getRejectedPayments =
async (req,res)=>{

  try{

    const payments =
    await Payment.find({
      status:"Rejected"
    });

    res.json(payments);

  }catch(error){

    res.status(500).json({
      message:error.message
    });

  }

};

// Fully Paid Students
const getFullyPaidStudents =
async (req,res)=>{

  try{

    const students =
    await Ledger.find({
      fullyPaid:true
    });

    res.json(students);

  }catch(error){

    res.status(500).json({
      message:error.message
    });

  }

};

module.exports = {

  getAllPayments,
  getApprovedPayments,
  getRejectedPayments,
  getFullyPaidStudents,

};