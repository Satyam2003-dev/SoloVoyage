/*
 * SoloVoyage service worker: caches the site's own static files so guides and tools work offline.
 * Personal data lives in localStorage and is never handled or cached here.
 * VERSION and PRECACHE are maintained by tools/build_pages.py. Bump VERSION by hand if you skip it.
 */
const VERSION = "08fff09c4a";
const PREFIX = "solovoyage-";
const CACHE = `${PREFIX}${VERSION}`;
const PRECACHE = [
  "about.html",
  "accommodation-safety.html",
  "bookmarks.html",
  "checklist.html",
  "daily-exploration.html",
  "dashboard.html",
  "destinations.html",
  "digital-safety.html",
  "emergency-response.html",
  "emergency.html",
  "food-drink-safety.html",
  "guide.html",
  "guides.html",
  "index.html",
  "money-valuables.html",
  "offline.html",
  "packing-preparation.html",
  "packing.html",
  "planner.html",
  "pre-trip-foundation.html",
  "privacy.html",
  "search.html",
  "social-safety.html",
  "transportation-safety.html",
  "css/base.css",
  "css/components.css",
  "css/gradients.css",
  "css/layout.css",
  "css/pages.css",
  "css/responsive.css",
  "css/themes.css",
  "css/tokens.css",
  "js/app.js",
  "js/components.js",
  "js/config.js",
  "js/data.js",
  "js/layout.js",
  "js/packing-data.js",
  "js/search.js",
  "js/storage.js",
  "js/theme-init.js",
  "js/theme.js",
  "js/trip.js",
  "js/utils.js",
  "js/pages/bookmarks.js",
  "js/pages/category.js",
  "js/pages/checklist.js",
  "js/pages/dashboard.js",
  "js/pages/destinations.js",
  "js/pages/emergency.js",
  "js/pages/guide.js",
  "js/pages/guides.js",
  "js/pages/home.js",
  "js/pages/packing.js",
  "js/pages/planner.js",
  "js/pages/privacy.js",
  "js/pages/search.js",
  "data/categories.json",
  "data/checklist.json",
  "data/destinations.json",
  "data/emergency.json",
  "data/guides.json",
  "assets/fonts/fraunces-latin.woff2",
  "assets/fonts/geist-latin.woff2",
  "manifest.json",
  "assets/icons/sprite.svg",
  "assets/icons/favicon.svg",
  "assets/icons/icon-192.png",
  "assets/images/contours.svg",
  "assets/images/hero-tall-828.avif",
  "assets/images/hero-wide-1280.avif",
];

/* Relative URLs resolve against the worker's own folder, so this works under /SoloVoyage/ on GitHub Pages. */
const absolute = (path) => new URL(path, self.location).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((path) => new Request(absolute(path), { cache: "reload" }))))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

/* A new version waits until the visitor presses Refresh, so a page never changes underneath them. */
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.href.startsWith(absolute("./"))) return;
  event.respondWith(respond(request, url));
});

async function respond(request, url) {
  const cache = await caches.open(CACHE);
  // Query strings (guide.html?id=…, search.html?q=…) are read by page scripts, so one cached shell serves them all.
  const isPage = request.mode === "navigate";
  let key = url.origin + url.pathname;
  if (isPage && key.endsWith("/")) key += "index.html";
  const cached = await cache.match(key);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // Only same-version static images are added after install; nothing with a query string is stored.
    if (response.ok && !url.search && /\.(avif|webp|jpg|png|svg)$/.test(url.pathname)) cache.put(key, response.clone());
    return response;
  } catch (error) {
    if (isPage) return (await cache.match(absolute("offline.html"))) || Response.error();
    if (request.destination === "image") {
      // Fall back to any saved size of the hero photograph.
      const hero = /hero-(tall|wide)-/.exec(url.pathname);
      const spare = hero && (await cache.match(absolute(hero[1] === "tall" ? "assets/images/hero-tall-828.avif" : "assets/images/hero-wide-1280.avif")));
      if (spare) return spare;
    }
    throw error;
  }
}
