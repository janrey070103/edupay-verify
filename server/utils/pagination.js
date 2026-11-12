const MAX_LIMIT = 100;

const toPositiveInt = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

// Read page/limit from the query string with an upper bound so a client cannot
// ask for the whole collection by accident.
const readPaging = (query = {}, { limit = 10 } = {}) => {
  const page = toPositiveInt(query.page, 1);
  const size = Math.min(MAX_LIMIT, toPositiveInt(query.limit, limit));
  return { page, limit: size, skip: (page - 1) * size };
};

// Only whitelisted fields may be sorted. `_id` is always the tie-breaker so
// two rows sharing a timestamp can never appear on two pages.
const readSort = (query = {}, allowedFields = [], fallbackField = "createdAt", fallbackOrder = "desc") => {
  const field = allowedFields.includes(query.sort) ? query.sort : fallbackField;
  const order = ["asc", "desc"].includes(query.order) ? query.order : fallbackOrder;
  const direction = order === "asc" ? 1 : -1;
  return { [field]: direction, _id: direction };
};

const paginate = async (Model, filter, { page, limit, skip }, sort, { select, collation } = {}) => {
  const find = Model.find(filter);
  if (select) find.select(select);
  if (collation) find.collation(collation);
  const [data, total] = await Promise.all([
    find.sort(sort).skip(skip).limit(limit).lean(),
    Model.countDocuments(filter),
  ]);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
};

const escapeRegex = (value) => String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Dates are filtered on whole Philippine calendar days so a client in any
// timezone gets the same rows the cashier sees.
const parseManilaDay = (value, endOfDay) => {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const readDateRange = (query = {}) => {
  const from = parseManilaDay(query.from, false);
  const to = parseManilaDay(query.to, true);
  if (!from && !to) return null;
  return { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
};

module.exports = { MAX_LIMIT, readPaging, readSort, paginate, escapeRegex, readDateRange };
