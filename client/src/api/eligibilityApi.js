import API from "./client";

export const getEligibility = async (studentId) => {
  const res = await API.get(`/eligibility/${studentId}`);
  return res.data;
};

export const generateQR = async (studentId, examType) => {
  const res = await API.post("/qr/generate", { studentId, examType });
  return res.data;
};
