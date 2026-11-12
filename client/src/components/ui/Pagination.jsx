const LIMIT_OPTIONS = [10, 25, 50];

const pageWindow = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push("start-gap");
  for (let number = start; number <= end; number += 1) pages.push(number);
  if (end < totalPages - 1) pages.push("end-gap");
  pages.push(totalPages);
  return pages;
};

const Pagination = ({ meta, onPageChange, onLimitChange, limitOptions = LIMIT_OPTIONS, fetching = false }) => {
  const { page = 1, limit = 10, total = 0, totalPages = 1 } = meta || {};
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(total, page * limit);
  const buttonBase = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:cursor-not-allowed disabled:opacity-40";
  const idle = "border-gray-200 bg-white text-gray-600 hover:bg-gray-50";
  const active = "border-sti-blue bg-sti-blue text-white shadow-[0_4px_14px_rgba(0,61,165,0.25)]";

  const limitSelect = onLimitChange && (
    <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">
      <span className="sr-only">Rows per page</span>
      <select
        value={limit}
        onChange={(event) => onLimitChange(Number(event.target.value))}
        className="min-h-11 rounded-lg border border-gray-200 bg-white px-2 text-sm font-semibold text-gray-700 focus:border-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
      >
        {limitOptions.map((option) => <option key={option} value={option}>{option} / page</option>)}
      </select>
    </label>
  );

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)] print:hidden sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-gray-500" aria-live="polite">
          {total === 0 ? "No records" : <>Showing {first}&ndash;{last} of {total}</>}
          {fetching && <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">Updating…</span>}
        </p>
        {/* Phones: rows-per-page sits beside the count so the controls row stays uncluttered */}
        <div className="sm:hidden">{limitSelect}</div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <div className="hidden sm:block">{limitSelect}</div>

        {/* Phones: full-width First / Prev / page / Next / Last */}
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            className={`${buttonBase} ${idle} sm:hidden`}
            aria-label="First page"
          >
            <span aria-hidden="true">&laquo;</span>
          </button>

          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={`${buttonBase} ${idle}`}
            aria-label="Previous page"
          >
            <span aria-hidden="true">&larr;</span>
            <span className="ml-1 hidden sm:inline">Prev</span>
          </button>

          <span className="flex-1 text-center text-xs font-bold text-gray-600 sm:hidden">
            Page {page} of {totalPages}
          </span>

          <div className="hidden items-center gap-1 sm:flex">
            {pageWindow(page, totalPages).map((entry) =>
              typeof entry === "number" ? (
                <button
                  key={entry}
                  type="button"
                  onClick={() => onPageChange(entry)}
                  aria-current={entry === page ? "page" : undefined}
                  className={`${buttonBase} ${entry === page ? active : idle}`}
                >
                  {entry}
                </button>
              ) : (
                <span key={entry} className="px-1 text-gray-400" aria-hidden="true">…</span>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={`${buttonBase} ${idle}`}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <span className="ml-1" aria-hidden="true">&rarr;</span>
          </button>

          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            className={`${buttonBase} ${idle} sm:hidden`}
            aria-label="Last page"
          >
            <span aria-hidden="true">&raquo;</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Pagination;
