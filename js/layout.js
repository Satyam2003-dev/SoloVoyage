/** Header, drawer, search overlay, mobile tab bar and footer, shared by every page. */
import { ANNOUNCEMENT, NAV, NAV_MORE, REPO_URL, TABS } from "./config.js";
import { openDialog } from "./components.js";
import { MAX_QUERY, search, SUGGESTIONS } from "./search.js";
import * as storage from "./storage.js";
import { current, nextTheme, setTheme, THEMES } from "./theme.js";
import { $, $$, announce, debounce, h, highlight, icon, plural } from "./utils.js";

const active = () => document.body.dataset.nav || "";
const currentAttr = (id) => (id === active() ? { "aria-current": "page" } : {});

function brand() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 40 40");
  svg.setAttribute("aria-hidden", "true");
  for (const [tag, attrs] of [
    ["circle", { cx: 20, cy: 20, r: 18.5, fill: "none", stroke: "currentColor", "stroke-width": 2 }],
    ["path", { d: "M28.5 9.5 23 23 9.5 28.5 17 17Z", fill: "#e8752c" }],
    ["path", { d: "M28.5 9.5 23 23 17 17Z", fill: "#f7a868" }],
    ["circle", { cx: 20, cy: 20, r: 2, fill: "#0a1826" }],
  ]) {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return h("a", { class: "brand", href: "index.html" }, svg, "SoloVoyage");
}

/* ---------- Theme controls ---------- */
function themeButton(cls = "") {
  const button = h("button", { type: "button", class: `icon-btn ${cls}`, onclick: () => setTheme(nextTheme().id) });
  const paint = () => {
    const theme = THEMES.find((t) => t.id === current());
    button.replaceChildren(icon(theme.icon));
    button.setAttribute("aria-label", `Theme: ${theme.label}. Switch to ${nextTheme().label}`);
    button.dataset.tip = `Theme: ${theme.label}`;
  };
  storage.subscribe("theme", (t) => {
    paint();
    announce(`Theme set to ${t}.`);
  });
  paint();
  return button;
}

export function themeChips() {
  const wrap = h("div", { class: "chips", role: "group", "aria-label": "Theme" });
  const paint = () =>
    wrap.replaceChildren(
      ...THEMES.map((t) => h("button", { type: "button", class: "chip", "aria-pressed": String(t.id === current()), onclick: () => (setTheme(t.id), $(`[data-t="${t.id}"]`, wrap)?.focus()), dataset: { t: t.id } }, icon(t.icon), t.label))
    );
  storage.subscribe("theme", paint);
  paint();
  return wrap;
}

/* ---------- Search overlay ---------- */
export function openSearch() {
  if ($(".search-dialog")) return;
  const results = h("div", { class: "search-dialog__results" });
  const input = h("input", { class: "input", type: "search", placeholder: "Search guides, for example passport", maxlength: MAX_QUERY, "aria-label": "Search SoloVoyage", autocomplete: "off", enterkeyhint: "search" });
  const links = () => $$("a.result, a.chip", results);

  const suggestions = () =>
    results.replaceChildren(
      h("p", { class: "small muted", style: "margin:.25rem 0 .75rem" }, "Try one of these"),
      h("div", { class: "chips" }, SUGGESTIONS.map((s) => h("a", { class: "chip", href: `search.html?q=${encodeURIComponent(s)}` }, s)))
    );

  let latest = 0;
  const run = async () => {
    const ticket = ++latest;
    const query = input.value;
    if (!query.trim()) return suggestions();
    try {
      const found = await search(query);
      if (ticket !== latest) return;
      announce(found.results.length ? `${plural(found.results.length, "result")}.` : "No results.");
      if (!found.results.length) {
        return results.replaceChildren(h("p", { class: "muted", style: "padding:1rem .25rem" }, "No guides match that. Try a shorter or more general word."));
      }
      results.replaceChildren(
        ...found.results.slice(0, 7).map((r) => h("a", { class: "result", href: r.href }, h("span", { class: "result__num" }, r.number), h("span", { class: "result__title" }, highlight(r.title, found.terms)), h("span", { class: "result__meta" }, r.label))),
        h("a", { class: "result", href: `search.html?q=${encodeURIComponent(query.trim())}` }, h("span", { class: "result__num" }, icon("arrow-right")), h("span", { class: "result__title" }, `See all ${plural(found.results.length, "result")}`))
      );
    } catch {
      results.replaceChildren(h("p", { class: "muted", style: "padding:1rem .25rem" }, "Search could not load. Check your connection and try again."));
    }
  };
  input.addEventListener("input", debounce(run));

  let dialog;
  const form = h(
    "form",
    {
      class: "searchbar",
      role: "search",
      onsubmit: (e) => {
        e.preventDefault();
        if (input.value.trim()) location.href = `search.html?q=${encodeURIComponent(input.value.trim())}`;
      },
    },
    icon("search"),
    input,
    h("button", { type: "button", class: "icon-btn", "aria-label": "Close search", onclick: () => dialog.close() }, icon("x"))
  );
  const body = h("div", { class: "dialog__body" }, form, results);
  body.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = links();
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement) + (e.key === "ArrowDown" ? 1 : -1);
    if (i < 0) input.focus();
    else items[Math.min(i, items.length - 1)].focus();
  });
  suggestions();
  dialog = openDialog(body, { label: "Search", className: "dialog search-dialog" });
  input.focus();
}

