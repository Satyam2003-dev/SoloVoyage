/** Saved guides. Only ids are stored; titles and text always come from guides.json. */
import { confirmDialog, emptyState, guideCards, linkButton, toast } from "../components.js";
import { getGuides } from "../data.js";
import { MAX_QUERY, search } from "../search.js";
import * as storage from "../storage.js";
import { $, announce, debounce, h, icon, plural } from "../utils.js";

export async function init() {
  const mount = $("[data-app]");
  const guides = await getGuides();
  let query = "";
  let sortBy = "recent";

  const input = h("input", { class: "input", type: "search", placeholder: "Search your saved guides", maxlength: MAX_QUERY, "aria-label": "Search saved guides", autocomplete: "off" });
  const sort = h("select", { class: "select", id: "sort", onchange: () => ((sortBy = sort.value), render()) }, h("option", { value: "recent" }, "Recently saved"), h("option", { value: "number" }, "Guide number"), h("option", { value: "az" }, "Title, A to Z"));
  const count = h("p", { class: "muted" });
  const grid = h("div", { class: "grid grid--3" });
  const clear = h(
    "button",
    {
      type: "button",
      class: "btn btn--danger btn--sm",
      onclick: async () => {
        const n = storage.get("bookmarks").length;
        if (!(await confirmDialog({ title: "Remove all saved guides?", text: `This clears ${plural(n, "saved guide")} from this browser. The guides themselves stay in the library.`, confirm: "Remove all", danger: true }))) return;
        const before = storage.get("bookmarks");
        storage.set("bookmarks", []);
        toast("Library cleared.", { iconName: "trash-2", actionLabel: "Undo", action: () => storage.set("bookmarks", before) });
      },
    },
    icon("trash-2"),
    "Remove all"
  );
  const controls = h("div", { class: "stack", style: "margin-bottom:2rem" }, h("div", { class: "search-controls" }, h("div", { class: "searchbar", role: "search" }, icon("search"), input), h("div", { class: "field" }, h("label", { class: "visually-hidden", for: "sort" }, "Sort"), sort)), h("div", { class: "row row--between" }, count, clear));

  let ticket = 0;
  async function render() {
    const mine = ++ticket;
    const saved = storage.get("bookmarks").filter((b) => guides.byId.has(b.id));
    if (!saved.length) {
      mount.replaceChildren(emptyState({ iconName: "bookmark", title: "Nothing saved yet", text: "Tap the bookmark on any guide to keep it here. Saved guides stay in this browser and work offline once the site has been cached.", actions: [linkButton("guides.html", "Browse guides")] }));
      return;
    }
    let list = saved.map((b) => guides.byId.get(b.id));
    if (sortBy === "number") list.sort((a, b) => a.number - b.number);
    if (sortBy === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    let terms = [];
    if (query.trim()) {
      const found = await search(query);
      if (mine !== ticket) return;
      terms = found.terms;
      const ids = new Set(found.results.map((r) => r.id));
      list = list.filter((g) => ids.has(g.id));
      announce(`${plural(list.length, "saved guide")} found.`);
    }
    count.textContent = query.trim() ? `${list.length} of ${plural(saved.length, "saved guide")}` : plural(saved.length, "saved guide");
    const cards = await guideCards(list, { terms, level: "h2" });
    if (mine !== ticket) return;
    grid.className = list.length ? "grid grid--3" : "";
    grid.replaceChildren(...(list.length ? cards : [emptyState({ iconName: "search", title: "No saved guide matches", text: "Try another word, or search the whole library.", actions: [linkButton(`search.html?q=${encodeURIComponent(query.trim())}`, "Search everything", "btn--secondary")] })]));
    if (!mount.contains(grid)) mount.replaceChildren(controls, grid);
  }

  input.addEventListener("input", debounce(() => ((query = input.value), render())));
  storage.subscribe("bookmarks", render);
  await render();
}
