import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createExam,
  getAllExams,
  getExamsForMonth,
  deleteExam,
  updateExam,
} from "../api/examApi";
import { listTeachers } from "../api/userManagementApi";
import { publishTermSchedule, getTermSchedules } from "../api/termScheduleApi";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/ui/PageHeader";
import Drawer from "../components/ui/Drawer";
import Skeleton from "../components/ui/Skeleton";
import { IconLoader, IconX } from "../components/icons/Icons";
import { useMyCourses } from "../hooks/useCatalog";
import ExamTimeInput from "../components/ui/ExamTimeInput";
import ExamSectionsEditor from "../components/ExamSectionsEditor";
import { emptySection, sectionsFromExam, sectionsPayload, sectionsProblem } from "../utils/examSections";
import { currentSchoolYear } from "../utils/schoolYear";
import { markMissing } from "../utils/fieldAlerts";

import { examTimeProblem } from "../utils/examTime";
import { examPeriodForDate, examScheduleProblem, isPastDay, manilaMidnight, todayKey, TERM_LABELS,
  examPeriodProblem, examPeriodWindow, manilaDayKey, periodDay, rangeText, shortDate } from "../utils/examPeriod";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const EXAM_TYPES = ["Prelim", "Midterm", "PreFinal", "Final"];

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
  const { myActiveCourses } = useMyCourses();

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
    event.preventDefault(); setPublishMessage(""); setPublishLoading(true);
    try {
      await publishTermSchedule({ ...publishForm, schoolYear: currentSchoolYear() });
      setPublished(await getTermSchedules());
      setPublishMessage("Term published for your department. Your department's students have been notified.");
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
    course: "",
    examType: "Prelim",
    subject: "",
    subjectCode: "",
    schedule: "",
    startTime: "",
    endTime: "",
    timeMode: "picker",
    examKind: "Regular",
    room: "",
    capacity: "",
    courseYear: "",
    courseSection: "",
  });

  // Sections of the exam, each with its own room and proctor (at least one).
  const [sections, setSections] = useState([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [examsData, teachersData] = await Promise.all([
        getExamsForMonth(year, month + 1),
        listTeachers(),
      ]);
      setExams(examsData);
      setTeachers(Array.isArray(teachersData) ? teachersData : []);
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
    // Past days can be viewed (their exams are listed) but not scheduled.
    if (isPastDay(date)) {
      showToast(`${formatDate(date)} has already passed. Exams can only be scheduled for today or a later date.`, "info");
      return;
    }
    const period = examPeriodForDate(manilaMidnight(date));
    setDrawerMode("add");
    setFormData({
      course: "",
      examType: period.kind === "term" ? period.term : "Prelim",
      subject: "",
      subjectCode: "",
      schedule: "",
      startTime: "",
      endTime: "",
      timeMode: "picker",
      examKind: "Regular",
      room: "",
      capacity: "",
      courseYear: "",
      courseSection: "",
    });
    setSelectedExam(null);
    setSections([emptySection()]);
    setShowDrawer(true);
  };

  const handleEditExam = (exam) => {
    setDrawerMode("edit");
    setSelectedExam(exam);
    const period = examPeriodForDate(exam.examDate);
    setFormData({
      course: exam.course || "",
      examType: period.kind === "term" ? period.term : exam.examType,
      subject: exam.subject,
      subjectCode: exam.subjectCode,
      schedule: exam.schedule,
      startTime: exam.startTime || "",
      endTime: exam.endTime || "",
      timeMode: exam.startTime && exam.endTime ? "picker" : "manual",
      examKind: exam.examKind || "Regular",
      room: exam.room || "",
      capacity: exam.capacity || "",
      courseYear: exam.courseYear || "",
      courseSection: exam.courseSection || "",
    });
    setSections(sectionsFromExam(exam));
    setShowDrawer(true);
  };

  // Course year and capacity are required for every exam.
  const yearCapacityProblem = () => {
    if (!formData.courseYear) { markMissing(["exam-course-year"])?.focus(); return "Choose the course year."; }
    if (!(Number.isInteger(Number(formData.capacity)) && Number(formData.capacity) >= 1)) {
      markMissing(["exam-capacity"])?.focus(); return "Enter the capacity (number of students, at least 1).";
    }
    return "";
  };

  const handleAddExam = async () => {
    if (!formData.course || !formData.subject || !formData.subjectCode) {
      showToast("Please fill in the highlighted fields.", "error");
      markMissing([!formData.course && "exam-course", !formData.subject && "exam-subject", !formData.subjectCode && "exam-subject-code"].filter(Boolean))?.focus();
      return;
    }
    const timeProblem = examTimeProblem(formData);
    if (timeProblem) { showToast(timeProblem, "error"); return; }
    const scheduleProblem = examScheduleProblem({ examDate: manilaMidnight(selectedDate), examType: formData.examType,
      startTime: formData.timeMode === "picker" ? formData.startTime : undefined });
    if (scheduleProblem) { showToast(scheduleProblem, "error"); return; }
    const periodProblem = examPeriodProblem({ examDate: manilaMidnight(selectedDate), examType: formData.examType, examKind: formData.examKind },
      regularDaysFor(formData.examType));
    if (periodProblem) { showToast(periodProblem, "error"); return; }
    const requiredProblem = yearCapacityProblem();
    if (requiredProblem) { showToast(requiredProblem, "error"); return; }
    const sectionProblem = sectionsProblem(sections, formData);
    if (sectionProblem) { showToast(sectionProblem, "error"); return; }

    setActionLoading(true);
    try {
      await createExam({
        examDate: selectedDate,
        ...formData,
        room: "",
        courseSection: "",
        capacity: Number(formData.capacity),
        sections: sectionsPayload(sections),
      });
      showToast(`Exam added with ${sections.length} section${sections.length === 1 ? "" : "s"}.`, "success");
      setShowDrawer(false);
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to add exam.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateExam = async () => {
    if (!formData.course || !formData.subject || !formData.subjectCode) {
      showToast("Please fill in the highlighted fields.", "error");
      markMissing([!formData.course && "exam-course", !formData.subject && "exam-subject", !formData.subjectCode && "exam-subject-code"].filter(Boolean))?.focus();
      return;
    }
    const timeProblem = examTimeProblem(formData);
    if (timeProblem) { showToast(timeProblem, "error"); return; }
    const newStart = formData.timeMode === "picker" ? formData.startTime : undefined;
    const scheduleProblem = examScheduleProblem({ examDate: selectedExam.examDate, examType: formData.examType, startTime: newStart },
      new Date(), { checkPast: Boolean(newStart) && newStart !== selectedExam.startTime });
    if (scheduleProblem) { showToast(scheduleProblem, "error"); return; }
    const requiredProblem = yearCapacityProblem();
    if (requiredProblem) { showToast(requiredProblem, "error"); return; }
    const sectionProblem = sectionsProblem(sections, formData);
    if (sectionProblem) { showToast(sectionProblem, "error"); return; }
    if (formData.examKind !== (selectedExam.examKind || "Regular") || formData.examType !== selectedExam.examType) {
      const periodProblem = examPeriodProblem({ examDate: selectedExam.examDate, examType: formData.examType, examKind: formData.examKind },
        regularDaysFor(formData.examType, selectedExam._id));
      if (periodProblem) { showToast(periodProblem, "error"); return; }
    }

    setActionLoading(true);
    try {
      await updateExam(selectedExam._id, {
        ...formData,
        capacity: Number(formData.capacity),
        sections: sectionsPayload(sections),
        courseSection: "",
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
  // Day keys of this month's regular, non-cancelled exams for a term (they set its 4-day period).
  function regularDaysFor(type, excludeId) {
    return exams.filter((exam) => exam.examType === type && (exam.examKind || "Regular") !== "Special"
      && exam.status !== "Cancelled" && exam._id !== excludeId).map((exam) => manilaDayKey(exam.examDate));
  }
  // The exam period of the date being scheduled or edited.
  const drawerDate = drawerMode === "edit" ? selectedExam?.examDate : selectedDate && manilaMidnight(selectedDate);
  const drawerPeriod = drawerDate ? examPeriodForDate(drawerDate) : null;
  const termCorrected = drawerMode === "edit" && selectedExam && drawerPeriod?.kind === "term" && selectedExam.examType !== drawerPeriod.term;
  const selectedIsPast = selectedDate ? isPastDay(selectedDate) : false;
  // The 4-day period of the term being edited, and of every term shown this month.
  const drawerRegularDays = regularDaysFor(formData.examType, drawerMode === "edit" ? selectedExam?._id : undefined);
  const drawerExamPeriod = examPeriodWindow(drawerRegularDays);
  const monthPeriods = EXAM_TYPES.map((type) => ({ type, period: examPeriodWindow(regularDaysFor(type)) }))
    .filter((item) => item.period);

  return (
    <div>
      <section className="mb-5 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800">Publish examination term</h2>
        <p className="mt-1 text-sm text-gray-500">Sets your department's exam date for a term. Other departments set their own dates.</p>
        <p className="mt-1 text-sm text-gray-500">This publishes a term date for students. Subject exams and proctor assignments below remain separate.</p>
        <form onSubmit={handlePublish} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold text-gray-700">Exam date
            <input type="date" required min={todayKey()} value={publishForm.examDate} onChange={(e) => setPublishForm({ ...publishForm, examDate: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3" /></label>
          <label className="text-sm font-semibold text-gray-700">Semester
            <select required value={publishForm.semester} onChange={(e) => setPublishForm({ ...publishForm, semester: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3">
              <option value="">Select semester</option><option>1st Semester</option><option>2nd Semester</option>
            </select></label>
          <label className="text-sm font-semibold text-gray-700">School year
            <input value={currentSchoolYear()} readOnly aria-readonly="true" title="Set automatically to the current school year"
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3 cursor-not-allowed bg-gray-50 font-semibold text-gray-700" /></label>
          <label className="text-sm font-semibold text-gray-700">Exam term
            <select required value={publishForm.examType} onChange={(e) => setPublishForm({ ...publishForm, examType: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3">
              <option value="">Select term</option>{EXAM_TYPES.map((term) => <option key={term}>{term}</option>)}
            </select></label>
          <button type="submit" disabled={publishLoading} aria-busy={publishLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sti-gold px-5 font-black text-sti-blue disabled:opacity-50 sm:col-span-2 lg:col-span-4 lg:justify-self-start">
            {publishLoading && <IconLoader className="h-4 w-4" />}
            {publishLoading ? "Publishing…" : "Publish schedule"}</button>
        </form>
        {publishMessage && <p role="status" className="mt-3 text-sm font-semibold text-green-700">{publishMessage}</p>}
        <h3 className="mt-6 text-sm font-bold text-gray-700">Published terms</h3>
        {published.length === 0 ? <p className="mt-2 text-sm text-gray-500">No terms published yet.</p> :
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">{published.map((item) => <li key={item._id} className="rounded-lg border border-gray-100 p-3 text-sm">
            <strong>{item.examType}</strong> · {item.semester} · {item.schoolYear} · {formatDate(item.examDate)}
            {item.schoolWide ? (
              <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-500"
                title="Published before departments existed. Applies to your students until your department publishes its own date for this term.">
                School-wide
              </span>
            ) : (
              <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sti-blue">{item.department}</span>
            )}
          </li>)}</ul>}
      </section>

      <div className="grid gap-4 lg:grid-cols-4 lg:gap-5">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
            {/* Month Header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
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
                const isPast = day && isPastDay(new Date(year, month, day));
                const cellKey = day ? manilaDayKey(manilaMidnight(new Date(year, month, day))) : "";
                const inPeriod = day ? monthPeriods.map(({ type, period }) => ({ type, n: periodDay(period, cellKey) })).find((item) => item.n) : null;

                return (
                  <button
                    key={idx}
                    onClick={() => day && handleDateClick(day)}
                    disabled={!day}
                    title={isPast ? "Past date: exams can no longer be scheduled" : undefined}
                    className={`p-2 min-h-25 border-r border-b text-left transition-colors relative group border-[0.5px] border-transparent ${
                      !day
                        ? "bg-gray-50/50 cursor-default"
                        : isPast
                          ? "bg-gray-50 opacity-60 cursor-pointer"
                          : "bg-white hover:border-blue-100 hover:bg-blue-50/30 cursor-pointer"
                    }`}
                  >
                    <div className={`mb-1 flex items-center justify-center text-sm ${isToday ? 'w-7 h-7 rounded-md bg-blue-600 text-white font-bold shadow-sm' : 'font-semibold text-gray-700 w-7 h-7'}`}>
                      {day}
                    </div>
                    {inPeriod && (
                      <div className="mb-1 rounded bg-sti-gold/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-sti-blue" title={`${TERM_LABELS[inPeriod.type]} exam period, day ${inPeriod.n} of 4`}>
                        {TERM_LABELS[inPeriod.type]} · Day {inPeriod.n}
                      </div>
                    )}
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
                              {e.examKind === "Special" ? "Special: " : e.examType ? `${e.examType}: ` : ""}{e.subjectCode}
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
          <div className="rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-5">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {selectedDate ? formatDate(selectedDate) : "Select a Date"}
            </h3>

            {selectedDate && examsForSelectedDate.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">No exams scheduled</p>
                {selectedIsPast ? (
                  <p className="text-xs text-gray-400">This date has passed; exams can no longer be scheduled.</p>
                ) : (
                <button
                  onClick={() => handleDateClick(selectedDate.getDate())}
                  className="w-full rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-semibold hover:bg-blue-700 shadow-[0_4px_14px_rgba(37,99,235,0.39)] transition"
                >
                  + Add Exam
                </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {examsForSelectedDate.map((exam) => (
                  <button
                    key={exam._id}
                    onClick={() => handleEditExam(exam)}
                    className="w-full text-left rounded-lg border border-gray-200 p-3 hover:bg-blue-50 transition"
                  >
                    <p className="font-semibold text-sm text-gray-800">
                      {exam.subjectCode}
                      <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${exam.course ? "bg-blue-50 text-sti-blue" : "bg-amber-50 text-amber-700"}`}>
                        {exam.course || "No course"}
                      </span>
                      {exam.examKind === "Special" && (
                        <span className="ml-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">Special</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-600">{exam.schedule}</p>
                    {exam.sections?.length > 0 ? (
                      <>
                        <p className="text-xs text-blue-600 mt-1 font-semibold">
                          {exam.sections.length} section{exam.sections.length === 1 ? "" : "s"}: {exam.sections.map((section) => section.name).join(", ")}
                        </p>
                        {exam.sections.some((section) => !section.proctorId) ? (
                          <p className="text-xs text-red-600 mt-0.5">
                            {exam.sections.filter((section) => !section.proctorId).length} section(s) without a proctor
                          </p>
                        ) : (
                          <p className="text-xs text-green-700 mt-0.5">Every section has a proctor</p>
                        )}
                      </>
                    ) : exam.proctorName ? (
                      <p className="text-xs text-blue-600 mt-1 font-semibold">Proctor: {exam.proctorName}</p>
                    ) : (
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
              <p className="text-xs mt-1">{formatDate(selectedExam.examDate)} • {selectedExam.schedule}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Exam Type
            </label>
            <select
              value={formData.examType}
              onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
              disabled /* the term is set by the date */
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-700"
            >
              {(drawerPeriod?.kind === "term" ? [drawerPeriod.term] : EXAM_TYPES).map((type) => (
                <option key={type} value={type}>
                  {TERM_LABELS[type] || type}
                </option>
              ))}
            </select>
            {drawerPeriod?.kind === "term" && (
              <p className="mt-1.5 text-xs text-gray-500">
                Set by the date: {drawerPeriod.monthName} is the {TERM_LABELS[drawerPeriod.term]} period ({drawerPeriod.semester}).
              </p>
            )}
            {drawerPeriod?.kind === "none" && (
              <p role="alert" className="mt-1.5 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">
                {drawerPeriod.monthName} has no exam period. 1st Semester exams run September to December; 2nd Semester exams run January to April.
              </p>
            )}
            {termCorrected && (
              <p role="status" className="mt-1.5 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">
                This exam was saved as {TERM_LABELS[selectedExam.examType] || selectedExam.examType}, which does not match its date. Saving will change it to {TERM_LABELS[drawerPeriod.term]}.
              </p>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 block text-sm font-semibold text-gray-700">Exam kind</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {[
                { value: "Regular", hint: "Within the 4-day exam period" },
                { value: "Special", hint: "Make-up, after the period" },
              ].map((option) => (
                <label key={option.value}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${formData.examKind === option.value
                    ? "border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                  <input type="radio" name="examKind" value={option.value} className="sr-only"
                    checked={formData.examKind === option.value}
                    onChange={() => setFormData({ ...formData, examKind: option.value })} />
                  <span className="block font-bold">{option.value}</span>
                  <span className="block text-[11px] text-gray-500">{option.hint}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-600" aria-live="polite">
              {drawerExamPeriod
                ? <>{TERM_LABELS[formData.examType]} exam period: <strong>{rangeText(drawerExamPeriod)}</strong> (4 days from the first exam). Special exams: from <strong>{shortDate(drawerExamPeriod.specialFrom)}</strong>.</>
                : <>No regular {TERM_LABELS[formData.examType]} exam yet. {formData.examKind === "Regular" ? "This exam starts the 4-day period (this date is day 1)." : "Add the regular exams first; Special exams come after the 4-day period."}</>}
            </p>
          </fieldset>

          <div>
            <label htmlFor="exam-subject" className="block text-sm font-semibold text-gray-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              id="exam-subject"
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="e.g., Mathematics 101"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label htmlFor="exam-subject-code" className="block text-sm font-semibold text-gray-700 mb-2">
              Subject Code <span className="text-red-500">*</span>
            </label>
            <input
              id="exam-subject-code"
              type="text"
              value={formData.subjectCode}
              onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })}
              placeholder="e.g., MATH101"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Picked (start/end) or typed manually; the schedule text is what everyone sees. */}
          <ExamTimeInput key={`${drawerMode}-${selectedExam?._id || "new"}-${showDrawer}`} value={formData}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))} />

          <div>
            <label htmlFor="exam-capacity" className="block text-sm font-semibold text-gray-700 mb-2">
              Capacity <span className="text-red-500">*</span>
            </label>
            <input
              id="exam-capacity"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              placeholder="e.g., 50"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label htmlFor="exam-course" className="block text-sm font-semibold text-gray-700 mb-2">
              Course <span className="text-red-500">*</span>
            </label>
            <select
              id="exam-course"
              value={formData.course}
              onChange={(e) => setFormData({ ...formData, course: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Select course...</option>
              {formData.course && !myActiveCourses.some((item) => item.code === formData.course) && (
                <option value={formData.course} disabled>{formData.course} (not in your department)</option>
              )}
              {myActiveCourses.map((item) => (
                <option key={item.code} value={item.code}>{item.code} - {item.name}</option>
              ))}
            </select>
            {drawerMode === "edit" && !selectedExam?.course && (
              <p className="mt-1 text-xs text-amber-700">This exam was created before courses were required. Choose its course.</p>
            )}
          </div>

          <div>
            <label htmlFor="exam-course-year" className="block text-sm font-semibold text-gray-700 mb-2">
              Course Year <span className="text-red-500">*</span>
            </label>
            <select
              id="exam-course-year"
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

          <ExamSectionsEditor sections={sections} onChange={setSections} teachers={teachers}
            course={formData.course} courseYear={formData.courseYear} disabled={actionLoading} />

          {drawerMode === "edit" && selectedExam && !(selectedExam.sections?.length > 0) && (selectedExam.proctorName || selectedExam.courseSection) && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              This exam was saved before sections{selectedExam.courseSection ? ` (section "${selectedExam.courseSection}")` : ""}{selectedExam.proctorName ? ` with ${selectedExam.proctorName} as proctor` : ""}. Add its sections above; saving replaces the old setting.
            </p>
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
              disabled={actionLoading || drawerPeriod?.kind === "none"}
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
