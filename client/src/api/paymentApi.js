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

export const approvePayment = async (id) => {
  const res = await API.put(`/payments/approve/${id}`);
  return res.data;
};

export const rejectPayment = async (id) => {
  const res = await API.put(`/payments/reject/${id}`);
  return res.data;
};
