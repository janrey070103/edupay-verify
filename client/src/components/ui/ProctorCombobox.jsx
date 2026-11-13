import { useId, useMemo, useRef, useState } from "react";
import { IconSearch, IconX } from "../icons/Icons";

const teacherLabel = (teacher) => teacher?.name || [teacher?.lastName, teacher?.firstName].filter(Boolean).join(", ") || "Unnamed teacher";

/**
 * Searchable teacher picker: type a name, email or ID, then pick from a short
 * scrollable list (keyboard: ↑ ↓ Enter, Esc to close).
 */
export default function ProctorCombobox({ teachers, value, onChange, disabled = false, id, placeholder = "Search teacher by name, email or ID" }) {
  const listId = useId();
  const inputId = id || `${listId}-input`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef(null);
  const selected = teachers.find((teacher) => teacher._id === value) || null;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teachers;
    return teachers.filter((teacher) => [teacherLabel(teacher), teacher.email, teacher.studentId]
      .some((field) => String(field || "").toLowerCase().includes(needle)));
  }, [teachers, query]);

  const choose = (teacher) => {
    onChange(teacher?._id || "");
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (event.key === "Enter" && open && matches[active]) { event.preventDefault(); choose(matches[active]); }
    else if (event.key === "Escape") { setOpen(false); setQuery(""); }
  };

  // While closed, the box shows the chosen teacher; typing starts a new search.
  const shown = open ? query : selected ? teacherLabel(selected) : "";

  return (
    <div className="relative">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${listId}-${matches[active]._id}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={shown}
          placeholder={selected ? teacherLabel(selected) : placeholder}
          onFocus={() => { setOpen(true); setActive(0); }}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }}
          onKeyDown={onKeyDown}
          onBlur={() => { blurTimer.current = setTimeout(() => { setOpen(false); setQuery(""); }, 120); }}
          className="min-h-11 w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50"
        />
        {selected && !disabled && (
          <button type="button" aria-label="Clear proctor" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(null)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <IconX className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <ul id={listId} role="listbox"
          onMouseDown={() => clearTimeout(blurTimer.current)}
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-gray-500">No teacher matches “{query}”.</li>
          ) : matches.map((teacher, index) => (
            <li key={teacher._id} id={`${listId}-${teacher._id}`} role="option" aria-selected={teacher._id === value}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(teacher)}
              className={`cursor-pointer px-3 py-2 ${index === active ? "bg-blue-50" : ""} ${teacher._id === value ? "font-semibold text-blue-700" : "text-gray-800"}`}>
              <span className="block truncate">{teacherLabel(teacher)}</span>
              <span className="block truncate text-xs text-gray-500">{[teacher.studentId, teacher.email].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-gray-400">{teachers.length} teacher{teachers.length === 1 ? "" : "s"} · type to filter</p>
    </div>
  );
}
