import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createExam,
  getAllExams,
  getExamsForMonth,
  assignProctor,
  removeProctor,
  deleteExam,
  updateExam,
} from "../api/examApi";
import { getAllUsers } from "../api/userManagementApi";
import { publishTermSchedule, getTermSchedules } from "../api/termScheduleApi";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/ui/PageHeader";
import Drawer from "../components/ui/Drawer";
import Skeleton from "../components/ui/Skeleton";
import { IconLoader, IconX } from "../components/icons/Icons";
import { focusFirstInvalid } from "../utils/formNavigation";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const EXAM_TYPES = ["Prelim", "Midterm", "PreFinal", "Final"];
const displayTime = (value) => {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
};
const examTime = (exam) => exam?.startTime && exam?.endTime
  ? `${displayTime(exam.startTime)} - ${displayTime(exam.endTime)}` : exam?.schedule || "Time not set";
const parseLegacyTime = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = match[3]?.toUpperCase();
  if (suffix === "PM" && hour < 12) hour += 12;
  if (suffix === "AM" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};
const parseLegacySchedule = (schedule) => {
  const parts = String(schedule || "").split(/\s+-\s+/);
  return parts.length === 2 ? [parseLegacyTime(parts[0]), parseLegacyTime(parts[1])] : ["", ""];
};

