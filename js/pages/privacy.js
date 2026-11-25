/** The data controls on the privacy page: see, export, import and delete what is stored. */
import { callout, confirmDialog, toast } from "../components.js";
import { GTM_ID } from "../config.js";
import * as storage from "../storage.js";
import { $, announce, h, icon, plural } from "../utils.js";

function size(name, value) {
  if (!storage.has(name)) return "Nothing saved";
  if (name === "theme") return `Set to ${value}`;
  if (Array.isArray(value)) return plural(value.length, "entry", "entries");
  if (name === "trips") return plural(value.trips.length, "trip");
  if (name === "checklist") return `${value.done.length} ticked, ${value.custom.length} custom`;
  if (name === "packing") return plural(value?.items.length || 0, "item");
  return plural(Object.keys(value || {}).length, "field");
}

export async function init() {
  const mount = $("[data-app]");

  function download() {
    const blob = new Blob([JSON.stringify(storage.exportAll(), null, 2)], { type: "application/json" });
    const link = h("a", { href: URL.createObjectURL(blob), download: "solovoyage-backup.json" });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast("Backup downloaded. It contains your contacts and trips in plain text, so store it carefully.", { iconName: "download", duration: 8000 });
  }

  const file = h("input", {
    type: "file",
    accept: "application/json,.json",
    class: "visually-hidden",
    id: "restore-file",
    tabindex: -1,
    onchange: async () => {
      const chosen = file.files[0];
      file.value = "";
      if (!chosen) return;
      if (chosen.size > 1_000_000) return toast("That file is too large to be a SoloVoyage backup.", { iconName: "circle-alert" });
      const text = await chosen.text();
      if (!(await confirmDialog({ title: "Restore this backup?", text: "Items in the file replace the matching items saved in this browser.", confirm: "Restore" }))) return;
      try {
        const n = storage.importAll(text);
        render();
        toast(`Restored ${plural(n, "section")} from the backup.`);
      } catch (error) {
        toast(error.message, { iconName: "circle-alert", duration: 8000 });
      }
    },
  });

  async function erase() {
    if (!(await confirmDialog({ title: "Delete all SoloVoyage data?", text: "Trips, checklist, packing list, saved guides, contacts and settings in this browser will be removed. This cannot be undone.", confirm: "Delete everything", danger: true }))) return;
    storage.clearAll();
    delete document.documentElement.dataset.announce;
    render();
    announce("All SoloVoyage data deleted from this browser.");
    toast("All SoloVoyage data has been deleted from this browser.", { iconName: "trash-2" });
  }

  function analyticsControl() {
    if (!GTM_ID) return h("p", {}, "Analytics is switched off for this copy of the site.");
    const choice = storage.get("preferences").analytics || "no";
    const set = (value) => {
      storage.update("preferences", (p) => ({ ...p, analytics: value }));
      document.querySelector(".consent")?.remove();
      if (value === "no" && window.dataLayer) return location.reload();
      render();
      announce(value === "yes" ? "Analytics allowed. It starts on your next page view." : "Analytics turned off.");
    };
    return h(
      "div",
      { class: "chips", role: "group", "aria-label": "Visit statistics" },
      [["no", "Off"], ["yes", "Allowed"]].map(([v, label]) => h("button", { type: "button", class: "chip", "aria-pressed": String(choice === v), onclick: () => set(v) }, label))
    );
  }

  function render() {
    $("[data-analytics]")?.replaceChildren(analyticsControl());
    mount.replaceChildren(
      storage.available ? "" : callout("warning", "Storage is blocked", "This browser is not letting the site save anything. Changes last only while a page is open."),
      h(
        "div",
        { class: "table-wrap" },
        h(
          "table",
          { class: "data-table" },
          h("caption", { class: "visually-hidden" }, "Data saved in this browser"),
          h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "What"), h("th", { scope: "col" }, "Storage key"), h("th", { scope: "col" }, "Saved now"))),
          h("tbody", {}, Object.entries(storage.STORES).map(([name, s]) => h("tr", {}, h("th", { scope: "row" }, s.label), h("td", {}, h("code", {}, `solovoyage_${name}`)), h("td", { class: "tnum" }, size(name, storage.get(name))))))
        )
      ),
      h(
        "div",
        { class: "row", style: "margin-top:1.5rem" },
        h("button", { type: "button", class: "btn btn--secondary", onclick: download }, icon("download"), "Export a backup"),
        h("button", { type: "button", class: "btn btn--secondary", onclick: () => file.click() }, icon("upload"), "Restore a backup"),
        file,
        h("button", { type: "button", class: "btn btn--danger", onclick: erase }, icon("trash-2"), "Delete all data")
      )
    );
  }
  render();
}
