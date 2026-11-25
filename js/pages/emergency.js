/**
 * Emergency Center. The situation guides are static HTML so they work without this script.
 * This adds the personal contact card, the number finder and "open the right guide" behaviour.
 */
import { callout, confirmDialog, toast } from "../components.js";
import { getEmergency } from "../data.js";
import * as storage from "../storage.js";
import { $, $$, announce, cleanText, contactHref, formatDate, h, icon, parseDate } from "../utils.js";

const FIELDS = [
  { id: "trustedName", label: "Trusted contact: name", placeholder: "Who should be told first?", icon: "user-round" },
  { id: "trustedContact", label: "Trusted contact: phone or email", placeholder: "Include the country code", icon: "phone", linkable: true },
  { id: "localNumber", label: "Local emergency number", placeholder: "Confirm it from an official source", icon: "siren", linkable: true },
  { id: "embassy", label: "Embassy or consulate", placeholder: "Phone number, or name and address", icon: "flag", linkable: true },
  { id: "medical", label: "Medical contact", placeholder: "Insurer assistance line, doctor or clinic", icon: "heart-pulse", linkable: true },
  { id: "accommodation", label: "Accommodation", placeholder: "Phone number, or name and address", icon: "bed-double", linkable: true },
];

function contactCard() {
  const root = $("[data-contacts]");
  if (!root) return;

  function show() {
    const saved = storage.get("contacts");
    const filled = FIELDS.filter((f) => saved[f.id]);
    if (!filled.length) {
      root.replaceChildren(
        h("div", { class: "stack" }, h("p", {}, "No contacts saved yet. Add them before you travel, while you have time to check each one."), h("button", { type: "button", class: "btn btn--primary", onclick: form }, icon("plus"), "Add my contacts"))
      );
      return;
    }
    root.replaceChildren(
      h(
        "dl",
        { class: "contact-card" },
        filled.map((f) => {
          const value = saved[f.id];
          const href = f.linkable ? contactHref(value) : null;
          return h(
            "div",
            {},
            h("dt", {}, icon(f.icon), f.label),
            h("dd", {}, h("span", {}, value), href ? h("a", { class: "btn btn--secondary btn--sm", href, "aria-label": `${href.startsWith("tel:") ? "Call" : "Email"} ${f.label}: ${value}` }, icon(href.startsWith("tel:") ? "phone" : "mail"), href.startsWith("tel:") ? "Call" : "Email") : null)
          );
        })
      ),
      h(
        "div",
        { class: "row no-print", style: "margin-top:1.25rem" },
        h("button", { type: "button", class: "btn btn--secondary btn--sm", onclick: form }, icon("pencil"), "Edit"),
        h("button", { type: "button", class: "btn btn--secondary btn--sm", onclick: () => print() }, icon("printer"), "Print card"),
        h(
          "button",
          {
            type: "button",
            class: "btn btn--danger btn--sm",
            onclick: async () => {
              if (!(await confirmDialog({ title: "Delete your contacts?", text: "Every emergency contact saved in this browser will be removed.", confirm: "Delete contacts", danger: true }))) return;
              storage.remove("contacts");
              show();
              toast("Contacts deleted from this browser.", { iconName: "trash-2" });
            },
          },
          icon("trash-2"),
          "Delete"
        )
      )
    );
  }

  function form() {
    const saved = storage.get("contacts");
    const inputs = FIELDS.map((f) => h("input", { class: "input", id: `c-${f.id}`, value: saved[f.id] || "", placeholder: f.placeholder, maxlength: 160, autocomplete: "off" }));
    root.replaceChildren(
      h(
        "form",
        {
          class: "form-grid",
          onsubmit: (e) => {
            e.preventDefault();
            const next = Object.fromEntries(FIELDS.map((f, i) => [f.id, cleanText(inputs[i].value, 160)]));
            if (Object.values(next).some(Boolean)) storage.set("contacts", next);
            else storage.remove("contacts");
            show();
            announce("Contacts saved in this browser.");
            $("button, a", root)?.focus({ preventScroll: true });
          },
        },
        FIELDS.map((f, i) => h("div", { class: "field" }, h("label", { for: `c-${f.id}` }, f.label), inputs[i])),
        h("p", { class: "field__hint span-2" }, "All fields are optional. They are saved unencrypted in this browser only."),
        h("div", { class: "row span-2" }, h("button", { class: "btn btn--primary" }, "Save contacts"), h("button", { type: "button", class: "btn btn--secondary", onclick: show }, "Cancel"))
      )
    );
    inputs[0].focus();
  }

  storage.subscribe("contacts", () => !$("form", root) && show());
  show();
}

