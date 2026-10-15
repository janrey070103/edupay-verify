import API from "./client";
export const publishTermSchedule = async (data) => (await API.post("/term-schedules", data)).data;
export const getTermSchedules = async () => (await API.get("/term-schedules")).data;
export const getMyTermSchedules = async () => (await API.get("/term-schedules/mine")).data;
