import API from "./client";

export const getAllPayments = async () => {
  const res = await API.get("/reports/payments");
  return res.data;
};

export const getApprovedPayments = async () => {
  const res = await API.get("/reports/approved");
  return res.data;
};

export const getRejectedPayments = async () => {
  const res = await API.get("/reports/rejected");
  return res.data;
};

export const getFullyPaidStudents = async () => {
  const res = await API.get("/reports/fullypaid");
  return res.data;
};
