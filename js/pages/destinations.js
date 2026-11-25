/** Destination sources. No danger scores and no live data: only links to official publishers and questions to answer. */
import { callout, linkButton } from "../components.js";
import { getDestinations, getGuides, guideUrl } from "../data.js";
import { $, cleanText, formatDate, h, icon, parseDate } from "../utils.js";

export async function init() {
  const mount = $("[data-app]");
  const [data, guides] = await Promise.all([getDestinations(), getGuides()]);
  const external = (url, label, cls) => h("a", { class: cls, href: url, target: "_blank", rel: "noopener noreferrer" }, label, icon("external-link"), h("span", { class: "visually-hidden" }, " (opens in a new tab)"));

  const result = h("div", { "aria-live": "polite" });
  const input = h("input", { class: "input", id: "dest", placeholder: "For example, Japan", maxlength: 80, autocomplete: "off" });
  const form = h(
    "form",
    {
      class: "inline-form",
      onsubmit: (e) => {
        e.preventDefault();
        const name = cleanText(input.value, 80);
        if (!name) return input.focus();
        result.replaceChildren(
          h(
            "div",
            { class: "stack" },
            callout("info", `SoloVoyage has no destination report for “${name}”`, "We do not publish country ratings or live safety information. Use the official sources below and look the destination up there."),
            h("p", {}, external(`https://www.gov.uk/search/all?keywords=${encodeURIComponent(`${name} travel advice`)}`, `Search GOV.UK for “${name} travel advice”`, "btn btn--secondary")),
            h("p", { class: "small muted" }, "That button sends the destination name to GOV.UK only when you press it.")
          )
        );
      },
    },
    input,
    h("button", { class: "btn btn--primary" }, "Where do I check?")
  );

  mount.replaceChildren(
    h("div", { class: "stack-lg" },
      h("section", { class: "panel stack" }, h("div", { class: "field" }, h("label", { for: "dest" }, "Destination"), form), result),
      h("section", { class: "stack" }, h("h2", {}, "Official sources"), h("p", { class: "muted", style: "max-width:var(--measure)" }, "Each government writes for its own citizens. Read your own first, then compare one or two others."),
        h("ul", { class: "grid grid--2" }, data.advisories.map((a) => h("li", { class: "panel source-card" }, h("p", { class: "badge" }, a.government), h("h3", {}, external(a.url, a.name, "source-card__title")), h("p", { class: "muted small" }, a.covers), a.links.length ? h("ul", { class: "source-card__links" }, a.links.map((l) => h("li", {}, external(l.url, l.label, "")))) : null))),
        h("p", { class: "small muted" }, `Link list reviewed ${formatDate(parseDate(data.reviewed))}. Each publisher sets its own update dates, so check the date shown on their page. Some official sites block automated checks.`)),
      h("section", { class: "stack" }, h("h2", {}, "What to find out"), h("p", { class: "muted", style: "max-width:var(--measure)" }, "Answer these for every country on your route, including transit stops."),
        h("ul", { class: "grid grid--3" }, data.topics.map((t) => h("li", { class: "panel stack" }, h("h3", { class: "row", style: "gap:.6rem" }, icon(t.icon), t.title), h("ul", { class: "bullets" }, t.ask.map((q) => h("li", {}, q))), h("ul", { class: "small" }, t.guides.map((id) => h("li", {}, h("a", { href: guideUrl(id) }, guides.byId.get(id).title)))))))),
      h("p", { class: "row" }, linkButton("planner.html", "Add these to a trip plan", "btn--secondary", "arrow-right")))
  );
}
