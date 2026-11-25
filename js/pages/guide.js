/** A single guide, rendered from guides.json using ?id= */
import { bookmarkButton, callout, emptyState, guideCards, linkButton, share, taskRow, toast } from "../components.js";
import { SITE_URL } from "../config.js";
import { getCategories, getChecklist, getGuides, guideNumber, guideUrl, readingMinutes } from "../data.js";
import * as storage from "../storage.js";
import { $, announce, h, icon, params } from "../utils.js";

function setMeta(guide, category) {
  const url = SITE_URL + guideUrl(guide.id);
  document.title = `${guide.title} | SoloVoyage`;
  const set = (selector, attr, value) => $(selector)?.setAttribute(attr, value);
  set('meta[name="description"]', "content", guide.summary);
  set('link[rel="canonical"]', "href", url);
  set('meta[property="og:title"]', "content", guide.title);
  set('meta[property="og:description"]', "content", guide.summary);
  set('meta[property="og:url"]', "content", url);
  $('meta[name="robots"]')?.remove();
  const crumbs = [
    ["Guides", "guides.html"],
    [category.name, category.page],
    [guide.title, guideUrl(guide.id)],
  ];
  const script = h("script", { type: "application/ld+json" });
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE_URL + path })),
  });
  document.head.append(script);
}

function readButton(guide) {
  const button = h("button", { type: "button", class: "btn btn--secondary" });
  const paint = () => {
    const on = storage.isRead(guide.id);
    button.setAttribute("aria-pressed", String(on));
    button.replaceChildren(icon(on ? "circle-check" : "check"), on ? "Marked as read" : "Mark as read");
  };
  button.addEventListener("click", () => {
    const on = storage.toggleRead(guide.id);
    paint();
    announce(on ? "Marked as read." : "Marked as unread.");
  });
  paint();
  return button;
}

export async function init() {
  const mount = $("[data-app]");
  const [guides, categories, checklist] = await Promise.all([getGuides(), getCategories(), getChecklist()]);
  const guide = guides.byId.get(params().get("id") || "");

  if (!guide) {
    document.title = "Guide not found | SoloVoyage";
    mount.replaceChildren(
      h("div", { class: "container section" }, emptyState({ iconName: "signpost", title: "We could not find that guide", text: "The link may be incomplete or out of date. Every guide is in the library.", level: "h1", actions: [linkButton("guides.html", "Browse all guides"), linkButton("search.html", "Search", "btn--secondary")] }))
    );
    return;
  }

  const category = categories.byId.get(guide.category);
  setMeta(guide, category);
  storage.addRecent(guide.id);

  const at = guides.list.indexOf(guide);
  const prev = guides.list[at - 1];
  const next = guides.list[at + 1];
  const siblings = guides.list.filter((g) => g.category === guide.category);
  const practice = checklist.items.filter((i) => i.guide === guide.id);
  const related = await guideCards(guide.related.map((id) => guides.byId.get(id)).filter(Boolean).slice(0, 3));

  const pagerLink = (g, label, side) => (g ? h("a", { class: `pager__link pager__link--${side}`, href: guideUrl(g.id), rel: side }, h("span", { class: "small muted" }, label), h("span", { class: "pager__title" }, g.title)) : h("span"));

  mount.replaceChildren(
    h(
      "header",
      { class: "page-head guide-head" },
      h(
        "div",
        { class: "container" },
        h("nav", { class: "breadcrumbs", "aria-label": "Breadcrumb" }, h("ol", {}, h("li", {}, h("a", { href: "guides.html" }, "Guides")), h("li", {}, h("a", { href: category.page }, category.name)))),
        h("p", { class: "guide-head__num", "aria-hidden": "true" }, guideNumber(guide)),
        h("h1", {}, h("span", { class: "visually-hidden" }, `Guide ${guide.number}: `), guide.title),
        h("p", { class: "lead" }, guide.summary),
        h("p", { class: "guide-head__meta" }, h("span", {}, icon(category.icon), category.name), h("span", {}, icon("clock"), `${readingMinutes(guide)} min read`))
      )
    ),
    h(
      "div",
      { class: "container guide-layout" },
      h(
        "article",
        { class: "prose" },
        h("p", { class: "prose__intro" }, guide.intro),
        h("h2", {}, "What to do"),
        h("ul", { class: "points" }, guide.actions.map((a) => h("li", {}, h("h3", {}, a.title), h("p", {}, a.text)))),
        guide.warning ? callout("warning", "Important", guide.warning) : null,
        guide.note ? callout("info", "Good to know", guide.note) : null,
        practice.length
          ? h(
              "section",
              { class: "practice no-print" },
              h("h2", {}, "Put it into practice"),
              h("p", { class: "muted small" }, "This is saved to your ", h("a", { href: "checklist.html" }, "checklist"), "."),
              h(
                "ul",
                { class: "tasks" },
                practice.map((item) =>
                  taskRow({
                    title: item.title,
                    detail: item.detail,
                    done: storage.get("checklist").done.includes(item.id),
                    onToggle: (done) => {
                      storage.setChecklistDone(item.id, done);
                      toast(done ? "Ticked off on your checklist." : "Unticked on your checklist.");
                    },
                  })
                )
              )
            )
          : null,
        guide.resources?.length
          ? h(
              "section",
              {},
              h("h2", {}, "Official sources"),
              h("ul", { class: "sources" }, guide.resources.map((r) => h("li", {}, h("a", { href: r.url, target: "_blank", rel: "noopener noreferrer" }, r.label, icon("external-link"), h("span", { class: "visually-hidden" }, " (opens in a new tab)"))))),
              h("p", { class: "muted small" }, "Links checked 26 November 2026. Official pages change, so confirm details there before you rely on them.")
            )
          : null
      ),
      h(
        "aside",
        { class: "guide-side no-print", "aria-label": "Guide tools" },
        h(
          "div",
          { class: "guide-tools" },
          bookmarkButton(guide, { full: true }),
          readButton(guide),
          h("button", { type: "button", class: "btn btn--secondary", onclick: () => share({ title: guide.title, text: guide.summary }) }, icon("share-2"), "Share"),
          h("button", { type: "button", class: "btn btn--secondary", onclick: () => print() }, icon("printer"), "Print")
        ),
        h(
          "nav",
          { class: "guide-toc", "aria-label": `More in ${category.name}` },
          h("h2", {}, `In ${category.name}`),
          h("ol", {}, siblings.map((g) => h("li", {}, h("a", { href: guideUrl(g.id), ...(g === guide ? { "aria-current": "page" } : {}) }, h("span", { class: "tnum" }, guideNumber(g)), g.title))))
        )
      )
    ),
    h(
      "div",
      { class: "container no-print", style: "padding-bottom:4rem" },
      h("nav", { class: "pager", "aria-label": "Previous and next guide" }, pagerLink(prev, "Previous guide", "prev"), pagerLink(next, "Next guide", "next")),
      related.length ? h("section", { class: "stack-lg", style: "margin-top:4rem" }, h("h2", {}, "Related guides"), h("div", { class: "grid grid--3" }, related)) : null
    )
  );
}
