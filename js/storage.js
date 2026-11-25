/**
 * The only module that touches localStorage.
 * Every value is saved as { v: SCHEMA, data } under a solovoyage_ key and is validated on the way in and out,
 * so damaged or outdated data falls back to a safe default instead of breaking a page.
 */
import { cleanText, parseDate } from "./utils.js";

const SCHEMA = 1;
const PREFIX = "solovoyage_";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const list = (v, max = 500) => (Array.isArray(v) ? v.slice(0, max) : []);
const id = (v) => (typeof v === "string" && /^[\w-]{1,80}$/.test(v) ? v : null);
const time = (v) => (Number.isFinite(v) && v > 0 ? v : Date.now());
const oneOf = (v, options, fallback) => (options.includes(v) ? v : fallback);

function idTimes(value, max) {
  const seen = new Set();
  return list(value, max)
    .filter(isObject)
    .map((x) => ({ id: id(x.id), at: time(x.at) }))
    .filter((x) => x.id && !seen.has(x.id) && seen.add(x.id));
}

function task(x) {
  if (!isObject(x) || !id(x.id)) return null;
  const title = cleanText(x.title, 160);
  if (!title) return null;
  return {
    id: x.id,
    group: id(x.group) || "other",
    title,
    done: x.done === true,
    custom: x.custom === true,
    guide: id(x.guide),
    qty: Number.isInteger(x.qty) && x.qty >= 1 && x.qty <= 99 ? x.qty : 1,
  };
}
const tasks = (v) => list(v).map(task).filter(Boolean);

function trip(x) {
  if (!isObject(x) || !id(x.id)) return null;
  const depart = parseDate(x.depart) ? x.depart : "";
  let ret = parseDate(x.ret) ? x.ret : "";
  if (depart && ret && ret < depart) ret = "";
  return {
    id: x.id,
    name: cleanText(x.name, 80),
    destination: cleanText(x.destination, 80),
    depart,
    ret,
    type: cleanText(x.type, 40),
    travelers: Number.isInteger(x.travelers) && x.travelers >= 1 && x.travelers <= 99 ? x.travelers : null,
    tasks: tasks(x.tasks),
    createdAt: time(x.createdAt),
  };
}

export const CONTACT_FIELDS = ["trustedName", "trustedContact", "localNumber", "embassy", "medical", "accommodation"];
export const DOC_STATUSES = ["todo", "progress", "ready", "na"];

/** Every stored key: what it holds (shown on the privacy page), its default and its validator. */
export const STORES = {
  theme: {
    label: "Theme choice",
    initial: () => "system",
    clean: (v) => oneOf(v, ["light", "dark", "system"], "system"),
  },
  bookmarks: { label: "Saved guides", initial: () => [], clean: (v) => idTimes(v, 300) },
  recently_viewed: { label: "Recently viewed guides", initial: () => [], clean: (v) => idTimes(v, 12) },
  read: { label: "Guides marked as read", initial: () => [], clean: (v) => idTimes(v, 300) },
  checklist: {
    label: "Checklist progress and custom tasks",
    initial: () => ({ done: [], custom: [] }),
    clean: (v) => (isObject(v) ? { done: [...new Set(list(v.done).map(id).filter(Boolean))], custom: tasks(v.custom) } : { done: [], custom: [] }),
  },
  trips: {
    label: "Trips and planner tasks",
    initial: () => ({ active: null, trips: [] }),
    clean: (v) => {
      const trips = isObject(v) ? list(v.trips, 20).map(trip).filter(Boolean) : [];
      const active = isObject(v) && trips.some((t) => t.id === v.active) ? v.active : trips[0]?.id || null;
      return { active, trips };
    },
  },
  packing: {
    label: "Packing list",
    initial: () => null,
    clean: (v) => (isObject(v) ? { items: tasks(v.items) } : null),
  },
  documents: {
    label: "Document preparation status (status only, no document details)",
    initial: () => ({}),
    clean: (v) => {
      const out = {};
      if (isObject(v)) for (const [k, s] of Object.entries(v).slice(0, 30)) if (id(k) && DOC_STATUSES.includes(s)) out[k] = s;
      return out;
    },
  },
  contacts: {
    label: "Emergency contacts you entered",
    initial: () => ({}),
    clean: (v) => {
      const out = {};
      if (isObject(v)) for (const f of CONTACT_FIELDS) if (cleanText(v[f], 160)) out[f] = cleanText(v[f], 160);
      return out;
    },
  },
  preferences: {
    label: "Small preferences (dismissed notices, analytics choice)",
    initial: () => ({}),
    clean: (v) => {
      const out = {};
      if (!isObject(v)) return out;
      if (typeof v.announcement === "string") out.announcement = v.announcement.slice(0, 20);
      if (["yes", "no"].includes(v.analytics)) out.analytics = v.analytics;
      return out;
    },
  },
};

