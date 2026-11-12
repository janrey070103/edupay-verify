// Names are stored as separate parts; `name` stays as the derived full name
// ("First Middle Last") because payments, notifications and permits copy it.
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

const NAME_FIELDS = ["firstName", "middleName", "lastName"];

const hasNameParts = (body = {}) => NAME_FIELDS.some((field) => body[field] !== undefined);

const readNameParts = (body = {}, fallback = {}) => {
  const pick = (field) => clean(body[field] !== undefined ? body[field] : fallback[field]);
  return { firstName: pick("firstName"), middleName: pick("middleName"), lastName: pick("lastName") };
};

const validNameParts = ({ firstName, lastName }) => Boolean(firstName && lastName);

const fullName = ({ firstName, middleName, lastName }) =>
  [firstName, middleName, lastName].filter(Boolean).join(" ");

module.exports = { NAME_FIELDS, hasNameParts, readNameParts, validNameParts, fullName };
