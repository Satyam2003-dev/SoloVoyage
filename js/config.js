/** Site-wide settings. Edit here rather than in individual pages. */
export const SITE_URL = "https://satyam2003-dev.github.io/SoloVoyage/";
export const REPO_URL = "https://github.com/Satyam2003-dev/SoloVoyage";

/** Google Tag Manager container from SoloVoyage 1.x. Loaded only after a visitor opts in. Use "" to remove it. */
export const GTM_ID = "GTM-5K55P3LW";

/** Change the id when the message changes, and update the same id in theme-init.js. */
export const ANNOUNCEMENT = {
  id: "v2",
  text: "SoloVoyage 2.0 is here: plan, pack and prepare in one place.",
  linkText: "See what it does",
  href: "about.html",
};

export const NAV = [
  { id: "home", label: "Home", href: "index.html", icon: "house" },
  { id: "guides", label: "Explore Guides", short: "Guides", href: "guides.html", icon: "book-open" },
  { id: "planner", label: "Trip Planner", short: "Planner", href: "planner.html", icon: "route" },
  { id: "checklist", label: "Checklist", href: "checklist.html", icon: "list-checks" },
  { id: "emergency", label: "Emergency Center", short: "Emergency", href: "emergency.html", icon: "life-buoy" },
  { id: "about", label: "About", href: "about.html", icon: "info" },
];

export const NAV_MORE = [
  { id: "dashboard", label: "Dashboard", href: "dashboard.html" },
  { id: "packing", label: "Packing & documents", href: "packing.html" },
  { id: "bookmarks", label: "Saved guides", href: "bookmarks.html" },
  { id: "destinations", label: "Destination sources", href: "destinations.html" },
  { id: "search", label: "Search", href: "search.html" },
  { id: "privacy", label: "Privacy & your data", href: "privacy.html" },
];

export const TABS = ["home", "guides", "planner", "checklist", "emergency"];
