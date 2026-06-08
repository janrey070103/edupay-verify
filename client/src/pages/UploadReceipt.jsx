import { useState } from "react";
import axios from "axios";

const UploadReceipt = () => {

  const [file, setFile] =
  useState(null);

  const [studentId, setStudentId] =
  useState("");

  const [studentName, setStudentName] =
  useState("");

  const [invoiceNumber, setInvoiceNumber] =
  useState("");

  const [amount, setAmount] =
  useState("");

  const [paymentDescription,
  setPaymentDescription] =
  useState("");

  const submitReceipt =
  async () => {

    try {

      const formData =
      new FormData();

      formData.append(
        "receipt",
        file
      );

      formData.append(
        "studentId",
        studentId
      );

      formData.append(
        "studentName",
        studentName
      );

      formData.append(
        "invoiceNumber",
        invoiceNumber
      );

      formData.append(
        "amount",
        amount
      );

      formData.append(
        "paymentDescription",
        paymentDescription
      );

      const response =
      await axios.post(
        "http://localhost:5000/api/payments",
        formData
      );

      alert(
        "Receipt Uploaded Successfully"
      );

      console.log(
        response.data
      );

    } catch (error) {

      console.log(error);

      alert(
        "Upload Failed"
      );

    }

  };

  return (

    <div>

      <h1>
        Upload Receipt
      </h1>

      <input
        type="text"
        placeholder="Student ID"
        value={studentId}
        onChange={(e)=>
          setStudentId(
            e.target.value
          )
        }
      />

      <br/><br/>

      <input
        type="text"
        placeholder="Student Name"
        value={studentName}
        onChange={(e)=>
          setStudentName(
            e.target.value
          )
        }
      />

      <br/><br/>

      <input
        type="text"
        placeholder="Invoice Number"
        value={invoiceNumber}
        onChange={(e)=>
          setInvoiceNumber(
            e.target.value
          )
        }
      />

      <br/><br/>

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e)=>
          setAmount(
            e.target.value
          )
        }
      />

      <br/><br/>

      <input
        type="text"
        placeholder="Payment Description"
        value={paymentDescription}
        onChange={(e)=>
          setPaymentDescription(
            e.target.value
          )
        }
      />

      <br/><br/>

      <input
        type="file"
        onChange={(e)=>
          setFile(
            e.target.files[0]
          )
        }
      />

      <br/><br/>

      <button
        onClick={submitReceipt}
      >
        Upload Receipt
      </button>

    </div>

  );

};

export default UploadReceipt;