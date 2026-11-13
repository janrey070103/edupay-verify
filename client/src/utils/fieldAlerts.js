// Missing-field alerts for every form in the app.
//
// - Forms that use the browser's own checks (`required`, `type="email"`...):
//   every invalid field is outlined in red when the form is submitted.
// - Forms that check in code: call markMissing() with the fields that are
//   empty; they get the same red outline.
// The outline clears as soon as the person types in or changes that field.

const ATTR = "data-missing";

const mark = (element) => {
  if (!element) return;
  element.setAttribute(ATTR, "true");
  element.setAttribute("aria-invalid", "true");
};

const filled = (element) => (element.type === "checkbox" || element.type === "radio"
  ? element.checked : String(element.value ?? "").trim() !== "");

/** Outlines the given fields (elements, refs or element ids); returns the first one found. */
export const markMissing = (fields) => {
  const elements = fields.map((field) => (typeof field === "string" ? document.getElementById(field) : field?.current || field))
    .filter((element) => element instanceof Element);
  elements.forEach(mark);
  return elements[0] || null;
};

/** Removes every outline inside a form (e.g. when it is reset or reopened). */
export const clearMissing = (root = document) => {
  root.querySelectorAll(`[${ATTR}]`).forEach((element) => {
    element.removeAttribute(ATTR);
    element.removeAttribute("aria-invalid");
  });
};

let installed = false;
/** Called once at start-up. */
export const installFieldAlerts = () => {
  if (installed || typeof document === "undefined") return;
  installed = true;
  // The browser fires "invalid" on each failing field when a form is submitted.
  document.addEventListener("invalid", (event) => mark(event.target), true);
  const clear = (event) => {
    const element = event.target;
    if (element?.hasAttribute?.(ATTR) && filled(element)) {
      element.removeAttribute(ATTR);
      element.removeAttribute("aria-invalid");
    }
  };
  document.addEventListener("input", clear, true);
  document.addEventListener("change", clear, true);
};
