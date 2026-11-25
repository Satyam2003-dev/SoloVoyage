/** Trip planner: trip details, six preparation stages and a summary. Nothing is booked or verified. */
import { addTaskForm, bookmarkButton, confirmDialog, openDialog, progressBar, progressRing, taskRow, toast } from "../components.js";
import { getGuides, guideUrl } from "../data.js";
import * as storage from "../storage.js";
import { defaultTasks, milestones, newTrip, STAGES, TRIP_TYPES, tripProgress, tripTiming, tripTitle } from "../trip.js";
import { $, announce, cleanText, formatDate, h, icon, parseDate, percent, plural, uid } from "../utils.js";

/** The trip details form, used both to create a trip and to edit it. */
function tripForm(trip, { submitLabel, onSubmit, onCancel }) {
  const field = (id, label, control, hint) => h("div", { class: "field" }, h("label", { for: id }, label), control, hint ? h("span", { class: "field__hint" }, hint) : null);
  const text = (id, value, placeholder) => h("input", { class: "input", id, value: value || "", maxlength: 80, placeholder, autocomplete: "off" });
  const name = text("t-name", trip?.name, "For example, Spring in Kerala");
  const destination = text("t-destination", trip?.destination, "City or country");
  const depart = h("input", { class: "input", type: "date", id: "t-depart", value: trip?.depart || "" });
  const ret = h("input", { class: "input", type: "date", id: "t-return", value: trip?.ret || "" });
  const type = h("select", { class: "select", id: "t-type" }, h("option", { value: "" }, "Not specified"), TRIP_TYPES.map((t) => h("option", { value: t, selected: trip?.type === t }, t)));
  const travelers = h("input", { class: "input", type: "number", id: "t-travelers", min: 1, max: 99, inputmode: "numeric", value: trip?.travelers ?? "", placeholder: "1" });
  const error = h("p", { class: "field__error span-2", id: "t-error", role: "alert", hidden: true });

  const fail = (control, message) => {
    error.replaceChildren(icon("circle-alert"), message);
    error.hidden = false;
    control.setAttribute("aria-invalid", "true");
    control.setAttribute("aria-describedby", "t-error");
    control.focus();
  };

  const form = h(
    "form",
    {
      class: "form-grid",
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        error.hidden = true;
        for (const c of [depart, ret, travelers]) {
          c.removeAttribute("aria-invalid");
          c.removeAttribute("aria-describedby");
        }
        for (const c of [depart, ret]) {
          if (c.validity.badInput || (c.value && !parseDate(c.value))) return fail(c, "Enter a complete, real date, or leave it empty.");
        }
        if (depart.value && ret.value && ret.value < depart.value) return fail(ret, "The return date cannot be before the departure date.");
        const n = travelers.value === "" ? null : Number(travelers.value);
        if (travelers.validity.badInput || (n !== null && (!Number.isInteger(n) || n < 1 || n > 99))) return fail(travelers, "Travelers must be a whole number from 1 to 99.");
        onSubmit({ name: cleanText(name.value, 80), destination: cleanText(destination.value, 80), depart: depart.value, ret: ret.value, type: type.value, travelers: n });
      },
    },
    field("t-name", "Trip name", name),
    field("t-destination", "Destination", destination),
    field("t-depart", "Departure date", depart),
    field("t-return", "Return date", ret),
    field("t-type", "Travel type", type),
    field("t-travelers", "Number of travelers", travelers),
    error,
    h("div", { class: "row span-2" }, h("button", { class: "btn btn--primary" }, submitLabel), onCancel ? h("button", { type: "button", class: "btn btn--secondary", onclick: onCancel }, "Cancel") : null)
  );
  return form;
}

