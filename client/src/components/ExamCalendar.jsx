import { useMemo } from "react";
import { dayKey, monthCells } from "../utils/calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Coloured status label used in the calendar, legend and detail cards. */
export const StatusPill = ({ status, meta, small = false }) => {
  const item = meta[status] || Object.values(meta)[0];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-bold ring-1 ring-inset ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"} ${item.pill}`}>
      <item.Icon className={small ? "h-3 w-3" : "h-3.5 w-3.5"} /> {item.label}
    </span>
  );
};

/**
 * Month grid of exams. Controlled: the page owns `month` and `selectedDay`.
 * statusMeta: { [status]: { label, Icon, pill, dot } }.
 */
const ExamCalendar = ({ events, statusMeta, month, onMonthChange, selectedDay, onSelectDay }) => {
  const todayKey = dayKey(new Date());
  const byDay = useMemo(() => {
    const map = new Map();
    events.forEach((event) => { const key = dayKey(event.examDate); map.set(key, [...(map.get(key) || []), event]); });
    return map;
  }, [events]);
  const cells = useMemo(() => monthCells(month), [month]);
  const shift = (delta) => { onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1)); onSelectDay(null); };

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <button type="button" onClick={() => shift(-1)} className="min-h-11 min-w-11 rounded-lg text-lg font-bold text-gray-600 hover:bg-gray-100" aria-label="Previous month">‹</button>
        <div className="text-center">
          <p className="text-base font-bold text-gray-800">{month.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</p>
          <button type="button" onClick={() => { const now = new Date(); onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1)); onSelectDay(todayKey); }}
            className="text-xs font-semibold text-sti-blue hover:underline">Today</button>
        </div>
        <button type="button" onClick={() => shift(1)} className="min-h-11 min-w-11 rounded-lg text-lg font-bold text-gray-600 hover:bg-gray-100" aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-100 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
        {WEEKDAYS.map((day) => <div key={day} className="py-2">{day}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((key, index) => {
          if (!key) return <div key={`pad-${index}`} className="min-h-16 border-b border-r border-gray-50 bg-gray-50/40 sm:min-h-24" />;
          const items = byDay.get(key) || [];
          const isSelected = key === selectedDay;
          return (
            <button key={key} type="button" onClick={() => onSelectDay(isSelected ? null : key)}
              aria-label={`${key}: ${items.length} exam${items.length === 1 ? "" : "s"}`} aria-pressed={isSelected}
              className={`flex min-h-16 flex-col items-start justify-start border-b border-r border-gray-50 p-1 text-left transition sm:min-h-24 sm:p-1.5 ${isSelected ? "bg-blue-50 ring-2 ring-inset ring-sti-blue/40" : "hover:bg-gray-50"}`}>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${key === todayKey ? "bg-sti-blue text-white" : "text-gray-600"}`}>
                {Number(key.slice(8))}
              </span>
              {/* Phones: coloured dots; wider screens: subject pills. */}
              <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                {items.map((event) => <span key={event._id} className={`h-1.5 w-1.5 rounded-full ${statusMeta[event.status]?.dot}`} />)}
              </span>
              <span className="mt-1 hidden w-full space-y-0.5 sm:block">
                {items.slice(0, 2).map((event) => (
                  <span key={event._id} className={`block truncate rounded px-1 py-0.5 text-[10px] font-bold ring-1 ring-inset ${statusMeta[event.status]?.pill}`}>
                    {event.subjectCode}
                  </span>
                ))}
                {items.length > 2 && <span className="block text-[10px] text-gray-500">+{items.length - 2} more</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default ExamCalendar;
