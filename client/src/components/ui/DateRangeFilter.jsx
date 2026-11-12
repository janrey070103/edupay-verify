// From / to date filter (whole Philippine calendar days on the server).
const INPUT = "min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20";

const DateRangeFilter = ({ from = "", to = "", onChange, label = "Date created" }) => (
  <fieldset className="flex flex-wrap items-end gap-2">
    <legend className="sr-only">{label}</legend>
    <label className="min-w-0 flex-1 text-xs font-semibold text-gray-500 sm:flex-none">
      {label} from
      <input type="date" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} className={`mt-1 ${INPUT}`} />
    </label>
    <label className="min-w-0 flex-1 text-xs font-semibold text-gray-500 sm:flex-none">
      to
      <input type="date" value={to} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} className={`mt-1 ${INPUT}`} />
    </label>
    {(from || to) && (
      <button type="button" onClick={() => onChange({ from: "", to: "" })}
        className="min-h-11 rounded-lg px-3 text-sm font-bold text-sti-blue hover:bg-blue-50">
        Clear
      </button>
    )}
  </fieldset>
);

export default DateRangeFilter;
