/* Runs before first paint: sets the theme and reserves space for the announcement. */
(function () {
  var root = document.documentElement;
  function read(key) {
    try {
      var raw = JSON.parse(localStorage.getItem(key));
      return raw && raw.v === 1 ? raw.data : null;
    } catch (e) {
      return null;
    }
  }
  var choice = read("solovoyage_theme");
  var dark = choice === "dark" || (choice !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  var prefs = read("solovoyage_preferences");
  if (!prefs || prefs.announcement !== "v2") root.dataset.announce = "";
})();
