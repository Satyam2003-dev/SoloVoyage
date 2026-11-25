/** Search page: all guides and emergency situations, with category filter and highlighted matches. */
import { emptyState, linkButton } from "../components.js";
import { getCategories } from "../data.js";
import { MAX_QUERY, search, snippet, SUGGESTIONS } from "../search.js";
import { $, announce, debounce, h, highlight, icon, params, plural, setParams } from "../utils.js";

export async function init() {
  const mount = $("[data-app]");
  const categories = await getCategories();
  const options = [["", "Everything"], ...categories.guides.map((c) => [c.id, c.name]), ["emergency-center", "Emergency Center"]];
  const start = params();
  const state = { q: (start.get("q") || "").slice(0, MAX_QUERY), category: options.some(([id]) => id === start.get("category")) ? start.get("category") || "" : "" };

  const input = h("input", { class: "input", type: "search", placeholder: "What do you want to know?", maxlength: MAX_QUERY, value: state.q, "aria-label": "Search all guides", autocomplete: "off", enterkeyhint: "search" });
  const clear = h("button", { type: "button", class: "icon-btn", "aria-label": "Clear search", onclick: () => ((input.value = ""), set({ q: "" }), input.focus()) }, icon("x"));
  const filter = h("select", { class: "select", id: "cat", onchange: () => set({ category: filter.value }) }, options.map(([id, name]) => h("option", { value: id, selected: id === state.category }, name)));
  const count = h("p", { class: "muted" });
  const out = h("div");

  function set(next) {
    Object.assign(state, next);
    render();
  }

  let ticket = 0;
  async function render() {
    const mine = ++ticket;
    const q = state.q.trim();
    clear.hidden = !state.q;
    setParams({ q, category: state.category });
    document.title = q ? `“${q}” | Search SoloVoyage` : "Search | SoloVoyage";
    if (!q) {
      count.textContent = "";
      out.replaceChildren(
        h("div", { class: "stack" }, h("h2", { class: "panel-title" }, "Popular topics"), h("div", { class: "chips" }, SUGGESTIONS.map((s) => h("button", { type: "button", class: "chip", onclick: () => ((input.value = s), set({ q: s })) }, s))))
      );
      return;
    }
    const { results, terms, partial } = await search(q, { category: state.category });
    if (mine !== ticket) return;
    const where = state.category ? ` in ${options.find(([id]) => id === state.category)[1]}` : "";
    count.textContent = !results.length ? "" : partial ? `Nothing matches every word. ${plural(results.length, "partial match", "partial matches")}${where}.` : `${plural(results.length, "result")}${where}`;
    announce(count.textContent || "No results.");
    if (!results.length) {
      out.replaceChildren(
        emptyState({
          iconName: "search",
          title: `Nothing found for “${q}”`,
          text: state.category ? "Try searching everything, or use a shorter word." : "Try a shorter or more general word, such as hotel, money or phone.",
          actions: [state.category ? h("button", { type: "button", class: "btn btn--primary", onclick: () => ((filter.value = ""), set({ category: "" })) }, "Search everything") : linkButton("guides.html", "Browse all guides")],
        })
      );
      return;
    }
    out.replaceChildren(
      h(
        "ol",
        { class: "toc" },
        results.map((r) =>
          h(
            "li",
            { class: "toc__item" },
            h("span", { class: "toc__num", "aria-hidden": "true" }, r.number),
            h("div", { class: "toc__body" }, h("h2", { class: "toc__title" }, h("a", { href: r.href }, highlight(r.title, terms))), h("p", { class: "muted" }, highlight(snippet(r, terms), terms)), h("p", { class: "small muted" }, r.label))
          )
        )
      )
    );
  }

  input.addEventListener("input", debounce(() => set({ q: input.value })));
  mount.replaceChildren(
    h("div", { class: "search-controls" }, h("form", { class: "searchbar", role: "search", onsubmit: (e) => (e.preventDefault(), set({ q: input.value })) }, icon("search"), input, clear), h("div", { class: "field" }, h("label", { for: "cat", class: "visually-hidden" }, "Category"), filter)),
    count,
    out
  );
  await render();
  if (!state.q) input.focus({ preventScroll: true });
}