/* ---------- Drawer ---------- */
function openDrawer(button) {
  let dialog;
  const link = (n, withIcon) => h("li", {}, h("a", { href: n.href, ...currentAttr(n.id) }, withIcon ? icon(n.icon) : null, n.label));
  dialog = openDialog(
    [
      h("div", { class: "drawer__head" }, brand(), h("button", { type: "button", class: "icon-btn", "aria-label": "Close menu", onclick: () => dialog.close() }, icon("x"))),
      h(
        "div",
        { class: "drawer__body" },
        h("nav", { "aria-label": "Menu" }, h("ul", { class: "drawer__main" }, NAV.map((n) => link(n, true))), h("ul", { class: "drawer__sub" }, NAV_MORE.map((n) => link(n)))),
        h("div", { class: "stack-sm", style: "margin-top:1.5rem" }, h("p", { class: "label" }, "Theme"), themeChips())
      ),
    ],
    { label: "Menu", className: "drawer", onClose: () => button.setAttribute("aria-expanded", "false") }
  );
  button.setAttribute("aria-expanded", "true");
}

/* ---------- Header ---------- */
class SiteHeader extends HTMLElement {
  connectedCallback() {
    const parts = [];
    if (document.documentElement.dataset.announce !== undefined) parts.push(this.announcement());
    const menu = h("button", { type: "button", class: "icon-btn menu-btn", "aria-label": "Open menu", "aria-haspopup": "dialog", "aria-expanded": "false", onclick: () => openDrawer(menu) }, icon("menu"));
    const header = h(
      "header",
      { class: "header" },
      h(
        "div",
        { class: "container header__inner" },
        brand(),
        h("nav", { class: "nav", "aria-label": "Main" }, h("ul", {}, NAV.map((n) => h("li", {}, h("a", { href: n.href, ...currentAttr(n.id) }, n.label))))),
        h(
          "div",
          { class: "header__tools" },
          h("button", { type: "button", class: "icon-btn", "aria-label": "Search", "aria-keyshortcuts": "/", "data-tip": "Search ( / )", onclick: openSearch }, icon("search")),
          h("a", { class: "icon-btn only-wide", href: "dashboard.html", "aria-label": "Dashboard", "data-tip": "Dashboard", ...currentAttr("dashboard") }, icon("layout-dashboard")),
          themeButton(),
          menu
        )
      )
    );
    parts.push(header);
    this.replaceChildren(...parts);
    const onScroll = () => header.classList.toggle("is-stuck", scrollY > 40);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  announcement() {
    const bar = h(
      "aside",
      { class: "announce", "aria-label": "Announcement" },
      h(
        "div",
        { class: "container announce__inner" },
        h("p", {}, h("span", { class: "announce__text" }, ANNOUNCEMENT.text), " ", h("a", { href: ANNOUNCEMENT.href }, ANNOUNCEMENT.linkText)),
        h(
          "button",
          {
            type: "button",
            class: "icon-btn",
            "aria-label": "Dismiss announcement",
            onclick: () => {
              storage.update("preferences", (p) => ({ ...p, announcement: ANNOUNCEMENT.id }));
              delete document.documentElement.dataset.announce;
              bar.remove();
              $(".brand", this)?.focus({ preventScroll: true });
            },
          },
          icon("x")
        )
      )
    );
    return bar;
  }
}

/* ---------- Footer ---------- */
class SiteFooter extends HTMLElement {
  connectedCallback() {
    const col = (title, items) => h("nav", { "aria-label": title }, h("h2", {}, title), h("ul", {}, items.map(([label, href]) => h("li", {}, h("a", { href }, label)))));
    const external = { target: "_blank", rel: "noopener noreferrer" };
    this.replaceChildren(
      h(
        "footer",
        { class: "footer container" },
        h(
          "div",
          { class: "footer__grid" },
          h("div", { class: "footer__brand" }, brand(), h("p", {}, "Practical preparation for people who travel alone. Free, open source, and no account needed.")),
          col("Explore", NAV.filter((n) => n.id !== "about").map((n) => [n.label, n.href])),
          col("Safety resources", [
            ["Emergency situations", "emergency.html#situations"],
            ["Emergency numbers", "emergency.html#numbers"],
            ["Destination sources", "destinations.html"],
            ["Emergency Response guides", "emergency-response.html"],
            ["The Full Checklist", "checklist.html"],
          ]),
          col("Your SoloVoyage", [
            ["Dashboard", "dashboard.html"],
            ["Packing & documents", "packing.html"],
            ["Saved guides", "bookmarks.html"],
            ["Privacy & your data", "privacy.html"],
            ["About", "about.html"],
          ])
        ),
        h(
          "div",
          { class: "footer__legal" },
          h("p", {}, "SoloVoyage offers general guidance, not professional, legal or medical advice. Always check current official information for your destination. ", h("a", { href: "about.html#disclaimer" }, "Read the disclaimer"), "."),
          h("p", { class: "row" }, h("span", {}, "© 2025–2026 SoloVoyage"), h("a", { href: REPO_URL, ...external, class: "row", style: "gap:.4rem;min-height:44px" }, icon("github"), "GitHub", h("span", { class: "visually-hidden" }, " (opens in a new tab)")))
        )
      )
    );
  }
}

function mountTabbar() {
  const items = TABS.map((id) => NAV.find((n) => n.id === id));
  document.body.append(h("nav", { class: "tabbar", "aria-label": "Quick" }, h("ul", {}, items.map((n) => h("li", {}, h("a", { href: n.href, ...currentAttr(n.id) }, icon(n.icon), n.short || n.label))))));
}

export function mountLayout() {
  customElements.define("site-header", SiteHeader);
  customElements.define("site-footer", SiteFooter);
  mountTabbar();
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest("input, textarea, select, [contenteditable], dialog")) return;
    e.preventDefault();
    openSearch();
  });
}
