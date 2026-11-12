import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const EMPTY_META = { page: 1, limit: 10, total: 0, totalPages: 1 };

/**
 * Drives a server-paginated list.
 *
 * `fetcher` receives `{ page, limit, sort, order, ...filters }` and must resolve
 * to `{ data, meta }`. Responses are tagged with a sequence number so a slow
 * earlier request can never overwrite a newer page.
 */
export default function usePaginated(
  fetcher,
  { initialLimit = 10, initialFilters = {}, initialSort = "", initialOrder = "asc", enabled = true } = {}
) {
  const [page, setPageState] = useState(1);
  const [limit, setLimitState] = useState(initialLimit);
  const [filters, setFiltersState] = useState(initialFilters);
  const [sort, setSort] = useState(initialSort);
  const [order, setOrder] = useState(initialOrder);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ ...EMPTY_META, limit: initialLimit });
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const sequence = useRef(0);
  const filtersKey = JSON.stringify(filters);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) return;
    const id = sequence.current + 1;
    sequence.current = id;
    setFetching(true);
    if (!silent) setError("");

    try {
      const response = await fetcherRef.current({
        page,
        limit,
        ...(sort ? { sort, order } : {}),
        ...filtersRef.current,
      });
      if (id !== sequence.current) return;

      const nextMeta = response?.meta ?? { page, limit, total: 0, totalPages: 1 };
      setRows(Array.isArray(response?.data) ? response.data : []);
      setMeta(nextMeta);
      setError("");
      // A delete/approval on the last page can leave it empty; step back instead
      // of showing "no records" while earlier pages still have rows.
      if (nextMeta.totalPages >= 1 && page > nextMeta.totalPages) {
        setPageState(nextMeta.totalPages);
      }
    } catch (err) {
      if (id !== sequence.current) return;
      setError(err?.response?.data?.message || "Could not load data.");
      setRows([]);
      setMeta({ ...EMPTY_META, limit });
    } finally {
      if (id === sequence.current) {
        setFetching(false);
        setLoading(false);
      }
    }
  }, [page, limit, sort, order, filtersKey, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  // Background refresh (polling) keeps the current page and rows on screen.
  const refresh = useCallback(() => load({ silent: true }), [load]);

  const setPage = useCallback((next) => {
    setPageState((current) => {
      const target = typeof next === "function" ? next(current) : next;
      return Math.max(1, Math.min(Number(target) || 1, meta.totalPages || 1));
    });
  }, [meta.totalPages]);

  const setLimit = useCallback((next) => {
    setPageState(1);
    setLimitState(next);
  }, []);

  const setFilter = useCallback((key, value) => {
    setPageState(1);
    setFiltersState((current) => (current[key] === value ? current : { ...current, [key]: value }));
  }, []);

  const setFilters = useCallback((values) => {
    setPageState(1);
    setFiltersState((current) => ({ ...current, ...values }));
  }, []);

  const toggleSort = useCallback((key, defaultOrder = "asc") => {
    setPageState(1);
    if (sort === key) {
      setOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setOrder(defaultOrder);
    }
  }, [sort]);

  // Set field and direction together (used by the sort dropdowns).
  const setSorting = useCallback((key, direction) => {
    setPageState(1);
    setSort(key);
    setOrder(direction);
  }, []);

  // Date-created filter. The list is ordered so the record closest to the
  // chosen date comes first: from a start date, oldest first (counting forward
  // from it); with only an end date, newest first (counting back from it).
  // Clearing the range restores the page's normal order.
  const setDateRange = useCallback(({ from = "", to = "" }) => {
    setPageState(1);
    setFiltersState((current) => ({ ...current, from, to }));
    if (from) { setSort("createdAt"); setOrder("asc"); }
    else if (to) { setSort("createdAt"); setOrder("desc"); }
    else { setSort(initialSort); setOrder(initialOrder); }
  }, [initialSort, initialOrder]);

  return useMemo(() => ({
    rows, meta, page, limit, loading, fetching, error,
    filters, sort, order,
    setPage, setLimit, setFilter, setFilters, toggleSort, setSorting, setDateRange, refresh,
  }), [
    rows, meta, page, limit, loading, fetching, error, filters, sort, order,
    setPage, setLimit, setFilter, setFilters, toggleSort, setSorting, setDateRange, refresh,
  ]);
}
