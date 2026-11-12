import API from "./client";

export const getAllUsers = async (params = {}) => {
  const res = await API.get("/users", { params });
  return res.data;
};

export const getUserSummary = async () => {
  const res = await API.get("/users/summary");
  return res.data;
};

export const getPendingStudents = async (params = {}) => {
  const res = await API.get("/users/pending-students", { params });
  return res.data;
};

export const verifyStudent = async (id) => {
  const res = await API.patch(`/users/${id}/verify`);
  return res.data;
};

export const rejectStudent = async (id, rejectionReason) => {
  const res = await API.patch(`/users/${id}/reject`, { rejectionReason });
  return res.data;
};

export const createUser = async (data) => {
  const res = await API.post("/users", data);
  return res.data;
};

export const updateUser = async (id, data) => {
  const res = await API.patch(`/users/${id}`, data);
  return res.data;
};

export const resetUserPassword = async (id, password) => {
  const res = await API.patch(`/users/${id}/reset-password`, { password });
  return res.data;
};

export const activateUser = async (id) => {
  const res = await API.patch(`/users/${id}/activate`);
  return res.data;
};

export const deactivateUser = async (id) => {
  const res = await API.patch(`/users/${id}/deactivate`);
  return res.data;
};

// Admins: active teachers for proctor assignment.
export const listTeachers = async () => (await API.get("/users/teachers")).data;
