import API from "./client";

export const getAdminSummary = async () => (await API.get("/admin/summary")).data;
export const getEligibilityReport = async (params = {}) => (await API.get("/admin/eligibility", { params })).data;
