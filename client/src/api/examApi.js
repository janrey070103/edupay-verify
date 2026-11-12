import API from "./client";

// Create exam
export const createExam = async (examData) => {
  const res = await API.post("/exams", examData);
  return res.data;
};

// Get all exams
export const getAllExams = async () => {
  const res = await API.get("/exams");
  return res.data;
};

// Get exams by date
export const getExamsByDate = async (date) => {
  const res = await API.get("/exams/date", {
    params: { date },
  });
  return res.data;
};

// Get exams for a specific month (for calendar)
export const getExamsForMonth = async (year, month) => {
  const res = await API.get("/exams/month", {
    params: { year, month },
  });
  return res.data;
};

// Get exams assigned to current teacher
export const getAssignedExams = async () => {
  const res = await API.get("/exams/teacher/assigned");
  return res.data;
};

// Update exam
export const updateExam = async (id, examData) => {
  const res = await API.put(`/exams/${id}`, examData);
  return res.data;
};

// Assign proctor/teacher to exam
export const assignProctor = async (examId, proctorId) => {
  const res = await API.put(`/exams/${examId}/assign-proctor`, { proctorId });
  return res.data;
};

// Remove proctor from exam
export const removeProctor = async (examId) => {
  const res = await API.put(`/exams/${examId}/remove-proctor`);
  return res.data;
};

// Delete exam
export const deleteExam = async (id) => {
  const res = await API.delete(`/exams/${id}`);
  return res.data;
};

// Get exam schedule report (for printing)
export const getExamScheduleReport = async (year, month, examType) => {
  const res = await API.get("/exams/report/schedule", {
    params: { year, month, examType },
  });
  return res.data;
};

// Student: own exams as calendar events (with proctor verification details).
export const getMyExamCalendar = async () => (await API.get("/exams/student/calendar")).data;

// Teacher: assigned exams as calendar events, with the students verified for each.
export const getTeacherExamCalendar = async () => (await API.get("/exams/teacher/calendar")).data;
