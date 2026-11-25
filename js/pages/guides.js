/** Guide library: search, category filter, sorting and paging over all 101 guides. */
import { emptyState, guideCards } from "../components.js";
import { getCategories, getGuides, wordCount } from "../data.js";
import { MAX_QUERY, search } from "../search.js";
import { $, announce, debounce, h, icon, params, plural, setParams } from "../utils.js";

const PAGE = 24;
const SORTS = [
  ["journey", "Journey order (001–101)"],
  ["az", "Title, A to Z"],
  ["detail", "Most detailed first"],
];

export async function init() {
  const mount = $("[data-app]");
  const [guides, categories] = await Promise.all([getGuides(), getCategories()]);
  const start = params();
  const state = {
    q: (start.get("q") || "").slice(0, MAX_QUERY),
    category: categories.guides.some((c) => c.id === start.get("category")) ? start.get("category") : "",
    sort: SORTS.some(([id]) => id === start.get("sort")) ? start.get("sort") : "journey",
    shown: PAGE,
  };

  const input = h("input", { class: "input", type: "search", id: "guide-search", placeholder: "Search 101 guides", maxlength: MAX_QUERY, value: state.q, "aria-label": "Search guides", autocomplete: "off", enterkeyhint: "search" });
  const clearInput = h("button", { type: "button", class: "icon-btn", "aria-label": "Clear search", onclick: () => ((input.value = ""), change({ q: "" }), input.focus()) }, icon("x"));
  const chips = h("div", { class: "chips chips--scroll", role: "group", "aria-label": "Category" });
  const sort = h("select", { class: "select", id: "sort", onchange: () => change({ sort: sort.value }) }, SORTS.map(([id, label]) => h("option", { value: id, selected: id === state.sort }, label)));
  const count = h("p", { class: "muted", id: "result-count" });
  const clearAll = h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: reset }, icon("rotate-ccw"), "Clear filters");
  const grid = h("div", { class: "grid grid--3" });
  const more = h("div", { class: "row", style: "justify-content:center;margin-top:2rem" });
  const featured = h("section", { class: "stack", "aria-labelledby": "featured-title", style: "margin-bottom:3.5rem" });

  function change(next) {
    Object.assign(state, { shown: PAGE }, next);
    render();
  }
  function reset() {
    input.value = "";
    sort.value = "journey";
    change({ q: "", category: "", sort: "journey" });
    input.focus();
  }

  const counts = new Map();
  for (const g of guides.list) counts.set(g.category, (counts.get(g.category) || 0) + 1);
  const paintChips = () =>
    chips.replaceChildren(
      ...[{ id: "", name: "All", n: guides.list.length }, ...categories.guides.map((c) => ({ id: c.id, name: c.name, n: counts.get(c.id) }))].map((c) =>
        h("button", { type: "button", class: "chip", "aria-pressed": String(state.category === c.id), dataset: { c: c.id }, onclick: () => (change({ category: c.id }), $(`[data-c="${c.id}"]`, chips)?.focus({ preventScroll: true })) }, c.name, h("span", { class: "tnum", style: "opacity:.75" }, c.n))
      )
    );

  let ticket = 0;
  async function render() {
    const mine = ++ticket;
    const filtered = Boolean(state.q.trim() || state.category);
    let list = guides.list;
    let terms = [];
    let partial = false;
    if (state.q.trim()) {
      const found = await search(state.q, { category: state.category });
      if (mine !== ticket) return;
      terms = found.terms;
      partial = found.partial;
      list = found.results.filter((r) => r.type === "guide").map((r) => r.guide);
    } else if (state.category) list = list.filter((g) => g.category === state.category);

    if (state.sort === "az") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    else if (state.sort === "detail") list = [...list].sort((a, b) => wordCount(b) - wordCount(a) || a.number - b.number);
    else if (!state.q.trim()) list = [...list].sort((a, b) => a.number - b.number);

    paintChips();
    setParams({ q: state.q.trim(), category: state.category, sort: state.sort === "journey" ? "" : state.sort });
    clearInput.hidden = !state.q;
    clearAll.hidden = !filtered && state.sort === "journey";
    featured.hidden = filtered || state.sort !== "journey";
    const name = state.category ? ` in ${categories.byId.get(state.category).name}` : "";
    const text = partial ? `No guide matches every word. Showing ${plural(list.length, "partial match", "partial matches")}${name}.` : `${plural(list.length, "guide")}${name}${state.q.trim() ? ` for “${state.q.trim()}”` : ""}`;
    count.textContent = text;
    if (filtered) announce(text);

    const cards = await guideCards(list.slice(0, state.shown), { terms, level: "h3" });
    if (mine !== ticket) return;
    if (!list.length) {
      grid.className = "";
      grid.replaceChildren(emptyState({ iconName: "search", title: "No guides found", text: "Try a shorter word, check the spelling or clear the filters to see everything.", actions: [h("button", { type: "button", class: "btn btn--primary", onclick: reset }, "Clear filters")], level: "h3" }));
    } else {
      grid.className = "grid grid--3";
      grid.replaceChildren(...cards);
    }
    more.replaceChildren();
    if (list.length > state.shown) {
      more.append(
        h(
          "button",
          {
            type: "button",
            class: "btn btn--secondary",
            onclick: async () => {
              const from = state.shown;
              state.shown += PAGE;
              await render();
              $("a", grid.children[from])?.focus();
            },
          },
          `Show ${Math.min(PAGE, list.length - state.shown)} more of ${list.length - state.shown}`
        )
      );
    }
  }

  input.addEventListener("input", debounce(() => change({ q: input.value })));
  const form = h("form", { class: "searchbar", role: "search", onsubmit: (e) => (e.preventDefault(), change({ q: input.value })) }, icon("search"), input, clearInput);

  featured.append(h("h2", { id: "featured-title", class: "panel-title", style: "font-size:var(--text-2xl)" }, "Start with these"), h("div", { class: "grid grid--3" }, await guideCards(["check-passport-expiry", "divide-your-money", "know-emergency-exits"].map((id) => guides.byId.get(id)))));

  mount.replaceChildren(
    h("div", { class: "filters stack" }, form, chips),
    featured,
    h("div", { class: "filters__bar" }, h("div", { class: "row" }, h("h2", { class: "visually-hidden" }, "All guides"), count, clearAll), h("div", { class: "row" }, h("label", { class: "label", for: "sort" }, "Sort"), sort)),
    grid,
    more
  );
  await render();
}
