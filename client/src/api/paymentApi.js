import API from "./client";

export const getPayments = async () => {
  const res = await API.get("/payments");
  return res.data;
};

export const uploadPayment = async (formData) => {
  const res = await API.post("/payments", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const approvePayment = async (id, amount) => {
  const res = await API.put(`/payments/approve/${id}`, { amount });
  return res.data;
};

export const rejectPayment = async (id, remarks = "", rejectionReason = "other") => {
  const res = await API.put(`/payments/reject/${id}`, {
    remarks,
    rejectionReason,
  });
  return res.data;
};

export const createDirectPayment = async (paymentData) => {
  const res = await API.post("/payments/direct-payment", paymentData);
  return res.data;
};

export const searchStudents = async (query) => {
  const res = await API.get("/users/search", {
    params: { query },
  });
  return res.data;
};