const memory = new Map();
const listeners = new Map();

export const available = (() => {
  try {
    const probe = `${PREFIX}probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
})();

const keyOf = (name) => PREFIX + name;

function rawGet(name) {
  if (memory.has(name)) return memory.get(name);
  if (!available) return null;
  try {
    return localStorage.getItem(keyOf(name));
  } catch {
    return null;
  }
}

export function get(name) {
  const store = STORES[name];
  const raw = rawGet(name);
  if (raw === null) return store.initial();
  try {
    const parsed = JSON.parse(raw);
    if (!isObject(parsed) || parsed.v !== SCHEMA) return store.initial();
    return store.clean(parsed.data);
  } catch {
    return store.initial();
  }
}

/** Save a value. Returns false when it could only be kept in memory for this page. */
export function set(name, value) {
  const raw = JSON.stringify({ v: SCHEMA, data: STORES[name].clean(value) });
  let saved = false;
  if (available) {
    try {
      localStorage.setItem(keyOf(name), raw);
      memory.delete(name);
      saved = true;
    } catch {
      saved = false;
    }
  }
  if (!saved) memory.set(name, raw);
  emit(name);
  if (!saved) document.dispatchEvent(new CustomEvent("sv:unsaved"));
  return saved;
}

export function update(name, fn) {
  const value = get(name);
  const next = fn(value);
  return set(name, next === undefined ? value : next);
}

export function remove(name) {
  memory.delete(name);
  try {
    localStorage.removeItem(keyOf(name));
  } catch {
    /* storage blocked: nothing was saved */
  }
  emit(name);
}

export const has = (name) => rawGet(name) !== null;

/** Delete everything SoloVoyage has saved in this browser, including keys from earlier versions. */
export function clearAll() {
  for (const name of Object.keys(STORES)) remove(name);
  for (const legacy of ["sv-done", "sv-check"]) {
    try {
      localStorage.removeItem(legacy);
    } catch {
      /* ignore */
    }
  }
}

export function subscribe(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => listeners.get(name).delete(fn);
}

function emit(name) {
  for (const fn of listeners.get(name) || []) fn(get(name));
}

/* Keep other open tabs in step. A null key means the whole storage area was cleared. */
window.addEventListener("storage", (event) => {
  if (event.key === null) Object.keys(STORES).forEach(emit);
  else if (event.key.startsWith(PREFIX)) {
    const name = event.key.slice(PREFIX.length);
    if (STORES[name]) emit(name);
  }
});

export function exportAll() {
  const data = {};
  for (const name of Object.keys(STORES)) if (has(name)) data[name] = get(name);
  return { app: "SoloVoyage", schema: SCHEMA, exportedAt: new Date().toISOString(), data };
}

/** Restore a backup made by exportAll. Throws a readable error when the file is not one. */
export function importAll(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!isObject(backup) || backup.app !== "SoloVoyage" || backup.schema !== SCHEMA || !isObject(backup.data)) {
    throw new Error("That file is not a SoloVoyage backup.");
  }
  const names = Object.keys(backup.data).filter((name) => Object.hasOwn(STORES, name));
  if (!names.length) throw new Error("The backup does not contain any SoloVoyage data.");
  for (const name of names) set(name, backup.data[name]);
  return names.length;
}

/* ----- Shortcuts used by several pages ----- */
export const isBookmarked = (guideId) => get("bookmarks").some((b) => b.id === guideId);

export function toggleBookmark(guideId) {
  const on = !isBookmarked(guideId);
  update("bookmarks", (items) => (on ? [{ id: guideId, at: Date.now() }, ...items] : items.filter((b) => b.id !== guideId)));
  return on;
}

export const isRead = (guideId) => get("read").some((b) => b.id === guideId);

export function toggleRead(guideId) {
  const on = !isRead(guideId);
  update("read", (items) => (on ? [{ id: guideId, at: Date.now() }, ...items] : items.filter((b) => b.id !== guideId)));
  return on;
}

export function addRecent(guideId) {
  update("recently_viewed", (items) => [{ id: guideId, at: Date.now() }, ...items.filter((r) => r.id !== guideId)].slice(0, 12));
}

export function setChecklistDone(itemId, done) {
  update("checklist", (state) => {
    state.done = state.done.filter((x) => x !== itemId);
    if (done) state.done.push(itemId);
    return state;
  });
}

export const activeTrip = () => {
  const { active, trips } = get("trips");
  return trips.find((t) => t.id === active) || null;
};
