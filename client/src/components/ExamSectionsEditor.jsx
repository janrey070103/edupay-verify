import ProctorCombobox from "./ui/ProctorCombobox";
import { IconTrash } from "./icons/Icons";
import { emptySection, sectionLetterInput, sectionPrefix } from "../utils/examSections";

const MAX_SECTIONS = 26;
const INPUT = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50";

/**
 * The exam's sections: each is named from the course and year plus one letter
 * (BSIT-1A) and has its own room and proctor, at the exam's date and time.
 */
const ExamSectionsEditor = ({ sections, onChange, teachers, course, courseYear, disabled }) => {
  const prefix = sectionPrefix(course, courseYear);
  const update = (key, patch) => onChange(sections.map((section) => (section.key === key ? { ...section, ...patch } : section)));
  const remove = (key) => onChange(sections.filter((section) => section.key !== key));

  return (
    <fieldset>
      <legend className="block text-sm font-semibold text-gray-700 mb-2">
        Sections &amp; Proctors <span className="text-red-500">*</span>
      </legend>
      {!prefix && (
        <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">
          Choose the Course and Course Year first. Section names are built from them, for example BSIT-1A.
        </p>
      )}

      <ol className="space-y-3">
        {sections.map((section, index) => {
          const name = prefix && section.letter ? `${prefix}${section.letter}` : `Section ${index + 1}`;
          return (
            <li key={section.key} className="rounded-lg border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-800">{name}</p>
                {sections.length > 1 && (
                  <button type="button" onClick={() => remove(section.key)} disabled={disabled}
                    aria-label={`Remove ${name}`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-60">
                    <IconTrash className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${section.key}-letter`} className="block text-sm font-semibold text-gray-700 mb-2">
                    Section <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-stretch">
                    <span className="inline-flex min-h-11 items-center rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700">
                      {prefix ? `${prefix}` : "—"}
                    </span>
                    <input id={`${section.key}-letter`} type="text" inputMode="text" autoComplete="off" maxLength={1}
                      value={section.letter} disabled={disabled || !prefix}
                      onChange={(e) => update(section.key, { letter: sectionLetterInput(e.target.value) })}
                      aria-label={`Section letter${prefix ? ` after ${prefix}` : ""}`}
                      className="min-h-11 w-16 rounded-r-lg border border-gray-200 px-3 text-center text-sm font-bold uppercase focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50" />
                  </div>
                </div>
                <div>
                  <label htmlFor={`${section.key}-room`} className="block text-sm font-semibold text-gray-700 mb-2">
                    Room <span className="text-red-500">*</span>
                  </label>
                  <input id={`${section.key}-room`} type="text" maxLength={40} value={section.room} disabled={disabled}
                    onChange={(e) => update(section.key, { room: e.target.value })} placeholder="e.g. Room 201" className={INPUT} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`${section.key}-proctor`} className="block text-sm font-semibold text-gray-700 mb-2">
                    Proctor (Teacher) <span className="text-red-500">*</span>
                  </label>
                  <ProctorCombobox id={`${section.key}-proctor`} teachers={teachers} value={section.proctorId}
                    onChange={(proctorId) => update(section.key, { proctorId })} disabled={disabled} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <button type="button" onClick={() => onChange([...sections, emptySection()])}
        disabled={disabled || sections.length >= MAX_SECTIONS}
        className="mt-3 min-h-11 w-full rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 text-sm font-bold text-sti-blue hover:bg-blue-100 disabled:opacity-60">
        + Add section
      </button>
    </fieldset>
  );
};

export default ExamSectionsEditor;
