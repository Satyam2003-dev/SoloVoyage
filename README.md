# SoloVoyage

**Travel solo. Travel smart.** A free preparation and safety companion for people who travel on their own: 101 practical guides, plus the tools to act on them. No account, no backend, no build step.

## Features

- **Knowledge hub:** all 101 guides in 10 categories (the eleventh category is The Full Checklist), each with its own page, practical points, related guides, bookmarking, sharing, printing and read tracking. Official links are added where a point needs one.
- **Search:** covers titles, tags, categories, summaries, body text and the emergency guides. Highlighted matches, category filter, partial-match fallback, and a `/` keyboard shortcut.
- **Trip planner:** several trips, six preparation stages, editable tasks, date validation, progress and suggested milestones.
- **Checklist:** 48 actions in 9 areas, your own tasks, phase and status filters, undo, reset and printing.
- **Packing and documents:** quantities and custom items. The document tracker stores a status only and has no field for numbers or scans.
- **Emergency Center:** 10 situations with priorities, actions and things to avoid. Works without JavaScript. Includes sourced emergency numbers and a contact card kept in your browser.
- **Dashboard and library:** built only from what you have actually saved.
- **Destination sources:** official government and health links with questions to answer. No safety scores.
- **Light, dark and system themes**, a mobile tab bar, offline support, and data export, restore and delete.

## Technology

HTML5, CSS3 and JavaScript ES modules. No framework, package manager or runtime dependency. Fonts (Fraunces, Geist; OFL) and icons (Lucide; ISC) are served locally.

## Architecture

- **Content is data.** Guides, categories, checklist, emergency and destination content live in `data/*.json`. A guide is rendered by `guide.html?id=<stable-id>`.
- **One shell.** `js/layout.js` builds the header, drawer, tab bar, search and footer for every page.
- **One entry point.** `js/app.js` loads the module named by `<body data-page>`.
- **One storage layer.** Only `js/storage.js` reads or writes `localStorage` (`theme-init.js` reads two values before first paint). Values are versioned and validated.
- **Safe rendering.** User text and content are inserted as text nodes, never as HTML.

```
index.html, guides.html, guide.html, <category>.html, planner.html, checklist.html,
packing.html, emergency.html, dashboard.html, bookmarks.html, search.html,
destinations.html, about.html, privacy.html, offline.html, 404.html
css/      tokens, themes, base, layout, components, pages, responsive
js/       shared modules; js/pages/ one module per page
data/     guides, categories, checklist, emergency, destinations
assets/   fonts, icons, images, screenshots, image/ (original photograph)
sw.js, manifest.json, sitemap.xml, robots.txt
tools/    build_pages.py (optional maintenance helper)
tests/    qa.py (development only)
docs/     AUDIT.md
```

## Run locally

ES modules and `fetch` need a web server, so opening a file directly will not work.

```bash
git clone https://github.com/Satyam2003-dev/SoloVoyage.git
cd SoloVoyage
python -m http.server 8000
```

Then open <http://localhost:8000/>.

## Deploy on GitHub Pages

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, then `main` and `/ (root)`.
3. The site is served at `https://<user>.github.io/SoloVoyage/`.

All paths are relative, so it also works on any other static host. If your address differs, change `SITE_URL` in `js/config.js` and `SITE` in `tools/build_pages.py`, then run the helper to update canonical links and the sitemap. `robots.txt` is only read from a domain root, so on a project site submit `sitemap.xml` in your search console.

## Editing content

Edit the JSON in `data/`, then run:

```bash
python tools/build_pages.py
```

This refreshes the static pages (home, Emergency Center, category shells), the sitemap and the offline cache version. It uses only the Python standard library. If you edit by hand instead, change `VERSION` in `sw.js`, or returning visitors will keep the old files. Edit shared page markup in the helper, because it overwrites the HTML files.

Settings such as the announcement and analytics container are in `js/config.js`.

## Data and privacy

Data is stored in `localStorage` under `solovoyage_*` keys: theme, bookmarks, recently_viewed, read, checklist, trips, packing, documents, contacts and preferences. **It is not encrypted**, and anyone using the same browser profile can read it. The privacy page lists each key and offers export, restore and delete.

Google Tag Manager from version 1 is **off until the visitor allows it**. Set `GTM_ID` to `""` in `js/config.js` to remove it. No other third-party request is made unless the visitor follows an external link.

## Offline support

On https or localhost, the service worker saves the pages, scripts, styles, data and fonts on the first visit. Guides, search, tools and the Emergency Center then work offline. External links and live information do not. Updates wait until the visitor presses **Refresh**. Personal data is never put in the cache.

## Accessibility

Semantic HTML, skip link, keyboard operation, native dialogs, visible focus, announced updates, reduced motion and contrast-checked themes, following WCAG 2.2 AA principles. It has automated checks but **no independent audit or screen reader user testing**.

## Testing

```bash
pip install playwright
python -m playwright install
python tests/qa.py
```

The suite serves the site under `/SoloVoyage/` and runs in Chromium, Firefox and WebKit.

## Known limitations

- No accounts or sync. Data stays on one browser and can be cleared by it, so export a backup.
- No live advisories, destination ratings, maps, weather or emergency dispatch.
- Emergency numbers cover a short list of places, recorded on 26 November 2026. They need periodic review, and visitors must confirm them locally.
- Guide pages are rendered with JavaScript. Link preview services that do not run it show the generic guide card.
- Guides are general advice and have not been reviewed by a professional safety, legal or medical adviser.
- English only.

## Roadmap

1. Scheduled review of official links and emergency numbers, with a visible review date per entry.
2. Pre-rendered guide pages for better link previews.
3. Hindi and other translations.
4. Optional passphrase encryption for contacts.
5. Calendar export for planner milestones.
6. Testing with screen reader users and on physical phones.

## Contributing

Open an issue first for content changes, and include an official source for any factual or country-specific claim. Never add an emergency number without one. Keep the project free of frameworks and build requirements, and run `python tests/qa.py` before a pull request.

## Disclaimer

SoloVoyage offers general information to help you prepare. It is not legal, medical, financial or security advice and cannot guarantee safety. In an emergency, contact local emergency services.
