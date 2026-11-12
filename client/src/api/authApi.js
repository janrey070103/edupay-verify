import API from "./client";

export const getCurrentUser = async () => (await API.get("/auth/me")).data;
export const changeMyPassword = async (currentPassword, newPassword) =>
  (await API.patch("/auth/me/password", { currentPassword, newPassword })).data;

export default API;
