// Wording helpers so dashboard cards say exactly what a number is made of.
// Non-breaking hyphen keeps "Pre-Final" on one line inside narrow cards.
const TERM_LABELS = { Prelim: "Prelim", Midterm: "Midterm", PreFinal: "Pre‑Final", Final: "Final" };

export const peso = (value) => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP", maximumFractionDigits: 0,
}).format(Number(value) || 0);

/** "Prelim · Midterm" (exam terms the payments cover), or the fallback. */
export const termList = (terms, fallback = "No term selected") =>
  (terms?.length ? terms.map((term) => TERM_LABELS[term] || term).join(" · ") : fallback);

/** "waiting since today" / "oldest waiting 3 days". */
export const waitingSince = (date, now = new Date()) => {
  if (!date) return "";
  const days = Math.floor((now - new Date(date)) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "oldest submitted today";
  return `oldest waiting ${days} day${days === 1 ? "" : "s"}`;
};

/** Merge two status details (e.g. Pending + Need Review) into one. */
export const mergeDetails = (...items) => items.filter(Boolean).reduce((acc, item) => ({
  count: acc.count + (item.count || 0),
  amount: acc.amount + (item.amount || 0),
  noAmount: acc.noAmount + (item.noAmount || 0),
  terms: [...new Set([...acc.terms, ...(item.terms || [])])],
  oldest: !acc.oldest || (item.oldest && new Date(item.oldest) < new Date(acc.oldest)) ? item.oldest || acc.oldest : acc.oldest,
}), { count: 0, amount: 0, noAmount: 0, terms: [], oldest: null });
