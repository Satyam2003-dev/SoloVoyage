/** The Full Checklist: 48 built-in actions plus the visitor's own tasks. */
import { addTaskForm, confirmDialog, linkButton, progressBar, progressRing, taskRow, toast } from "../components.js";
import { getChecklist, getGuides, guideUrl } from "../data.js";
import * as storage from "../storage.js";
import { $, announce, h, icon, percent, plural, uid } from "../utils.js";

const PHASES = [
  ["", "All"],
  ["before", "Before you leave"],
  ["daily", "While traveling"],
  ["emergency", "Emergency readiness"],
];
const STATUS = [
  ["", "All tasks"],
  ["todo", "Remaining"],
  ["done", "Completed"],
];

export async function init() {
  const mount = $("[data-app]");
  const [data, guides] = await Promise.all([getChecklist(), getGuides()]);
  let phase = "";
  let status = "";
  const state = () => storage.get("checklist");

  /** Every task in a category, built-in first. */
  const tasksOf = (category, s = state()) => [...data.items.filter((i) => i.category === category), ...s.custom.filter((t) => t.group === category)];

  const ring = progressRing(0, "Overall checklist progress");
  const summary = h("div", { class: "stack-sm" });
  const nav = h("ul", { class: "cat-nav" });
  const sections = h("div", { class: "stack-lg" });
  const celebrate = h("div", { hidden: true, class: "callout callout--success no-print", role: "status" }, icon("circle-check"), h("div", {}, h("strong", {}, "Every task is complete."), "Nicely prepared. Review the list once more just before you travel, since plans change."));
  const bars = new Map();

  function paintProgress() {
    const s = state();
    let done = 0;
    let total = 0;
    for (const c of data.categories) {
      const list = tasksOf(c.id, s);
      const n = list.filter((t) => s.done.includes(t.id)).length;
      done += n;
      total += list.length;
      const ui = bars.get(c.id);
      if (ui) {
        ui.bar.update(percent(n, list.length));
        ui.text.textContent = `${n} of ${list.length}`;
        ui.nav.textContent = `${n}/${list.length}`;
        ui.link.classList.toggle("is-complete", n === list.length);
      }
    }
    ring.update(percent(done, total));
    summary.replaceChildren(h("p", { class: "panel-title tnum" }, `${done} of ${total}`), h("p", { class: "muted small" }, done === 0 ? "Tick your first task to begin." : done === total ? "All complete." : `${plural(total - done, "task")} remaining`));
    celebrate.hidden = done !== total;
    return { done, total };
  }

  function toggle(category, task, on) {
    storage.setChecklistDone(task.id, on);
    const { done, total } = paintProgress();
    const s = state();
    const list = tasksOf(category.id, s);
    announce(`${done} of ${total} complete.`);
    if (on && done === total) toast("Every task is complete.", { iconName: "sparkle" });
    else if (on && list.every((t) => s.done.includes(t.id))) toast(`${category.name} is complete.`, { iconName: "sparkle" });
    if (status) renderList(category);
  }

  function rowFor(category, task, s) {
    const custom = task.custom;
    const guide = guides.byId.get(task.guide);
    return taskRow({
      title: task.title,
      detail: task.detail,
      done: s.done.includes(task.id),
      link: guide && !custom ? { href: guideUrl(guide.id), title: guide.title } : null,
      onToggle: (on) => toggle(category, task, on),
      onSave: custom
        ? ({ title }) =>
            storage.update("checklist", (x) => {
              const t = x.custom.find((y) => y.id === task.id);
              if (t) t.title = title;
              return x;
            })
        : null,
      onDelete: custom
        ? () => {
            const before = state();
            storage.update("checklist", (x) => ({ done: x.done.filter((y) => y !== task.id), custom: x.custom.filter((y) => y.id !== task.id) }));
            renderList(category);
            paintProgress();
            $("input.input", bars.get(category.id).section)?.focus({ preventScroll: true });
            toast(`Deleted “${task.title}”.`, { iconName: "trash-2", actionLabel: "Undo", action: () => (storage.set("checklist", before), renderAll()) });
          }
        : null,
    });
  }

  function renderList(category) {
    const s = state();
    const list = tasksOf(category.id, s).filter((t) => {
      if (phase && t.phase !== phase && !(t.custom && phase === "before")) return false;
      const done = s.done.includes(t.id);
      return !status || (status === "done") === done;
    });
    const ui = bars.get(category.id);
    ui.list.replaceChildren(...list.map((t) => rowFor(category, t, s)));
    if (!list.length) ui.list.append(h("li", { class: "muted small", style: "padding:.75rem 0" }, status === "done" ? "Nothing completed here yet." : status === "todo" ? "Nothing left to do here." : "No tasks in this phase."));
  }

  function renderAll() {
    for (const c of data.categories) renderList(c);
    paintProgress();
  }

  for (const c of data.categories) {
    const text = h("span", { class: "small muted tnum" });
    const bar = progressBar(0, `${c.name} progress`);
    const list = h("ul", { class: "tasks" });
    const navCount = h("span", { class: "tnum" });
    const link = h("a", { href: `#${c.id}` }, icon(c.icon), h("span", {}, c.name), navCount);
    const section = h(
      "section",
      { class: "panel check-section", id: c.id, "aria-labelledby": `${c.id}-t` },
      h("div", { class: "panel__head" }, h("h2", { id: `${c.id}-t`, class: "row", style: "gap:.6rem" }, icon(c.icon), c.name), text),
      bar,
      list,
      addTaskForm({
        label: `Add a task to ${c.name}`,
        placeholder: "Add your own task",
        onAdd: (title) => {
          storage.update("checklist", (s) => ({ ...s, custom: [...s.custom, { id: uid("c"), group: c.id, title, custom: true, done: false }] }));
          renderList(c);
          paintProgress();
          announce(`Added ${title}.`);
        },
      })
    );
    bars.set(c.id, { bar, text, list, nav: navCount, link, section });
    nav.append(h("li", {}, link));
    sections.append(section);
  }

  const group = (label, options, get, set) => {
    const wrap = h("div", { class: "chips chips--scroll", role: "group", "aria-label": label });
    const paint = () =>
      wrap.replaceChildren(
        ...options.map(([id, name]) =>
          h(
            "button",
            {
              type: "button",
              class: "chip",
              "aria-pressed": String(get() === id),
              dataset: { v: id },
              onclick: () => {
                set(id);
                paint();
                $(`[data-v="${id}"]`, wrap).focus({ preventScroll: true });
                renderAll();
              },
            },
            name
          )
        )
      );
    paint();
    return wrap;
  };

  const reset = async () => {
    if (!(await confirmDialog({ title: "Reset all progress?", text: "This unticks every task. Tasks you added yourself stay on the list.", confirm: "Reset progress", danger: true }))) return;
    const before = state();
    storage.update("checklist", (s) => ({ ...s, done: [] }));
    renderAll();
    toast("Progress reset.", { iconName: "rotate-ccw", actionLabel: "Undo", action: () => (storage.set("checklist", before), renderAll()) });
  };

  mount.replaceChildren(
    h(
      "div",
      { class: "tool-layout" },
      h(
        "aside",
        { class: "tool-side", "aria-label": "Progress" },
        h("div", { class: "panel" }, h("div", { class: "row", style: "flex-wrap:nowrap;gap:1.1rem" }, ring, summary)),
        h("nav", { class: "no-print cat-nav-wrap", "aria-label": "Checklist categories" }, nav),
        h("div", { class: "row no-print" }, h("button", { type: "button", class: "btn btn--secondary btn--sm", onclick: () => print() }, icon("printer"), "Print"), h("button", { type: "button", class: "btn btn--danger btn--sm", onclick: reset }, icon("rotate-ccw"), "Reset progress"))
      ),
      h(
        "div",
        { class: "stack-lg" },
        h("div", { class: "stack-sm no-print" }, group("Phase", PHASES, () => phase, (v) => (phase = v)), group("Status", STATUS, () => status, (v) => (status = v))),
        celebrate,
        sections,
        h("p", { class: "row no-print" }, linkButton("planner.html", "Plan a trip", "btn--secondary", "arrow-right"), linkButton("packing.html", "Open the packing list", "btn--secondary", "arrow-right"))
      )
    )
  );
  storage.subscribe("checklist", paintProgress);
  renderAll();
}
