// Shared sort dropdown. Options are { label, sort, order }; the value is
// "sort:order" so one control can mix name and date ordering.
const DATE_SORTS = [
  { label: "Newest first", sort: "createdAt", order: "desc" },
  { label: "Oldest first", sort: "createdAt", order: "asc" },
];

const SortSelect = ({ options = DATE_SORTS, sort, order, onChange, label = "Sort by date created", className = "" }) => {
  const value = `${sort || options[0].sort}:${order || options[0].order}`;
  return (
    <label className={`flex items-center gap-2 text-xs font-semibold text-gray-500 ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          const [nextSort, nextOrder] = event.target.value.split(":");
          onChange(nextSort, nextOrder);
        }}
        className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20 sm:w-auto"
        aria-label={label}
      >
        {options.map((option) => (
          <option key={`${option.sort}:${option.order}`} value={`${option.sort}:${option.order}`}>{option.label}</option>
        ))}
      </select>
    </label>
  );
};

export default SortSelect;
