import API from "./client";

export const getNotifications = async (studentId) => {
  const res = await API.get(`/notifications/${studentId}`);
  return res.data;
};

export const markAllRead = async (studentId) => {
  const res = await API.patch(`/notifications/${studentId}/read`);
  return res.data;
};

export const getCashierNotifications = async () => {
  const res = await API.get("/notifications/cashier");
  return res.data;
};

export const cashierMarkAllRead = async () => {
  const res = await API.patch("/notifications/cashier/read");
  return res.data;
};
