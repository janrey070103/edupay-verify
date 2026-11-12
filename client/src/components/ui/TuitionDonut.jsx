import { useId, useState } from "react";

// Validated pair (dataviz validator, white surface): CVD ΔE 11.6 deutan,
// normal-vision ΔE 33, both >= 3:1 contrast. Identity never rests on colour
// alone: every slice is also named and valued in the legend and the table.
const LEDGER_COLORS = { paid: "#16a34a", unpaid: "#b42318", tentativeTint: "#f6d5d1" };

const peso = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value) || 0);
const SIZE = 120;
const RADIUS = 46;
const STROKE = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2; // px of surface between slices

/**
 * Donut of paid vs not-paid tuition. Slices: paid (green), awaiting approval
 * (red, striped: still unpaid but on its way), not yet paid (red, solid).
 * Hover or focus a slice / legend row to read it in the centre.
 */
const TuitionDonut = ({ paid, tentative, unpaid, total, centerNote }) => {
  const patternId = `stripes-${useId().replace(/:/g, "")}`;
  const [active, setActive] = useState(null);

  const slices = [
    { key: "paid", label: "Paid", value: paid, stroke: LEDGER_COLORS.paid },
    { key: "tentative", label: "Awaiting approval", value: tentative, stroke: `url(#${patternId})` },
    { key: "unpaid", label: "Not yet paid", value: unpaid, stroke: LEDGER_COLORS.unpaid },
  ];
  const visible = slices.filter((slice) => slice.value > 0);
  const gap = visible.length > 1 ? GAP : 0;

  let offset = 0;
  const arcs = visible.map((slice) => {
    const share = total > 0 ? slice.value / total : 0;
    const length = Math.max(0, share * CIRCUMFERENCE - gap);
    const arc = { ...slice, share, length, offset };
    offset += share * CIRCUMFERENCE;
    return arc;
  });

  const paidPct = total > 0 ? Math.round((paid / total) * 1000) / 10 : 0;
  const focused = arcs.find((arc) => arc.key === active);

  return (
    <figure className="m-0 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90" role="img"
          aria-label={`${paidPct}% of tuition paid: ${peso(paid)} paid, ${peso(tentative)} awaiting approval, ${peso(unpaid)} not yet paid, of ${peso(total)}.`}>
          <defs>
            {/* 45° tone-on-tone lines: the "on its way" texture. */}
            <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={LEDGER_COLORS.tentativeTint} />
              <rect width="3" height="6" fill={LEDGER_COLORS.unpaid} />
            </pattern>
          </defs>
          {/* Track */}
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#f3f4f6" strokeWidth={STROKE} />
          {arcs.map((arc) => (
            <g key={arc.key}>
              <circle
                cx="60" cy="60" r={RADIUS} fill="none"
                stroke={arc.stroke}
                strokeWidth={active === arc.key ? STROKE + 4 : STROKE}
                strokeDasharray={`${arc.length} ${CIRCUMFERENCE}`}
                strokeDashoffset={-arc.offset}
                className="transition-[stroke-dasharray,stroke-dashoffset,stroke-width] duration-700 ease-out motion-reduce:transition-none"
              />
              {/* Wider invisible ring: the hover target is bigger than the mark. */}
              <circle
                cx="60" cy="60" r={RADIUS} fill="none" stroke="transparent" strokeWidth={STROKE + 14}
                strokeDasharray={`${arc.length} ${CIRCUMFERENCE}`} strokeDashoffset={-arc.offset}
                className="cursor-pointer" pointerEvents="stroke"
                onPointerEnter={() => setActive(arc.key)} onPointerLeave={() => setActive(null)}
              />
            </g>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden="true">
          {focused ? (
            <>
              <span className="text-lg font-black text-gray-900">{peso(focused.value)}</span>
              <span className="text-xs font-semibold text-gray-500">{focused.label}</span>
              <span className="text-[11px] text-gray-400">{Math.round(focused.share * 1000) / 10}% of tuition</span>
            </>
          ) : (
            <>
              <span className="text-3xl font-black text-gray-900">{paidPct}%</span>
              <span className="text-xs font-semibold text-gray-500">{centerNote || "paid"}</span>
            </>
          )}
        </div>
      </div>

      <figcaption className="w-full min-w-0">
        <ul className="space-y-1.5">
          {slices.map((slice) => (
            <li key={slice.key}>
              <button
                type="button"
                onFocus={() => setActive(slice.key)} onBlur={() => setActive(null)}
                onMouseEnter={() => setActive(slice.key)} onMouseLeave={() => setActive(null)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-sti-blue/20 ${active === slice.key ? "bg-gray-50" : ""}`}
              >
                <svg width="14" height="14" className="shrink-0 rounded-sm" aria-hidden="true">
                  {slice.key === "tentative" ? (
                    <>
                      <rect width="14" height="14" fill={`url(#${patternId})`} />
                    </>
                  ) : <rect width="14" height="14" fill={slice.stroke} />}
                </svg>
                <span className="flex-1 text-sm text-gray-600">{slice.label}</span>
                <span className="text-sm font-bold text-gray-900">{peso(slice.value)}</span>
                <span className="w-12 text-right text-xs text-gray-400">
                  {total > 0 ? `${Math.round((slice.value / total) * 1000) / 10}%` : "0%"}
                </span>
              </button>
            </li>
          ))}
          <li className="flex items-center gap-3 border-t border-gray-100 px-2 pt-2">
            <span className="w-3.5 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-sm font-semibold text-gray-700">Total tuition</span>
            <span className="text-sm font-black text-gray-900">{peso(total)}</span>
            <span className="w-12" />
          </li>
        </ul>

        {/* Table view of the same numbers for screen readers. */}
        <table className="sr-only">
          <caption>Tuition breakdown</caption>
          <thead><tr><th scope="col">Part</th><th scope="col">Amount</th><th scope="col">Share</th></tr></thead>
          <tbody>
            {slices.map((slice) => (
              <tr key={slice.key}><th scope="row">{slice.label}</th><td>{peso(slice.value)}</td>
                <td>{total > 0 ? `${Math.round((slice.value / total) * 1000) / 10}%` : "0%"}</td></tr>
            ))}
            <tr><th scope="row">Total tuition</th><td>{peso(total)}</td><td>100%</td></tr>
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
};

export default TuitionDonut;