async function numberFinder() {
  const root = $("[data-numbers]");
  if (!root) return;
  const { numbers, reviewed } = await getEmergency();
  const result = h("div", { class: "number-result", "aria-live": "polite" });
  const select = h(
    "select",
    { class: "select", id: "area", onchange: () => paint(select.value) },
    h("option", { value: "" }, "Choose a country or region"),
    numbers.map((n, i) => h("option", { value: String(i) }, n.area)),
    h("option", { value: "other" }, "My destination is not listed")
  );
  function paint(value) {
    if (value === "") return result.replaceChildren();
    if (value === "other") {
      return result.replaceChildren(
        callout("warning", "We do not have a verified number for it", h("span", {}, "SoloVoyage lists only places it has a source for. Check your government's travel advice for the destination, ask your accommodation, and save the number in your contact card above. ", h("a", { href: "destinations.html" }, "Find official sources"), "."))
      );
    }
    const n = numbers[Number(value)];
    result.replaceChildren(
      h(
        "div",
        { class: "number-card" },
        h("h3", {}, n.area),
        h("ul", { class: "number-card__list" }, n.primary.map((p) => h("li", {}, h("span", {}, p.label), h("a", { class: "number-card__dial", href: `tel:${p.number}`, "aria-label": `Call ${p.number}, ${p.label}, ${n.area}` }, icon("phone"), p.number)))),
        n.note ? h("p", { class: "small" }, n.note) : null,
        h("p", { class: "small muted" }, "Source: ", h("a", { href: n.url, target: "_blank", rel: "noopener noreferrer" }, n.source, h("span", { class: "visually-hidden" }, " (opens in a new tab)")), `. Recorded ${formatDate(parseDate(n.checked))}. Confirm locally, because numbers can change.`)
      )
    );
  }
  root.replaceChildren(h("div", { class: "field", style: "max-width:28rem" }, h("label", { for: "area" }, "Where are you?"), select, h("span", { class: "field__hint" }, `List last reviewed ${formatDate(parseDate(reviewed))}. It does not detect your location.`)), result);
}

function situations() {
  const openFromHash = () => {
    const el = location.hash && document.getElementById(location.hash.slice(1));
    if (el?.tagName === "DETAILS") {
      el.open = true;
      el.scrollIntoView({ block: "start" });
      $("summary", el).focus({ preventScroll: true });
    }
  };
  addEventListener("hashchange", openFromHash);
  // Clicking the tile for the guide that is already in the address bar fires no hashchange.
  for (const a of $$("a.sit-tile")) a.addEventListener("click", () => a.hash === location.hash && setTimeout(openFromHash));
  openFromHash();

  let wasOpen = [];
  addEventListener("beforeprint", () => {
    wasOpen = $$("details.situation").map((d) => [d, d.open]);
    for (const [d] of wasOpen) d.open = true;
  });
  addEventListener("afterprint", () => wasOpen.forEach(([d, o]) => (d.open = o)));
}

export async function init() {
  situations();
  contactCard();
  try {
    await numberFinder();
  } catch {
    const root = $("[data-numbers]");
    root.replaceChildren(callout("warning", "The number list could not load", "Use your government's official travel advice and ask local people or staff to call for you."));
  }
}
