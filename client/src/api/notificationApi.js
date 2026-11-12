import API from "./client";

export const getMyNotifications = async (params = {}) => {
  const res = await API.get("/notifications", { params });
  return res.data;
};

export const markMyNotificationsRead = async () => {
  const res = await API.patch("/notifications/read");
  return res.data;
};

export const markNotificationRead = async (id) => (await API.patch(`/notifications/${id}/read`)).data;
