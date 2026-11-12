import { useState } from "react";
import { scheduleFromTimes } from "../../utils/examTime";

// Exam time: either picked (start + end time pickers, schedule text generated)
// or typed manually (free text for anything unusual, e.g. "After lunch, TBA").
const INPUT = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

/**
 * value: { schedule, startTime, endTime }; onChange(partial) merges into the form.
 * Reports the current mode through onChange({ timeMode }).
 */
const ExamTimeInput = ({ value, onChange }) => {
  const [mode, setMode] = useState(() => (value.startTime && value.endTime ? "picker" : value.schedule ? "manual" : "picker"));

  const switchTo = (next) => {
    setMode(next);
    if (next === "picker") {
      onChange({ timeMode: next, schedule: scheduleFromTimes(value.startTime, value.endTime) });
    } else {
      // Keep what was picked as editable text; times are cleared so they cannot disagree.
      onChange({ timeMode: next, startTime: "", endTime: "" });
    }
  };
  const setTime = (field, time) => {
    const next = { ...value, [field]: time };
    onChange({ [field]: time, timeMode: "picker", schedule: scheduleFromTimes(next.startTime, next.endTime) });
  };

  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-gray-700">
        <span>Exam time <span className="text-red-500">*</span></span>
        <span className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-bold" role="radiogroup" aria-label="How to enter the exam time">
          {[["picker", "Pick time"], ["manual", "Type manually"]].map(([key, label]) => (
            <button key={key} type="button" role="radio" aria-checked={mode === key} onClick={() => mode !== key && switchTo(key)}
              className={`min-h-8 rounded-md px-2.5 transition ${mode === key ? "bg-white text-sti-blue shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {label}
            </button>
          ))}
        </span>
      </legend>

      {mode === "picker" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-gray-500">
              Start
              <input type="time" value={value.startTime || ""} onChange={(e) => setTime("startTime", e.target.value)} className={`mt-1 ${INPUT}`} />
            </label>
            <label className="text-xs font-semibold text-gray-500">
              End
              <input type="time" value={value.endTime || ""} min={value.startTime || undefined}
                onChange={(e) => setTime("endTime", e.target.value)} className={`mt-1 ${INPUT}`} />
            </label>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            {value.startTime && value.endTime
              ? (value.endTime > value.startTime ? <>Shown as <strong>{scheduleFromTimes(value.startTime, value.endTime)}</strong></> : <span className="text-red-600">End time must be after the start time.</span>)
              : "Pick both times."}
          </p>
        </>
      ) : (
        <>
          <input type="text" value={value.schedule || ""} onChange={(e) => onChange({ schedule: e.target.value, timeMode: "manual" })}
            placeholder="e.g., 9:00 AM - 11:00 AM" maxLength={60} className={INPUT} />
          <p className="mt-1.5 text-xs text-gray-500">Use this for times a picker can't express.</p>
        </>
      )}
    </fieldset>
  );
};

export default ExamTimeInput;
