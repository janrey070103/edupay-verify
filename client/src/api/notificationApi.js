import API from "./client";

export const getNotifications = async (studentId) => {
  const res = await API.get(`/notifications/${studentId}`);
  return res.data;
};

export const markAllRead = async (studentId) => {
  const res = await API.patch(`/notifications/${studentId}/read`);
  return res.data;
};
