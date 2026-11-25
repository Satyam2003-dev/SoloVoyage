/** Home: everything is static except the live checklist preview. */
import { checklistStats, progressRing, taskRow } from "../components.js";
import { getChecklist, guideUrl } from "../data.js";
import * as storage from "../storage.js";
import { $, announce, h, plural } from "../utils.js";

export async function init() {
  const mount = $("[data-app]");
  const data = await getChecklist();
  const ring = progressRing(0, "Checklist completion");
  const status = h("div", { class: "stack-sm" });
  const list = h("ul", { class: "tasks" });

  const stats = () => checklistStats(data, storage.get("checklist"));

  const paintStatus = () => {
    const s = stats();
    ring.update(s.value);
    status.replaceChildren(
      h("p", { class: "panel-title" }, s.done === 0 ? "You have not started yet" : s.done === s.total ? "Everything is done" : `${s.done} of ${s.total} complete`),
      h("p", { class: "muted small" }, s.done === 0 ? "Tick your first task here. It saves in this browser." : s.done === s.total ? "Review it once more before you leave." : `${plural(s.total - s.done, "task")} to go.`)
    );
  };

  const paintList = () => {
    const s = stats();
    const state = storage.get("checklist");
    const next = s.all.filter((i) => !state.done.includes(i.id)).slice(0, 4);
    list.replaceChildren(
      ...next.map((item) => {
        const source = data.items.find((i) => i.id === item.id);
        return taskRow({
          title: item.title,
          detail: item.detail,
          done: false,
          link: source ? { href: guideUrl(source.guide), title: item.title } : null,
          onToggle: (done) => {
            storage.setChecklistDone(item.id, done);
            paintStatus();
            announce(`${stats().done} of ${stats().total} complete.`);
          },
        });
      })
    );
    list.hidden = !next.length;
  };

  paintStatus();
  paintList();
  mount.replaceChildren(h("div", { class: "row", style: "gap:1.25rem;flex-wrap:nowrap" }, ring, status), list);
}
