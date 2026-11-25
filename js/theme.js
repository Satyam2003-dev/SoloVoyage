/** Light, dark and system themes. theme-init.js applies the saved choice before first paint. */
import * as storage from "./storage.js";

const media = matchMedia("(prefers-color-scheme: dark)");
export const THEMES = [
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
  { id: "system", label: "System", icon: "monitor" },
];

const resolve = (choice) => (choice === "system" ? (media.matches ? "dark" : "light") : choice);

function apply(choice, animate = false) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add("theme-switching");
    setTimeout(() => root.classList.remove("theme-switching"), 320);
  }
  root.dataset.theme = resolve(choice);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", root.dataset.theme === "dark" ? "#08131f" : "#faf6ed");
}

export const current = () => storage.get("theme");
export const setTheme = (choice) => storage.set("theme", choice);
export const nextTheme = () => THEMES[(THEMES.findIndex((t) => t.id === current()) + 1) % THEMES.length];

storage.subscribe("theme", (choice) => apply(choice, true));
media.addEventListener("change", () => current() === "system" && apply("system", true));
apply(current());
