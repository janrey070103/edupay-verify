import API from "./client";

export const getPaymentsReport = async (params = {}) => {
  const res = await API.get("/reports/payments", { params });
  return res.data;
};

export const getReportSummary = async (params = {}) => {
  const res = await API.get("/reports/summary", { params });
  return res.data;
};
