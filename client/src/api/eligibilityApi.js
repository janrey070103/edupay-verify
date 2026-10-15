import API from "./client";

export const getEligibility = async (studentId) => {
  const res = await API.get(`/eligibility/${studentId}`);
  return res.data;
};

export const generateQR = async (studentId, examType) => {
  const res = await API.post("/qr/generate", { studentId, examType });
  return res.data;
};

export const getStudentPermits = async (studentId) => {
  const res = await API.get(`/qr/student/${studentId}`);
  return res.data;
};

export const scanExamPermit = async (token, examType) => {
  const res = await API.post("/qr/scan", { token, examType });
  return res.data;
};
export const getMyLedger = async () => (await API.get("/eligibility/me/ledger")).data;
