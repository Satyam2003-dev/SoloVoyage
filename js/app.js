/** Entry point for every page. */
import { GTM_ID } from "./config.js";
import { errorState, toast } from "./components.js";
import { mountLayout } from "./layout.js";
import * as storage from "./storage.js";
import { $, $$, h } from "./utils.js";
import "./theme.js";

const PAGES = {
  home: () => import("./pages/home.js"),
  guides: () => import("./pages/guides.js"),
  guide: () => import("./pages/guide.js"),
  category: () => import("./pages/category.js"),
  planner: () => import("./pages/planner.js"),
  checklist: () => import("./pages/checklist.js"),
  packing: () => import("./pages/packing.js"),
  emergency: () => import("./pages/emergency.js"),
  dashboard: () => import("./pages/dashboard.js"),
  bookmarks: () => import("./pages/bookmarks.js"),
  search: () => import("./pages/search.js"),
  destinations: () => import("./pages/destinations.js"),
  privacy: () => import("./pages/privacy.js"),
};

mountLayout();
reveal();
initPage();
storageNotice();
analytics();
registerServiceWorker();

async function initPage() {
  const name = document.body.dataset.page;
  if (!PAGES[name]) return;
  try {
    await (await PAGES[name]()).init();
  } catch (error) {
    console.error(`SoloVoyage: the ${name} page could not start.`, error);
    const target = $("[data-app]");
    if (target) target.replaceChildren(errorState());
  }
  // The target of a #hash may not have existed when the browser first looked for it.
  if (location.hash.length > 1) {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    el?.scrollIntoView({ block: "start" });
  }
}

function reveal() {
  const items = $$("[data-reveal]");
  if (!items.length || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" }
  );
  // Anything already on screen stays visible, so nothing flashes.
  for (const el of items) {
    if (el.getBoundingClientRect().top < innerHeight) el.classList.add("is-in");
    else observer.observe(el);
  }
  document.documentElement.classList.add("reveal-ready");
}

function storageNotice() {
  let told = false;
  const tell = () => {
    if (told) return;
    told = true;
    toast("Your browser is blocking storage, so changes will be lost when you leave this page.", { iconName: "triangle-alert", duration: 9000 });
  };
  document.addEventListener("sv:unsaved", tell);
}

/* ---------- Analytics: off until the visitor says yes ---------- */
function analytics() {
  if (!GTM_ID) return;
  const choice = storage.get("preferences").analytics;
  if (choice === "yes") return loadTagManager();
  if (choice === "no" || !storage.available) return;
  const save = (value) => {
    storage.update("preferences", (p) => ({ ...p, analytics: value }));
    box.remove();
    if (value === "yes") loadTagManager();
  };
  const box = h(
    "section",
    { class: "consent", "aria-label": "Analytics choice" },
    h("p", {}, h("strong", {}, "Allow visit statistics? "), "Google Tag Manager stays off unless you agree. SoloVoyage does not send your trips, lists or contacts anywhere. ", h("a", { href: "privacy.html#analytics" }, "Details")),
    h("div", { class: "row" }, h("button", { type: "button", class: "btn btn--secondary btn--sm", onclick: () => save("no") }, "No thanks"), h("button", { type: "button", class: "btn btn--secondary btn--sm", onclick: () => save("yes") }, "Allow"))
  );
  // Wait until the visitor has settled in, so the question never competes with the first impression.
  setTimeout(() => document.body.append(box), 12000);
}

function loadTagManager() {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  document.head.append(h("script", { async: true, src: `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}` }));
}

/* ---------- Offline support ---------- */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  window.addEventListener("load", async () => {
    try {
      const hadController = Boolean(navigator.serviceWorker.controller);
      const registration = await navigator.serviceWorker.register(new URL("../sw.js", import.meta.url), { updateViaCache: "none" });
      const offer = (worker) =>
        toast("A new version of SoloVoyage is ready.", { iconName: "sparkle", duration: 0, actionLabel: "Refresh", action: () => worker.postMessage("skip-waiting") });
      if (registration.waiting && hadController) offer(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => worker.state === "installed" && navigator.serviceWorker.controller && offer(worker));
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || reloading) return;
        reloading = true;
        location.reload();
      });
    } catch {
      /* Offline support is optional; the site works without it. */
    }
  });
  window.addEventListener("offline", () => toast("You are offline. Pages that are saved for offline use still work; external links do not.", { iconName: "wifi-off", duration: 7000 }));
  window.addEventListener("online", () => toast("You are back online."));
}