const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year, month) => {
  return new Date(year, month, 1).getDay();
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const ExamSchedule = () => {
  const { showToast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [exams, setExams] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [published, setPublished] = useState([]);
  const [publishForm, setPublishForm] = useState({ examDate: "", semester: "", schoolYear: "", examType: "" });
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");

  useEffect(() => { getTermSchedules().then(setPublished).catch(() => {}); }, []);
  const handlePublish = async (event) => {
    event.preventDefault(); setPublishMessage("");
    if (focusFirstInvalid(event.currentTarget)) return;
    setPublishLoading(true);
    try {
      await publishTermSchedule(publishForm);
      setPublished(await getTermSchedules());
      setPublishMessage("Exam schedule published. Applicable students have been notified.");
      showToast("Exam schedule published.", "success");
    } catch (err) { showToast(err.response?.data?.message || "Could not publish schedule.", "error"); }
    finally { setPublishLoading(false); }
  };

  // Selected date and drawer state
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerMode, setDrawerMode] = useState("add"); // "add" or "edit"
  const [selectedExam, setSelectedExam] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    examType: "Prelim",
    subject: "",
    subjectCode: "",
    schedule: "",
    startTime: "",
    endTime: "",
    room: "",
    capacity: "",
    courseYear: "",
    courseSection: "",
  });

  const [selectedProctor, setSelectedProctor] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [examsData, teachersData] = await Promise.all([
        getExamsForMonth(year, month + 1),
        getAllUsers(),
      ]);
      setExams(examsData);
      const teachersList = teachersData.filter((u) => u.role === "teacher");
      setTeachers(teachersList);
    } catch (err) {
      showToast("Failed to load data.", "error");
    } finally {
      setLoading(false);
    }
  }, [year, month, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get exams for selected date
  const examsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return exams.filter((exam) => {
      const examDate = new Date(exam.examDate);
      return (
        examDate.getDate() === selectedDate.getDate() &&
        examDate.getMonth() === selectedDate.getMonth() &&
        examDate.getFullYear() === selectedDate.getFullYear()
      );
    });
  }, [exams, selectedDate]);

  // Get dates that have exams
  const datesWithExams = useMemo(() => {
    return exams.map((exam) => new Date(exam.examDate).getDate());
  }, [exams]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDateClick = (day) => {
    const date = new Date(year, month, day);
    setSelectedDate(date);
    setDrawerMode("add");
    setFormData({
      examType: "Prelim",
      subject: "",
      subjectCode: "",
      schedule: "",
      startTime: "",
      endTime: "",
      room: "",
      capacity: "",
      courseYear: "",
      courseSection: "",
    });
    setSelectedExam(null);
    setSelectedProctor("");
    setShowDrawer(true);
  };

  const handleEditExam = (exam) => {
    const [legacyStart, legacyEnd] = parseLegacySchedule(exam.schedule);
    setDrawerMode("edit");
    setSelectedExam(exam);
    setFormData({
      examType: exam.examType,
      subject: exam.subject,
      subjectCode: exam.subjectCode,
      schedule: exam.schedule,
      startTime: exam.startTime || legacyStart,
      endTime: exam.endTime || legacyEnd,
      room: exam.room || "",
      capacity: exam.capacity || "",
      courseYear: exam.courseYear || "",
      courseSection: exam.courseSection || "",
    });
    setSelectedProctor(exam.proctorId?._id || exam.proctorId || "");
    setShowDrawer(true);
  };

  const handleAddExam = async () => {
    if (!formData.subject || !formData.subjectCode || !formData.startTime || !formData.endTime) {
      showToast("Enter the subject, subject code, start time, and end time.", "error");
      return;
    }
    if (formData.startTime >= formData.endTime) {
      showToast("End time must be later than start time.", "error");
      return;
    }

    setActionLoading(true);
    try {
      const createdExam = await createExam({
        examDate: selectedDate,
        ...formData,
        capacity: formData.capacity ? Number(formData.capacity) : null,
      });
      if (selectedProctor) {
        try {
          await assignProctor(createdExam._id, selectedProctor);
        } catch (assignmentError) {
          showToast(assignmentError.response?.data?.message || "Exam saved, but teacher assignment failed.", "error");
          setShowDrawer(false);
          await fetchData();
          return;
        }
      }
      showToast("Exam added successfully.", "success");
      setShowDrawer(false);
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to add exam.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateExam = async () => {
    if (!formData.subject || !formData.subjectCode || !formData.startTime || !formData.endTime) {
      showToast("Enter the subject, subject code, start time, and end time.", "error");
      return;
    }
    if (formData.startTime >= formData.endTime) {
      showToast("End time must be later than start time.", "error");
      return;
    }

    setActionLoading(true);
    try {
      await updateExam(selectedExam._id, {
        ...formData,
        capacity: formData.capacity ? Number(formData.capacity) : null,
      });
      showToast("Exam updated successfully.", "success");
      setShowDrawer(false);
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update exam.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignProctor = async () => {
    if (!selectedProctor) {
      showToast("Please select a teacher.", "error");
      return;
    }

    setActionLoading(true);
    try {
      const updatedExam = await assignProctor(selectedExam._id, selectedProctor);
      showToast("Teacher assigned successfully.", "success");
      await fetchData();
      handleEditExam(updatedExam);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to assign teacher.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveProctor = async () => {
    setActionLoading(true);
    try {
      const updatedExam = await removeProctor(selectedExam._id);
      showToast("Teacher removed successfully.", "success");
      await fetchData();
      handleEditExam(updatedExam);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to remove teacher.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!window.confirm("Are you sure you want to delete this exam?")) return;

    setActionLoading(true);
    try {
      await deleteExam(selectedExam._id);
      showToast("Exam deleted successfully.", "success");
      setShowDrawer(false);
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete exam.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const calendarDays = [];
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const drawerTitle = drawerMode === "add" ? "Add Exam" : "Edit Exam";

  return (
    <div>
      <section className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800">Publish examination term</h2>
        <p className="mt-1 text-sm text-gray-500">This publishes a term date for students. Subject exams and proctor assignments below remain separate.</p>
        <form onSubmit={handlePublish} noValidate className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label htmlFor="publish-exam-date" className="text-sm font-semibold text-gray-700">Exam date
            <input id="publish-exam-date" type="date" required value={publishForm.examDate} onChange={(e) => setPublishForm({ ...publishForm, examDate: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3" /></label>
          <label htmlFor="publish-semester" className="text-sm font-semibold text-gray-700">Semester
            <select id="publish-semester" required value={publishForm.semester} onChange={(e) => setPublishForm({ ...publishForm, semester: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3">
              <option value="">Select semester</option><option>1st Semester</option><option>2nd Semester</option><option>Summer</option>
            </select></label>
          <label htmlFor="publish-school-year" className="text-sm font-semibold text-gray-700">School year
            <input id="publish-school-year" type="text" required pattern="[0-9]{4}-[0-9]{4}" placeholder="2026-2027" value={publishForm.schoolYear}
              onChange={(e) => setPublishForm({ ...publishForm, schoolYear: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3" /></label>
          <label htmlFor="publish-exam-type" className="text-sm font-semibold text-gray-700">Exam term
            <select id="publish-exam-type" required value={publishForm.examType} onChange={(e) => setPublishForm({ ...publishForm, examType: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3">
              <option value="">Select term</option>{EXAM_TYPES.map((term) => <option key={term}>{term}</option>)}
            </select></label>
          <button type="submit" disabled={publishLoading} className="min-h-11 rounded-lg bg-sti-gold px-5 font-black text-sti-blue disabled:opacity-50 sm:col-span-2 lg:col-span-4 lg:justify-self-start">
            {publishLoading ? "Publishing…" : "Publish schedule"}</button>
        </form>
        {publishMessage && <p role="status" className="mt-3 text-sm font-semibold text-green-700">{publishMessage}</p>}
        <h3 className="mt-6 text-sm font-bold text-gray-700">Published terms</h3>
        {published.length === 0 ? <p className="mt-2 text-sm text-gray-500">No terms published yet.</p> :
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">{published.map((item) => <li key={item._id} className="rounded-lg border border-gray-100 p-3 text-sm">
            <strong>{item.examType}</strong> · {item.semester} · {item.schoolYear} · {formatDate(item.examDate)}
          </li>)}</ul>}
      </section>

      <div className="grid gap-6 lg:grid-cols-4 lg:gap-8">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
            {/* Month Header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <button
                onClick={handlePrevMonth}
                className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 transition"
              >
                ←
              </button>
              <h2 className="text-xl font-bold text-gray-800">
                {MONTHS[month]} {year}
              </h2>
              <button
                onClick={handleNextMonth}
                className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 transition"
              >
                →
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/80">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-widest border-r border-gray-100 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-0">
              {calendarDays.map((day, idx) => {
                const hasExams = day && datesWithExams.includes(day);
                const isToday =
                  day &&
                  new Date(year, month, day).toDateString() === new Date().toDateString();

                return (
                  <button
                    key={idx}
                    onClick={() => day && handleDateClick(day)}
                    disabled={!day}
                    className={`bg-white p-2 min-h-[100px] border-r border-b border-gray-100 text-left transition-colors relative group border-[0.5px] border-transparent hover:border-blue-100 ${
                      !day
                        ? "bg-gray-50/50 cursor-default"
                        : "hover:bg-blue-50/30 cursor-pointer"
                    }`}
                  >
                    <div className={`mb-1 flex items-center justify-center text-sm ${isToday ? 'w-7 h-7 rounded-md bg-blue-600 text-white font-bold shadow-sm' : 'font-semibold text-gray-700 w-7 h-7'}`}>
                      {day}
                    </div>
                    {hasExams && (
                      <div className="mt-1 space-y-1">
                        {exams
                          .filter((e) => new Date(e.examDate).getDate() === day)
                          .slice(0, 2)
                          .map((e, i) => (
                            <div
                              key={i}
                              className="text-[10px] px-2 py-1 truncate font-bold cursor-pointer transition-all shadow-sm flex items-center gap-1 bg-blue-50 text-blue-700 border-y border-blue-200/60 rounded"
                            >
                              {e.examType ? `${e.examType}: ` : ""}{e.subjectCode}
                            </div>
                          ))}
                        {exams.filter((e) => new Date(e.examDate).getDate() === day).length > 2 && (
                          <div className="text-[10px] font-bold text-gray-500 hover:text-blue-600 cursor-pointer text-center mt-1 hover:bg-gray-100 rounded-md py-0.5">
                            +{exams.filter((e) => new Date(e.examDate).getDate() === day).length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar - Exams for Selected Date */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {selectedDate ? formatDate(selectedDate) : "Select a Date"}
            </h3>

            {selectedDate && examsForSelectedDate.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">No exams scheduled</p>
                <button
                  onClick={() => handleDateClick(selectedDate.getDate())}
                  className="w-full rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-semibold hover:bg-blue-700 shadow-[0_4px_14px_rgba(37,99,235,0.39)] transition"
                >
                  + Add Exam
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {examsForSelectedDate.map((exam) => (
                  <button
                    key={exam._id}
                    onClick={() => handleEditExam(exam)}
                    className="w-full text-left rounded-lg border border-gray-200 p-3 hover:bg-blue-50 transition"
                  >
                    <p className="font-semibold text-sm text-gray-800">{exam.subjectCode}</p>
                    <p className="text-xs text-gray-600">{examTime(exam)}</p>
                    {exam.proctorName && (
                      <p className="text-xs text-blue-600 mt-1 font-semibold">Proctor: {exam.proctorName}</p>
                    )}
                    {!exam.proctorName && (
                      <p className="text-xs text-red-600 mt-1">No proctor assigned</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drawer for Add/Edit Exam */}
      <Drawer open={showDrawer} onClose={() => setShowDrawer(false)} title={drawerTitle}>
        <div className="space-y-4">
          {drawerMode === "edit" && selectedExam && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              <p className="font-semibold mb-1">Exam Details:</p>
              <p>{selectedExam.subject} ({selectedExam.subjectCode})</p>
              <p className="text-xs mt-1">{formatDate(selectedExam.examDate)} • {examTime(selectedExam)}</p>
            </div>
          )}

          <div>
            <label htmlFor="exam-type" className="block text-sm font-semibold text-gray-700 mb-2">
              Examination Term <span className="text-xs font-normal text-gray-500">(eligibility category)</span>
            </label>
            <select
              id="exam-type"
              value={formData.examType}
              onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
              disabled={drawerMode === "edit"}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {EXAM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="e.g., Mathematics 101"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Subject Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.subjectCode}
              onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })}
              placeholder="e.g., MATH101"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Start Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              required
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              End Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              required
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Room (Optional)
            </label>
            <input
              type="text"
              value={formData.room}
              onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              placeholder="e.g., Room 201"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Capacity (Optional)
            </label>
            <input
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              placeholder="e.g., 50"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Course Year (Optional)
            </label>
            <select
              value={formData.courseYear}
              onChange={(e) => setFormData({ ...formData, courseYear: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Select year...</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Course Section (Optional)
            </label>
            <input
              type="text"
              value={formData.courseSection}
              onChange={(e) => setFormData({ ...formData, courseSection: e.target.value })}
              placeholder="e.g., A, B, or C"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {drawerMode === "edit" && selectedExam && (
            <div className="border-t border-gray-200 pt-4">
              <label htmlFor="exam-proctor" className="block text-sm font-semibold text-gray-700 mb-2">
                Assign Teacher / Proctor
              </label>
              <select
                id="exam-proctor"
                value={selectedProctor}
                onChange={(e) => setSelectedProctor(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select a teacher...</option>
                {teachers.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.name}
                  </option>
                ))}
              </select>

              {selectedExam.proctorName && <p className="mt-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                Currently assigned: <strong>{selectedExam.proctorName}</strong>
              </p>}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleAssignProctor}
                  disabled={actionLoading || !selectedProctor}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.39)] transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {actionLoading ? <IconLoader className="mx-auto h-4 w-4" /> : selectedExam.proctorName ? "Reassign" : "Assign"}
                </button>
                {selectedExam.proctorName && <button
                  type="button"
                  onClick={handleRemoveProctor}
                  disabled={actionLoading}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                >
                  Remove
                </button>}
              </div>
            </div>
          )}

          {drawerMode === "add" && (
            <div className="border-t border-gray-200 pt-4">
              <label htmlFor="new-exam-proctor" className="block text-sm font-semibold text-gray-700 mb-2">
                Assign Teacher / Proctor (Optional)
              </label>
              <select
                id="new-exam-proctor"
                value={selectedProctor}
                onChange={(e) => setSelectedProctor(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Leave unassigned</option>
                {teachers.map((teacher) => <option key={teacher._id} value={teacher._id}>{teacher.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-500">The selected teacher will receive an in-app assignment notification after the exam is saved.</p>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4 flex gap-3">
            <button
              onClick={() => setShowDrawer(false)}
              disabled={actionLoading}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition disabled:opacity-60"
            >
              Cancel
            </button>

            {drawerMode === "edit" && (
              <button
                onClick={handleDeleteExam}
                disabled={actionLoading}
                className="flex-1 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-60"
              >
                Delete
              </button>
            )}

            <button
              onClick={drawerMode === "add" ? handleAddExam : handleUpdateExam}
              disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-blue-700 shadow-[0_4px_14px_rgba(37,99,235,0.39)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 transition"
            >
              {actionLoading ? <IconLoader className="h-4 w-4" /> : null}
              {drawerMode === "add" ? "Add Exam" : "Update"}
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default ExamSchedule;
