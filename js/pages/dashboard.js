/** Personal dashboard. It only ever shows what is actually saved in this browser. */
import { bookmarkButton, checklistStats, linkButton, progressBar, progressRing } from "../components.js";
import { getCategories, getChecklist, getGuides, guideUrl } from "../data.js";
import { DOCUMENTS, starterPacking } from "../packing-data.js";
import * as storage from "../storage.js";
import { tripProgress, tripTiming, tripTitle } from "../trip.js";
import { $, formatDate, h, icon, parseDate, percent, plural } from "../utils.js";

export async function init() {
  const mount = $("[data-app]");
  const [guides, categories, checklist] = await Promise.all([getGuides(), getCategories(), getChecklist()]);

  const panel = (title, body, link, cls = "") =>
    h("section", { class: `panel dash ${cls}` }, h("div", { class: "panel__head" }, h("h2", {}, title), link ? h("a", { class: "link-arrow small", href: link[0] }, link[1], icon("arrow-right")) : null), body);
  const empty = (text, href, label) => h("div", { class: "stack dash__empty" }, h("p", { class: "muted" }, text), h("p", {}, linkButton(href, label, "btn--secondary btn--sm")));

  function render() {
    const trip = storage.activeTrip();
    const check = checklistStats(checklist, storage.get("checklist"));
    const saved = storage.get("bookmarks").map((b) => guides.byId.get(b.id)).filter(Boolean);
    const recent = storage.get("recently_viewed").map((b) => guides.byId.get(b.id)).filter(Boolean);
    const packing = storage.get("packing");
    const documents = storage.get("documents");
    const contacts = storage.get("contacts");
    const readCount = storage.get("read").filter((r) => guides.byId.has(r.id)).length;

    /* Current trip */
    let tripPanel;
    if (trip) {
      const p = tripProgress(trip);
      const ring = progressRing(p.value, "Trip preparation");
      tripPanel = panel(
        "Current trip",
        h("div", { class: "dash__trip" }, ring, h("div", { class: "stack-sm" }, h("p", { class: "display", style: "font-size:var(--text-2xl);line-height:1.15" }, tripTitle(trip)), h("p", { class: "muted" }, [trip.destination && trip.name ? trip.destination : null, trip.depart ? formatDate(parseDate(trip.depart)) : null, tripTiming(trip).text].filter(Boolean).join(" · ")), h("p", { class: "small" }, p.total ? `${p.done} of ${p.total} tasks done, ${p.left} remaining` : "No tasks on this plan"))),
        ["planner.html", "Open planner"],
        "dash--wide"
      );
    } else tripPanel = panel("Current trip", empty("No trip planned yet. Create one to track preparation stage by stage.", "planner.html", "Plan a trip"), null, "dash--wide");

    /* Checklist */
    const checkBars = checklist.categories.map((c) => {
      const list = check.all.filter((i) => i.group === c.id);
      const done = list.filter((i) => storage.get("checklist").done.includes(i.id)).length;
      return h("li", {}, h("a", { href: `checklist.html#${c.id}` }, c.name), h("span", { class: "tnum small muted" }, `${done}/${list.length}`), progressBar(percent(done, list.length), `${c.name} progress`));
    });
    const checkPanel = panel(
      "Checklist",
      check.done ? h("div", { class: "stack" }, h("p", { class: "small tnum" }, `${check.done} of ${check.total} complete (${check.value}%)`), h("ul", { class: "dash__bars" }, checkBars)) : empty(`Nothing ticked yet. There are ${check.total} tasks waiting.`, "checklist.html", "Open my checklist"),
      check.done ? ["checklist.html", "Open"] : null
    );

    /* Packing and documents */
    const packed = packing ? packing.items.filter((i) => i.done).length : 0;
    const packTotal = packing ? packing.items.length : starterPacking().length;
    const needed = DOCUMENTS.filter((d) => documents[d.id] !== "na");
    const ready = needed.filter((d) => documents[d.id] === "ready").length;
    const kitPanel = panel(
      "Packing and documents",
      packing || Object.keys(documents).length
        ? h("div", { class: "stack" }, h("div", { class: "stack-sm" }, h("p", { class: "small" }, `Packing: ${packed} of ${packTotal} items`), progressBar(percent(packed, packTotal), "Packing progress")), h("div", { class: "stack-sm" }, h("p", { class: "small" }, `Documents: ${ready} of ${needed.length} ready`), progressBar(percent(ready, needed.length), "Documents ready")))
        : empty("Your packing list and document status are untouched.", "packing.html", "Start packing"),
      packing || Object.keys(documents).length ? ["packing.html", "Open"] : null
    );

    /* Emergency readiness */
    const contactList = [["trustedContact", "Trusted contact"], ["localNumber", "Local emergency number"], ["embassy", "Embassy or consulate"], ["medical", "Medical contact"], ["accommodation", "Accommodation contact"]];
    const emergencyPanel = panel(
      "Emergency preparation",
      h("ul", { class: "ready-list" }, contactList.map(([key, label]) => h("li", { class: contacts[key] ? "is-ready" : "" }, icon(contacts[key] ? "circle-check" : "circle-alert"), h("span", {}, label), h("span", { class: "small muted" }, contacts[key] ? "Saved" : "Not added")))),
      ["emergency.html#contacts", Object.keys(contacts).length ? "Review" : "Add"]
    );

    const guideList = (list, withBookmark) =>
      h("ul", { class: "mini-guides" }, list.map((g) => h("li", {}, h("a", { href: guideUrl(g.id) }, h("span", {}, g.title), h("span", { class: "small muted" }, categories.byId.get(g.category).name)), withBookmark ? bookmarkButton(g) : null)));

    const savedPanel = panel("Saved guides", saved.length ? guideList(saved.slice(0, 5), true) : empty("Bookmark a guide to keep it close.", "guides.html", "Browse guides"), saved.length ? ["bookmarks.html", `All ${saved.length}`] : null);
    const recentPanel = panel("Recently viewed", recent.length ? guideList(recent.slice(0, 5)) : empty("Guides you open will be listed here.", "guides.html", "Read a guide"));

    /* Reminders are derived from real gaps in what is saved. */
    const reminders = [];
    if (trip && trip.depart) {
      const stale = tripTiming(trip).phase === "past";
      if (stale) reminders.push(["calendar-days", "Your saved trip dates have passed. Update or delete the trip.", "planner.html"]);
    }
    if (trip && !trip.depart) reminders.push(["calendar-days", "Add a departure date to see suggested milestones.", "planner.html"]);
    if (!contacts.trustedContact) reminders.push(["phone", "Add a trusted contact to your emergency card.", "emergency.html#contacts"]);
    if (!contacts.localNumber) reminders.push(["siren", "Look up your destination's emergency number and save it.", "emergency.html#numbers"]);
    if (documents.passport !== "ready" && documents.passport !== "na") reminders.push(["stamp", "Confirm your passport is ready.", "packing.html#documents"]);
    if (!storage.has("bookmarks")) reminders.push(["bookmark", "Save a few guides to read again on the way.", "guides.html"]);

    const quick = [["planner.html", "route", "Planner"], ["checklist.html", "list-checks", "Checklist"], ["packing.html", "luggage", "Packing"], ["emergency.html", "life-buoy", "Emergency"], ["bookmarks.html", "bookmark", "Library"], ["destinations.html", "globe", "Sources"]];

    mount.replaceChildren(
      h("p", { class: "dash__welcome" }, trip ? `Here is where “${tripTitle(trip)}” stands.` : check.done || saved.length ? "Welcome back. Here is what you have saved." : "Welcome. This fills in as you use SoloVoyage."),
      h("nav", { class: "quick", "aria-label": "Quick access" }, h("ul", {}, quick.map(([href, i, label]) => h("li", {}, h("a", { href }, icon(i), label))))),
      h(
        "div",
        { class: "dash-grid" },
        tripPanel,
        panel("Useful reminders", reminders.length ? h("ul", { class: "link-list" }, reminders.slice(0, 4).map(([i, text, href]) => h("li", {}, h("a", { href }, icon(i), text)))) : h("p", { class: "muted" }, "No reminders right now. Recheck official advice shortly before you travel."), null),
        checkPanel,
        emergencyPanel,
        kitPanel,
        savedPanel,
        recentPanel,
        panel("Reading", h("div", { class: "stack-sm" }, h("p", { class: "small tnum" }, `${plural(readCount, "guide")} of ${guides.list.length} marked as read`), progressBar(percent(readCount, guides.list.length), "Guides read")), ["guides.html", "Library"])
      ),
      h("p", { class: "muted small", style: "margin-top:2rem" }, "Everything on this page comes from this browser. ", h("a", { href: "privacy.html#your-data" }, "Export or delete your data"), ".")
    );
  }

  render();
  for (const name of ["trips", "checklist", "bookmarks", "contacts", "packing", "documents", "read"]) storage.subscribe(name, render);
  addEventListener("pageshow", (e) => e.persisted && render());
}
