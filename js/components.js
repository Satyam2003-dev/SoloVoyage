/** Reusable interface pieces shared by every page. */
import { getCategories, guideNumber, guideUrl, readingMinutes } from "./data.js";
import * as storage from "./storage.js";
import { $, announce, cleanText, h, highlight, icon, percent } from "./utils.js";

/* ---------- Toast ---------- */
let region;
export function toast(message, { action, actionLabel, duration = 4500, iconName = "circle-check" } = {}) {
  if (!region) {
    region = h("div", { class: "toast-region", role: "status", "aria-live": "polite" });
    document.body.append(region);
  }
  const el = h("div", { class: "toast" }, icon(iconName), h("span", {}, message));
  const close = () => el.remove();
  if (action) el.append(h("button", { type: "button", onclick: () => (close(), action()) }, actionLabel));
  region.replaceChildren(el);
  if (duration) setTimeout(close, action ? Math.max(duration, 8000) : duration);
  return close;
}

/* ---------- Dialogs ---------- */
/** Open a modal built from content. Focus is trapped and restored by the native dialog element. */
export function openDialog(content, { label, className = "dialog", onClose } = {}) {
  const dialog = h("dialog", { class: className, "aria-label": label }, content);
  dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
  dialog.addEventListener("close", () => {
    dialog.remove();
    onClose?.(dialog.returnValue);
  });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export function confirmDialog({ title, text, confirm = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    let dialog;
    const body = h(
      "div",
      { class: "dialog__body" },
      h("h2", {}, title),
      h("p", { class: "muted" }, text),
      h(
        "div",
        { class: "dialog__actions" },
        h("button", { type: "button", class: "btn btn--secondary", autofocus: true, onclick: () => dialog.close("no") }, "Cancel"),
        h("button", { type: "button", class: `btn ${danger ? "btn--danger" : "btn--primary"}`, onclick: () => dialog.close("yes") }, confirm)
      )
    );
    dialog = openDialog(body, { label: title, onClose: (value) => resolve(value === "yes") });
  });
}

