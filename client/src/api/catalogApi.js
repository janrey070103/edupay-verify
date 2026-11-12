import API from "./client";

export const getCatalog = async (params = {}) => (await API.get("/catalog", { params })).data;
export const createCourse = async (data) => (await API.post("/catalog/courses", data)).data;
export const updateCourse = async (code, data) => (await API.patch(`/catalog/courses/${encodeURIComponent(code)}`, data)).data;
