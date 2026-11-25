/** Small DOM and formatting helpers. Everything here inserts text as text, never as HTML. */

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Create an element. Strings become text nodes, so user input is always safe.
 * h("button", { class: "btn", onclick: fn, dataset: { id: 1 } }, "Label")
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
    else if (["checked", "value", "disabled", "selected", "open"].includes(key)) el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const child of [children].flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

export function icon(name, extra = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", `icon ${extra}`.trim());
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `assets/icons/sprite.svg#${name}`);
  svg.append(use);
  return svg;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function debounce(fn, wait = 140) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function uid(prefix = "x") {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Trim, collapse whitespace, drop control characters and limit the length of user text. */
export function cleanText(value, max = 120) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const percent = (done, total) => (total ? Math.round((done / total) * 100) : 0);

/** Parse YYYY-MM-DD as a local date. Returns null when it is not a real date. */
export function parseDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}

export function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
export const daysBetween = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);

export function formatDate(date, options = { day: "numeric", month: "short", year: "numeric" }) {
  return date ? new Intl.DateTimeFormat(undefined, options).format(date) : "";
}

/** Return a fragment of text with the given terms wrapped in <mark>. */
export function highlight(text, terms) {
  const fragment = document.createDocumentFragment();
  const safe = (terms || []).filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!safe.length) {
    fragment.append(text);
    return fragment;
  }
  for (const part of text.split(new RegExp(`(${safe.join("|")})`, "gi"))) {
    if (!part) continue;
    fragment.append(safe.some((t) => new RegExp(`^${t}$`, "i").test(part)) ? h("mark", {}, part) : part);
  }
  return fragment;
}

let liveRegion;
/** Tell screen readers about a change that is not otherwise announced. */
export function announce(message) {
  if (!liveRegion) {
    liveRegion = h("div", { class: "visually-hidden", role: "status", "aria-live": "polite" });
    document.body.append(liveRegion);
  }
  liveRegion.textContent = "";
  setTimeout(() => (liveRegion.textContent = message), 60);
}

export const params = () => new URLSearchParams(location.search);

/** Replace the query string without adding a history entry. */
export function setParams(values) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v) next.set(k, v);
  const query = next.toString();
  history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
}

export function replace(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

/** Turn a stored contact into a tel: or mailto: link, or null when it is neither. */
export function contactHref(value) {
  const text = cleanText(value);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return `mailto:${text}`;
  const digits = text.replace(/[^\d+*#]/g, "");
  return /^\+?[\d*#]{2,18}$/.test(digits) && /^[\d+\s().*#-]+$/.test(text) ? `tel:${digits}` : null;
}