/* ---------- Progress ---------- */
export function progressBar(value, label) {
  const bar = h("div", { class: "progress", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": label }, h("span"));
  bar.update = (v) => {
    bar.style.setProperty("--value", v);
    bar.setAttribute("aria-valuenow", v);
    bar.classList.toggle("is-complete", v === 100);
  };
  bar.update(value);
  return bar;
}

export function progressRing(value, label) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("aria-hidden", "true");
  for (const cls of ["ring__track", "ring__bar"]) {
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("class", cls);
    for (const [k, v] of [["cx", 50], ["cy", 50], ["r", 45]]) c.setAttribute(k, v);
    svg.append(c);
  }
  const text = h("span", { class: "ring__text", "aria-hidden": "true" });
  const ring = h("div", { class: "ring", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": label }, svg, text);
  ring.update = (v) => {
    ring.style.setProperty("--value", v);
    ring.dataset.value = v;
    ring.setAttribute("aria-valuenow", v);
    ring.classList.toggle("is-complete", v === 100);
    text.textContent = `${v}%`;
  };
  ring.update(value);
  return ring;
}

/* ---------- States ---------- */
export function emptyState({ iconName = "compass", title, text, actions = [], level = "h2" }) {
  return h("div", { class: "empty" }, icon(iconName), h(level, {}, title), h("p", {}, text), actions.length ? h("div", { class: "row" }, actions) : null);
}

export function errorState(retry) {
  return emptyState({
    iconName: "wifi-off",
    title: "This content could not be loaded",
    text: "Check your connection and try again. If you opened the file directly from disk, run the site through a local web server instead.",
    actions: [h("button", { type: "button", class: "btn btn--primary", onclick: retry || (() => location.reload()) }, "Try again")],
  });
}

export const linkButton = (href, label, cls = "btn--primary", iconName) => h("a", { class: `btn ${cls}`, href }, label, iconName ? icon(iconName, "icon--nudge") : null);

export function callout(kind, title, text, iconName) {
  const icons = { info: "info", warning: "triangle-alert", error: "circle-alert", success: "circle-check" };
  return h("div", { class: `callout callout--${kind}` }, icon(iconName || icons[kind]), h("div", {}, title ? h("strong", {}, title) : null, text));
}

/* ---------- Bookmarks and sharing ---------- */
export function bookmarkButton(guide, { full = false } = {}) {
  const button = h("button", { type: "button", class: full ? "btn btn--secondary" : "icon-btn" });
  const paint = () => {
    const on = storage.isBookmarked(guide.id);
    button.setAttribute("aria-pressed", String(on));
    if (full) button.replaceChildren(icon(on ? "bookmark-check" : "bookmark"), on ? "Saved" : "Save guide");
    else {
      button.setAttribute("aria-label", `Save “${guide.title}”`);
      button.replaceChildren(icon(on ? "bookmark-check" : "bookmark"));
    }
  };
  button.addEventListener("click", () => {
    const on = storage.toggleBookmark(guide.id);
    paint();
    toast(on ? "Saved to your library." : "Removed from your library.", {
      iconName: on ? "bookmark-check" : "bookmark",
      actionLabel: on ? "View library" : "Undo",
      action: on
        ? () => (location.href = "bookmarks.html")
        : () => {
            if (!storage.isBookmarked(guide.id)) storage.toggleBookmark(guide.id);
            paint();
          },
    });
  });
  storage.subscribe("bookmarks", paint);
  paint();
  return button;
}

/** Share with the system sheet when there is one, otherwise copy the link. */
export async function share({ title, text, url = location.href }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied to your clipboard.", { iconName: "link" });
  } catch {
    openDialog(
      (() => {
        const input = h("input", { class: "input", value: url, readonly: true, "aria-label": "Link to this guide", onfocus: (e) => e.target.select() });
        return h("div", { class: "dialog__body stack" }, h("h2", {}, "Copy this link"), input, h("form", { method: "dialog", class: "dialog__actions" }, h("button", { class: "btn btn--primary" }, "Done")));
      })(),
      { label: "Copy this link" }
    );
  }
}

/* ---------- Guide card ---------- */
export async function guideCards(guides, { terms = [], level = "h3" } = {}) {
  const { byId } = await getCategories();
  return guides.map((guide) => {
    const minutes = readingMinutes(guide);
    return h(
      "article",
      { class: "guide-card", dataset: { id: guide.id } },
      h("div", { class: "guide-card__top" }, h("span", { class: "guide-card__num" }, guideNumber(guide)), bookmarkButton(guide)),
      h(level, {}, h("a", { href: guideUrl(guide.id) }, highlight(guide.title, terms))),
      h("p", {}, highlight(guide.summary, terms)),
      h(
        "div",
        { class: "guide-card__meta" },
        h("span", {}, icon(byId.get(guide.category).icon), byId.get(guide.category).name),
        h("span", {}, icon("clock"), `${minutes} min read`),
        storage.isRead(guide.id) ? h("span", {}, icon("check"), "Read") : null
      )
    );
  });
}

/* ---------- Task row (checklist, planner, packing) ---------- */
/**
 * One checkable row.
 * onToggle(done), onSave({ title, qty }), onDelete(). Edit and delete appear only when handlers are given.
 */
export function taskRow({ title, detail, done, link, qty, showQty, onToggle, onSave, onDelete }) {
  const li = h("li");
  const box = h("input", { type: "checkbox", class: "task__check", checked: done, onchange: () => onToggle(box.checked) });
  const view = () => {
    const label = h(
      "label",
      { class: "task__label" },
      box,
      h("span", { class: "task__text" }, h("span", { class: "task__title" }, title, showQty && qty > 1 ? h("span", { class: "muted tnum" }, ` × ${qty}`) : null), detail ? h("span", { class: "task__detail" }, detail) : null)
    );
    const tools = h("div", { class: "task__tools no-print" });
    if (link) tools.append(h("a", { class: "icon-btn", href: link.href, "aria-label": `Read the guide: ${link.title}`, "data-tip": "Read the guide" }, icon("book-open")));
    if (onSave) tools.append(h("button", { type: "button", class: "icon-btn", "aria-label": `Edit “${title}”`, "data-tip": "Edit", onclick: edit }, icon("pencil")));
    if (onDelete) tools.append(h("button", { type: "button", class: "icon-btn icon-btn--danger", "aria-label": `Delete “${title}”`, "data-tip": "Delete", onclick: onDelete }, icon("trash-2")));
    li.replaceChildren(h("div", { class: "task" }, label, tools));
  };
  const edit = () => {
    const input = h("input", { class: "input", value: title, maxlength: 160, "aria-label": "Task name" });
    const amount = showQty ? h("input", { class: "input input--qty", type: "number", min: 1, max: 99, value: qty, "aria-label": "Quantity", style: "flex:0 0 5rem" }) : null;
    const cancel = () => {
      view();
      $('[aria-label^="Edit"]', li)?.focus();
    };
    const form = h(
      "form",
      {
        class: "task-edit",
        onsubmit: (e) => {
          e.preventDefault();
          const next = cleanText(input.value, 160);
          if (!next) {
            input.setAttribute("aria-invalid", "true");
            announce("Enter a name.");
            return input.focus();
          }
          const count = amount ? Math.min(99, Math.max(1, parseInt(amount.value, 10) || 1)) : qty;
          title = next;
          qty = count;
          onSave({ title: next, qty: count });
          cancel();
          announce("Saved.");
        },
        onkeydown: (e) => e.key === "Escape" && (e.stopPropagation(), cancel()),
      },
      input,
      amount,
      h("button", { class: "btn btn--primary btn--sm" }, "Save"),
      h("button", { type: "button", class: "btn btn--secondary btn--sm", onclick: cancel }, "Cancel")
    );
    li.replaceChildren(form);
    input.focus();
    input.select();
  };
  view();
  return li;
}

/** A form that adds a task. onAdd(title, qty) */
export function addTaskForm({ label, placeholder = "Add your own…", showQty = false, onAdd }) {
  const input = h("input", { class: "input", placeholder, maxlength: 160, "aria-label": label, autocomplete: "off" });
  const amount = showQty ? h("input", { class: "input input--qty", type: "number", min: 1, max: 99, value: 1, "aria-label": "Quantity" }) : null;
  return h(
    "form",
    {
      class: "inline-form no-print",
      onsubmit: (e) => {
        e.preventDefault();
        const title = cleanText(input.value, 160);
        if (!title) {
          input.setAttribute("aria-invalid", "true");
          announce("Enter a name first.");
          return input.focus();
        }
        input.removeAttribute("aria-invalid");
        onAdd(title, amount ? Math.min(99, Math.max(1, parseInt(amount.value, 10) || 1)) : 1);
        input.value = "";
        if (amount) amount.value = 1;
      },
    },
    input,
    amount,
    h("button", { class: "btn btn--secondary" }, icon("plus"), "Add")
  );
}

/* ---------- Checklist summary shared by home and dashboard ---------- */
export function checklistStats(data, state) {
  const all = [...data.items.map((i) => ({ id: i.id, group: i.category, title: i.title, detail: i.detail })), ...state.custom];
  const done = all.filter((i) => state.done.includes(i.id)).length;
  return { all, done, total: all.length, value: percent(done, all.length) };
}
