/** Category pages keep their original URLs. The list of guides comes from guides.json. */
import { bookmarkButton, progressBar } from "../components.js";
import { getCategories, getGuides, guideNumber, guideUrl } from "../data.js";
import * as storage from "../storage.js";
import { $, h, icon, percent } from "../utils.js";

export async function init() {
  const mount = $("[data-app]");
  const id = document.body.dataset.category;
  const [guides, categories] = await Promise.all([getGuides(), getCategories()]);
  const list = guides.list.filter((g) => g.category === id);

  const label = h("p", { class: "small muted" });
  const bar = progressBar(0, "Guides read in this category");
  const paint = () => {
    const n = list.filter((g) => storage.isRead(g.id)).length;
    bar.update(percent(n, list.length));
    label.textContent = n ? `You have read ${n} of ${list.length}` : `${list.length} guides, none marked as read yet`;
  };
  storage.subscribe("read", paint);
  paint();

  const at = categories.list.findIndex((c) => c.id === id);
  const next = categories.list[at + 1];

  mount.replaceChildren(
    h("div", { class: "category-progress" }, label, bar),
    h(
      "ol",
      { class: "toc" },
      list.map((g) =>
        h(
          "li",
          { class: "toc__item" },
          h("span", { class: "toc__num", "aria-hidden": "true" }, guideNumber(g)),
          h("div", { class: "toc__body" }, h("h2", { class: "toc__title" }, h("a", { href: guideUrl(g.id) }, g.title)), h("p", { class: "muted" }, g.summary), storage.isRead(g.id) ? h("p", { class: "toc__read" }, icon("check"), "Read") : null),
          bookmarkButton(g)
        )
      )
    ),
    next ? h("a", { class: "next-band", href: next.page }, h("span", { class: "small" }, "Next category"), h("span", { class: "display" }, next.name), icon("arrow-right")) : null
  );
}