export async function init() {
  const mount = $("[data-app]");
  const guides = await getGuides();
  let filter = "";
  const open = new Set();
  let openFor = null;

  const data = () => storage.get("trips");
  const current = () => storage.activeTrip();
  const edit = (fn) =>
    storage.update("trips", (d) => {
      const trip = d.trips.find((t) => t.id === d.active);
      if (trip) fn(trip, d);
      return d;
    });

  function create(details) {
    const trip = newTrip(details);
    storage.update("trips", (d) => ({ active: trip.id, trips: [...d.trips, trip] }));
    render();
    $("#trip-title")?.focus();
    announce("Trip created.");
  }

  function dialogForm(title, trip, submitLabel, onSubmit) {
    let dialog;
    dialog = openDialog(
      h("div", { class: "dialog__body" }, h("h2", {}, title), tripForm(trip, { submitLabel, onCancel: () => dialog.close(), onSubmit: (v) => (dialog.close(), onSubmit(v)) })),
      { label: title }
    );
  }

  /* ---------- Empty state ---------- */
  function renderStart() {
    mount.replaceChildren(
      h(
        "div",
        { class: "split" },
        h("section", { class: "panel" }, h("h2", { class: "panel-title", style: "margin-bottom:.35rem" }, "Set up your trip"), h("p", { class: "muted small", style: "margin-bottom:1.25rem" }, "Every field is optional. Details stay in this browser, and nothing is booked or verified."), tripForm(null, { submitLabel: "Create my plan", onSubmit: create })),
        h("section", { class: "stack" }, h("h2", { class: "panel-title" }, "What you get"), h("ol", { class: "stage-list" }, STAGES.map((s) => h("li", {}, icon(s.icon), h("div", {}, h("strong", {}, s.name), h("span", { class: "muted small" }, `${s.when} · ${s.tasks.length} starter tasks`))))))
      )
    );
  }

  /* ---------- Dashboard for the active trip ---------- */
  const live = {};

  function paintSummary() {
    const trip = current();
    const p = tripProgress(trip);
    live.ring.update(p.value);
    live.count.textContent = p.total ? `${p.done} of ${p.total} tasks done` : "No tasks yet";
    live.left.textContent = p.total === 0 ? "Add a task in any stage below." : p.left ? `${plural(p.left, "task")} remaining` : "Everything on this plan is ticked.";

    const next = trip.tasks.filter((t) => !t.done).slice(0, 4);
    live.next.replaceChildren(...(next.length ? next.map((t) => h("li", {}, h("span", {}, t.title), h("span", { class: "badge" }, STAGES.find((s) => s.id === t.group)?.name || "Other"))) : [h("li", { class: "muted" }, "Nothing remaining.")]));

    const list = milestones(trip);
    const names = { done: ["Done", "badge--success"], overdue: ["Tasks still open", "badge--warning"], today: ["Today", "badge--accent"], upcoming: ["", ""], passed: ["Passed", ""] };
    live.miles.replaceChildren(
      ...(list.length
        ? list.map((m) => {
            const [text, cls] = names[m.status];
            return h("li", { class: `mile mile--${m.status}` }, h("span", { class: "mile__date tnum" }, formatDate(m.date, { day: "numeric", month: "short", year: "numeric" })), h("span", { class: "mile__name" }, m.name), text ? h("span", { class: `badge ${cls}` }, text) : h("span", { class: "small muted" }, `in ${plural(m.gap, "day")}`));
          })
        : [h("li", { class: "muted small" }, "Add a departure date to see suggested milestones.")])
    );

    for (const stage of STAGES) {
      const tasks = trip.tasks.filter((t) => t.group === stage.id);
      const done = tasks.filter((t) => t.done).length;
      const ui = live.stages.get(stage.id);
      if (!ui) continue;
      ui.count.textContent = `${done}/${tasks.length}`;
      ui.bar.update(percent(done, tasks.length));
    }
  }

  function renderStage(stage) {
    const trip = current();
    const ui = live.stages.get(stage.id);
    const tasks = trip.tasks.filter((t) => t.group === stage.id && (!filter || (filter === "done") === t.done));
    ui.list.replaceChildren(
      ...tasks.map((task) => {
        const guide = guides.byId.get(task.guide);
        return taskRow({
          title: task.title,
          done: task.done,
          link: guide ? { href: guideUrl(guide.id), title: guide.title } : null,
          onToggle: (done) => {
            edit((t) => (t.tasks.find((x) => x.id === task.id).done = done));
            paintSummary();
            announce(`${tripProgress(current()).done} of ${current().tasks.length} done.`);
            if (filter) renderStage(stage);
          },
          onSave: ({ title }) => {
            edit((t) => (t.tasks.find((x) => x.id === task.id).title = title));
            paintSummary();
          },
          onDelete: () => {
            const before = data();
            edit((t) => (t.tasks = t.tasks.filter((x) => x.id !== task.id)));
            renderStage(stage);
            paintSummary();
            $("input.input", ui.root)?.focus({ preventScroll: true });
            toast(`Deleted “${task.title}”.`, { iconName: "trash-2", actionLabel: "Undo", action: () => (storage.set("trips", before), render()) });
          },
        });
      })
    );
    if (!tasks.length) ui.list.append(h("li", { class: "muted small", style: "padding:.75rem 0" }, filter === "done" ? "Nothing completed in this stage yet." : filter === "todo" ? "Nothing left in this stage." : "No tasks in this stage."));
  }

  function render() {
    const trip = current();
    if (!trip) return renderStart();
    if (openFor !== trip.id) {
      openFor = trip.id;
      open.clear();
      const firstOpen = STAGES.find((s) => trip.tasks.some((t) => t.group === s.id && !t.done)) || STAGES[0];
      open.add(firstOpen.id);
    }
    const { trips } = data();
    const timing = tripTiming(trip);
    const dates = trip.depart ? `${formatDate(parseDate(trip.depart))}${trip.ret ? ` to ${formatDate(parseDate(trip.ret))}` : ""}` : trip.ret ? `Returning ${formatDate(parseDate(trip.ret))}` : "Dates not set";

    live.ring = progressRing(0, "Trip preparation progress");
    live.count = h("p", { class: "panel-title tnum" });
    live.left = h("p", { class: "muted small" });
    live.next = h("ul", { class: "next-list" });
    live.miles = h("ol", { class: "miles" });
    live.stages = new Map();

    const switcher = trips.length > 1
      ? h("div", { class: "field" }, h("label", { for: "trip-select" }, "Trip"), h("select", { class: "select", id: "trip-select", onchange: (e) => (storage.update("trips", (d) => ({ ...d, active: e.target.value })), render(), $("#trip-select")?.focus()) }, trips.map((t) => h("option", { value: t.id, selected: t.id === trip.id }, tripTitle(t)))))
      : null;

    const facts = [["map-pin", trip.destination || "Destination not set"], ["calendar-days", dates], ["clock", timing.text]];
    if (trip.type) facts.push(["tent", trip.type]);
    if (trip.travelers) facts.push(["users", plural(trip.travelers, "traveler")]);

    const stages = STAGES.map((stage) => {
      const count = h("span", { class: "badge tnum" });
      const bar = progressBar(0, `${stage.name} progress`);
      const list = h("ul", { class: "tasks" });
      const root = h(
        "details",
        { class: "stage disclosure panel", id: `stage-${stage.id}`, open: open.has(stage.id), ontoggle: (e) => (e.target.open ? open.add(stage.id) : open.delete(stage.id)) },
        h("summary", {}, h("span", { class: "stage__icon" }, icon(stage.icon)), h("span", { class: "stage__name" }, h("span", {}, stage.name), h("span", { class: "muted small" }, stage.when)), count, icon("chevron-down")),
        bar,
        list,
        addTaskForm({
          label: `Add a task to ${stage.name}`,
          placeholder: "Add a task",
          onAdd: (title) => {
            edit((t) => t.tasks.push({ id: uid("t"), group: stage.id, title, done: false, custom: true, guide: null }));
            renderStage(stage);
            paintSummary();
            announce(`Added ${title}.`);
          },
        })
      );
      live.stages.set(stage.id, { count, bar, list, root });
      return root;
    });

    const chips = h(
      "div",
      { class: "chips", role: "group", "aria-label": "Show tasks" },
      [["", "All"], ["todo", "Remaining"], ["done", "Completed"]].map(([id, label]) =>
        h("button", { type: "button", class: "chip", "aria-pressed": String(filter === id), dataset: { f: id }, onclick: () => ((filter = id), render(), $(`[data-f="${id}"]`)?.focus({ preventScroll: true })) }, label)
      )
    );

    const saved = storage.get("bookmarks").map((b) => guides.byId.get(b.id)).filter(Boolean);

    const remove = async () => {
      if (!(await confirmDialog({ title: "Delete this trip?", text: `“${tripTitle(trip)}” and its tasks will be removed from this browser.`, confirm: "Delete trip", danger: true }))) return;
      const before = data();
      storage.update("trips", (d) => ({ active: null, trips: d.trips.filter((t) => t.id !== trip.id) }));
      render();
      toast("Trip deleted.", { iconName: "trash-2", actionLabel: "Undo", action: () => (storage.set("trips", before), render()) });
    };
    const resetTasks = async () => {
      if (!(await confirmDialog({ title: "Reset this plan?", text: "All stages go back to the starter tasks, unticked. Tasks you added or edited will be removed. Trip details stay.", confirm: "Reset plan", danger: true }))) return;
      const before = data();
      edit((t) => (t.tasks = defaultTasks()));
      render();
      toast("Plan reset.", { iconName: "rotate-ccw", actionLabel: "Undo", action: () => (storage.set("trips", before), render()) });
    };

    mount.replaceChildren(
      h(
        "section",
        { class: "trip-card", "aria-labelledby": "trip-title" },
        h("div", { class: "trip-card__main" }, h("h2", { id: "trip-title", tabindex: -1 }, tripTitle(trip)), h("ul", { class: "facts" }, facts.map(([i, t]) => h("li", {}, icon(i), t))), h("div", { class: "row no-print" },
          h("button", { type: "button", class: "btn btn--on-dark btn--sm", onclick: () => dialogForm("Edit trip details", trip, "Save changes", (v) => (edit((t) => Object.assign(t, v)), render(), announce("Trip updated."))) }, icon("pencil"), "Edit details"),
          h("button", { type: "button", class: "btn btn--on-dark btn--sm", onclick: () => dialogForm("New trip", null, "Create plan", create) }, icon("plus"), "New trip"))),
        h("div", { class: "trip-card__progress" }, live.ring, h("div", {}, live.count, live.left)),
        switcher
      ),
      h(
        "div",
        { class: "planner-layout" },
        h("div", { class: "stack" }, h("div", { class: "row row--between" }, h("h2", { class: "panel-title" }, "Preparation stages"), chips), stages,
          h("div", { class: "row no-print" }, h("button", { type: "button", class: "btn btn--secondary btn--sm", onclick: () => print() }, icon("printer"), "Print plan"), h("button", { type: "button", class: "btn btn--danger btn--sm", onclick: resetTasks }, icon("rotate-ccw"), "Reset plan"), h("button", { type: "button", class: "btn btn--danger btn--sm", onclick: remove }, icon("trash-2"), "Delete trip"))),
        h(
          "aside",
          { class: "planner-side", "aria-label": "Trip summary" },
          h("section", { class: "panel" }, h("h2", { class: "panel-title" }, "Next up"), live.next),
          h("section", { class: "panel" }, h("h2", { class: "panel-title" }, "Milestones"), h("p", { class: "muted small" }, "Suggested timing, worked back from your departure date."), live.miles),
          h("section", { class: "panel no-print" }, h("h2", { class: "panel-title" }, "Quick links"), h("ul", { class: "link-list" }, [["packing.html", "luggage", "Packing list"], ["packing.html#documents", "file-text", "Document status"], ["emergency.html#contacts", "phone", "Emergency contacts"], ["checklist.html", "list-checks", "Safety checklist"], ["destinations.html", "globe", "Official destination sources"]].map(([href, i, label]) => h("li", {}, h("a", { href }, icon(i), label))))),
          h("section", { class: "panel no-print" }, h("h2", { class: "panel-title" }, "Saved guides"), saved.length ? h("ul", { class: "mini-guides" }, saved.slice(0, 5).map((g) => h("li", {}, h("a", { href: guideUrl(g.id) }, g.title), bookmarkButton(g)))) : h("p", { class: "muted small" }, "Guides you bookmark appear here."), h("a", { class: "link-arrow", href: saved.length ? "bookmarks.html" : "guides.html" }, saved.length ? "Open your library" : "Browse guides", icon("arrow-right")))
        )
      )
    );
    for (const stage of STAGES) renderStage(stage);
    paintSummary();
  }

  render();
}
