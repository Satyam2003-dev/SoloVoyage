/** Packing list and document status. No document numbers, scans or identity details are ever requested. */
import { addTaskForm, confirmDialog, progressBar, taskRow, toast } from "../components.js";
import { getGuides, guideUrl } from "../data.js";
import { DOCUMENTS, PACKING_CATEGORIES, starterPacking, STATUS_LABELS } from "../packing-data.js";
import * as storage from "../storage.js";
import { $, $$, announce, h, icon, percent, plural, uid } from "../utils.js";

export async function init() {
  const mount = $("[data-app]");
  const guides = await getGuides();

  /* The starter list is shown straight away but only saved once something changes. */
  const items = () => storage.get("packing")?.items ?? starterPacking();
  const save = (next) => storage.set("packing", { items: next });

  /* ---------- Packing ---------- */
  const packLabel = h("p", { class: "panel-title tnum" });
  const packBar = progressBar(0, "Packing progress");
  const ui = new Map();

  function paintPacking() {
    const all = items();
    const done = all.filter((i) => i.done).length;
    packBar.update(percent(done, all.length));
    packLabel.textContent = all.length ? `${done} of ${plural(all.length, "item")} packed` : "Your list is empty";
    for (const c of PACKING_CATEGORIES) {
      const list = all.filter((i) => i.group === c.id);
      ui.get(c.id).count.textContent = `${list.filter((i) => i.done).length}/${list.length}`;
    }
  }

  function renderCategory(c) {
    const list = items().filter((i) => i.group === c.id);
    ui.get(c.id).list.replaceChildren(
      ...list.map((item) =>
        taskRow({
          title: item.title,
          qty: item.qty,
          showQty: true,
          done: item.done,
          onToggle: (done) => {
            save(items().map((i) => (i.id === item.id ? { ...i, done } : i)));
            paintPacking();
            announce(packLabel.textContent);
          },
          onSave: ({ title, qty }) => {
            save(items().map((i) => (i.id === item.id ? { ...i, title, qty } : i)));
            paintPacking();
          },
          onDelete: () => {
            const before = items();
            save(before.filter((i) => i.id !== item.id));
            renderCategory(c);
            paintPacking();
            $("input.input", ui.get(c.id).root)?.focus({ preventScroll: true });
            toast(`Removed “${item.title}”.`, { iconName: "trash-2", actionLabel: "Undo", action: () => (save(before), renderPacking()) });
          },
        })
      )
    );
    if (!list.length) ui.get(c.id).list.append(h("li", { class: "muted small", style: "padding:.75rem 0" }, "Nothing here. Add what you need below."));
  }

  function renderPacking() {
    PACKING_CATEGORIES.forEach(renderCategory);
    paintPacking();
  }

  const categories = PACKING_CATEGORIES.map((c) => {
    const count = h("span", { class: "badge tnum" });
    const list = h("ul", { class: "tasks" });
    const root = h(
      "section",
      { class: "panel", "aria-labelledby": `pk-${c.id}` },
      h("div", { class: "panel__head" }, h("h2", { id: `pk-${c.id}`, class: "row", style: "gap:.6rem" }, icon(c.icon), c.name), count),
      list,
      addTaskForm({
        label: `Add an item to ${c.name}`,
        placeholder: "Add an item",
        showQty: true,
        onAdd: (title, qty) => {
          save([...items(), { id: uid("p"), group: c.id, title, qty, done: false, custom: true }]);
          renderCategory(c);
          paintPacking();
          announce(`Added ${title}.`);
        },
      })
    );
    ui.set(c.id, { count, list, root });
    return root;
  });

  const unpack = () => {
    const before = items();
    save(before.map((i) => ({ ...i, done: false })));
    renderPacking();
    toast("All items unticked.", { iconName: "rotate-ccw", actionLabel: "Undo", action: () => (save(before), renderPacking()) });
  };
  const restore = async () => {
    if (!(await confirmDialog({ title: "Restore the starter list?", text: "Your own items, edits and ticks will be replaced by the starter list.", confirm: "Restore", danger: true }))) return;
    const before = items();
    save(starterPacking());
    renderPacking();
    toast("Starter list restored.", { iconName: "rotate-ccw", actionLabel: "Undo", action: () => (save(before), renderPacking()) });
  };

  const packingPanel = h(
    "div",
    { role: "tabpanel", id: "panel-packing", "aria-labelledby": "tab-packing", class: "stack-lg" },
    h("div", { class: "panel stack-sm" }, packLabel, packBar, h("div", { class: "row no-print", style: "margin-top:1rem" }, h("button", { type: "button", class: "btn btn--secondary btn--sm", onclick: () => print() }, icon("printer"), "Print"), h("button", { type: "button", class: "btn btn--secondary btn--sm", onclick: unpack }, "Untick all"), h("button", { type: "button", class: "btn btn--danger btn--sm", onclick: restore }, icon("rotate-ccw"), "Starter list"))),
    h("div", { class: "masonry" }, categories)
  );

  /* ---------- Documents ---------- */
  const docLabel = h("p", { class: "panel-title tnum" });
  const docBar = progressBar(0, "Documents ready");
  function paintDocs() {
    const status = storage.get("documents");
    const needed = DOCUMENTS.filter((d) => status[d.id] !== "na");
    const ready = needed.filter((d) => status[d.id] === "ready").length;
    docBar.update(percent(ready, needed.length));
    docLabel.textContent = needed.length ? `${ready} of ${needed.length} needed documents ready` : "No documents marked as needed";
    for (const row of $$("[data-doc]", docPanel)) row.dataset.status = status[row.dataset.doc] || "todo";
  }

  const docPanel = h(
    "div",
    { role: "tabpanel", id: "panel-documents", "aria-labelledby": "tab-documents", class: "stack-lg" },
    h("div", { class: "callout callout--warning" }, icon("lock"), h("div", {}, h("strong", {}, "Track status only. Never type document details here."), "SoloVoyage does not ask for passport numbers, scans, card details or identity information, and has no field for them.")),
    h("div", { class: "panel stack-sm" }, docLabel, docBar),
    h(
      "ul",
      { class: "panel doc-list" },
      DOCUMENTS.map((d) => {
        const select = h(
          "select",
          {
            class: "select",
            id: `doc-${d.id}`,
            onchange: (e) => {
              storage.update("documents", (s) => ({ ...s, [d.id]: e.target.value }));
              paintDocs();
              announce(`${d.name}: ${STATUS_LABELS[e.target.value]}. ${docLabel.textContent}.`);
            },
          },
          Object.entries(STATUS_LABELS).map(([v, label]) => h("option", { value: v, selected: (storage.get("documents")[d.id] || "todo") === v }, label))
        );
        const guide = guides.byId.get(d.guide);
        return h("li", { class: "doc", dataset: { doc: d.id } }, h("div", {}, h("label", { for: `doc-${d.id}`, class: "doc__name" }, d.name), h("p", { class: "muted small" }, d.hint, ". ", h("a", { href: guideUrl(guide.id) }, "Read the guide", h("span", { class: "visually-hidden" }, `: ${guide.title}`)))), select);
      })
    )
  );

  /* ---------- Tabs ---------- */
  const TABS = [
    ["packing", "Packing", packingPanel],
    ["documents", "Documents", docPanel],
  ];
  const tabs = h("div", { class: "tabs no-print", role: "tablist", "aria-label": "Organizer" });
  function select(id, focus) {
    for (const [key, , panel] of TABS) {
      const on = key === id;
      const tab = $(`#tab-${key}`, tabs);
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
      if (on && focus) tab.focus();
    }
  }
  for (const [id, label] of TABS) {
    tabs.append(h("button", { type: "button", role: "tab", id: `tab-${id}`, "aria-controls": `panel-${id}`, onclick: () => (history.replaceState(null, "", id === "packing" ? location.pathname : "#documents"), select(id)) }, label));
  }
  tabs.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const at = TABS.findIndex(([id]) => `tab-${id}` === document.activeElement.id);
    const next = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    select(TABS[next][0], true);
  });
  const fromHash = () => select(location.hash === "#documents" ? "documents" : "packing");
  addEventListener("hashchange", fromHash);

  mount.replaceChildren(tabs, packingPanel, docPanel);
  renderPacking();
  paintDocs();
  fromHash();
}
