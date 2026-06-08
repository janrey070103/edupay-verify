import API from "./client";

export const getAllUsers = async () => {
  const res = await API.get("/users");
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

export const deactivateUser = async (id) => {
  const res = await API.patch(`/users/${id}/deactivate`);
  return res.data;
};
