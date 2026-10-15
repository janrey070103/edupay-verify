import API from "./client";

export const getCurrentUser = async () => (await API.get("/auth/me")).data;

export default API;
