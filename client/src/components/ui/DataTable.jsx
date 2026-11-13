import Skeleton from "./Skeleton";

/**
 * One column config drives both presentations:
 *  - `md` and up: a regular table (same markup the app already used)
 *  - below `md`:  bento cards built from the same columns
 *
 * priority: "primary" (card title) | "badge" (top-right) | "meta" (tile grid)
 *           | "detail" (full-width tile) | "action" (card footer buttons)
 */
const TILE = "rounded-lg bg-gray-50/80 px-3 py-2";

const CardSkeleton = () => (
  <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
    <div className="flex items-start justify-between gap-3">
      <div className="w-1/2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-2 h-3 w-2/3" />
      </div>
      <Skeleton className="h-5 w-16 rounded-md" />
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-12 w-full rounded-lg" />)}
    </div>
  </div>
);

const MobileCard = ({ columns, row }) => {
  const primary = columns.filter((column) => column.priority === "primary");
  const badge = columns.filter((column) => column.priority === "badge");
  const meta = columns.filter((column) => column.priority === "meta");
  const detail = columns.filter((column) => column.priority === "detail");
  const actions = columns.filter((column) => column.priority === "action");

  return (
    <li className="rounded-xl border border-gray-100 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {primary.map((column) => <div key={column.key}>{column.render(row)}</div>)}
        </div>
        {badge.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            {badge.map((column) => <div key={column.key}>{column.render(row)}</div>)}
          </div>
        )}
      </div>

      {meta.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {meta.map((column) => (
            <div key={column.key} className={TILE}>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{column.header}</dt>
              <dd className="mt-0.5 wrap-break-word text-[13px] font-semibold text-gray-800">{column.render(row)}</dd>
            </div>
          ))}
        </dl>
      )}

      {detail.map((column) => (
        <div key={column.key} className={`mt-2 ${TILE}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{column.header}</p>
          <div className="mt-0.5 wrap-break-word text-[13px] font-medium text-gray-700">{column.render(row)}</div>
        </div>
      ))}

      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3 [&_button]:flex-1 [&_a]:flex-1">
          {actions.map((column) => (
            <div key={column.key} className="min-w-[calc(50%-0.25rem)] flex-1">
              {column.render(row)}
            </div>
          ))}
        </div>
      )}
    </li>
  );
};

const DataTable = ({
  columns,
  rows = [],
  rowKey = (row) => row._id,
  loading = false,
  fetching = false,
  skeletonRows = 5,
  empty = null,
  onRowClick,
  className = "",
}) => {
  const busy = fetching && rows.length > 0;

  return (
    <div className={`transition-opacity ${busy ? "opacity-60" : ""} ${className}`} aria-busy={fetching}>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] lg:block print:block">
        <div className="overflow-x-auto">
          <table className="w-full table-auto divide-y divide-gray-100">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.headerClass || "px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400"}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <Skeleton variant="table-row" count={skeletonRows} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>{empty}</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`group transition-colors hover:bg-blue-50/30 ${onRowClick ? "cursor-pointer" : ""}`}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={column.cellClass || "px-3 py-2.5 text-sm align-middle wrap-break-word"}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile bento cards (printing always uses the table) */}
      <div className="lg:hidden print:hidden">
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: Math.min(skeletonRows, 4) }).map((_, index) => <CardSkeleton key={index} />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">{empty}</div>
        ) : (
          <ul className="grid gap-3">
            {rows.map((row) => (
              <MobileCard key={rowKey(row)} columns={columns} row={row} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DataTable;
