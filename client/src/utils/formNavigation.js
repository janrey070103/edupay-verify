export const focusField = (form, fieldId) => {
  const field = form?.querySelector(`#${fieldId}`);
  if (!field) return false;
  field.scrollIntoView({ behavior: "smooth", block: "center" });
  field.focus({ preventScroll: true });
  return true;
};

export const focusFirstInvalid = (form) => {
  const field = form?.querySelector(":invalid");
  if (!field) return false;
  field.scrollIntoView({ behavior: "smooth", block: "center" });
  field.focus({ preventScroll: true });
  return true;
};
