const cardBase =
  "rounded-xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)]";

const StatCard = ({
  label,
  value,
  valueClassName = "text-sti-blue",
  variant = "centered",
  icon: Icon,
  iconClassName = "bg-blue-50 text-sti-blue",
  subLabel,
  subLabelClassName = "text-sti-blue bg-blue-50",
  loading = false,
}) => {
  if (variant === "icon" && Icon) {
    return (
      <div className={`${cardBase} flex items-start justify-between`}>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">
            {label}
          </p>
          {loading ? (
            <div className="mt-1 h-9 w-20 animate-pulse rounded bg-gray-200" aria-hidden="true" />
          ) : (
            <p className={`text-3xl font-black ${valueClassName}`}>
              {value}
            </p>
          )}
          {subLabel && !loading && (
            <span
              className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${subLabelClassName}`}
            >
              {subLabel}
            </span>
          )}
        </div>
        <div className={`shrink-0 rounded-lg p-3 ${iconClassName}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardBase} flex flex-col items-center text-center`}>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
        {label}
      </p>
      {loading ? (
        <div className="h-9 w-16 animate-pulse rounded bg-gray-200" aria-hidden="true" />
      ) : (
        <p className={`text-3xl font-black ${valueClassName}`}>
          {value}
        </p>
      )}
    </div>
  );
};

export default StatCard;
