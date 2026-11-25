# SoloVoyage 1.x audit

Audited commit: `146c31f` (2025-07-01). Every file was read; counts below come from parsing the HTML, not from the README.

## 1. Architecture

- 12 standalone HTML files, one stylesheet (4.8 KB), one script (2.4 KB), one photo (1.9 MB, 6000 × 3000).
- The header, mobile menu and footer are copied by hand into all 12 files.
- Styling depends on the Tailwind CDN **runtime compiler** plus per-page `<style>` blocks that repeat `main.css`.
- Third-party hosts contacted on every page: Tailwind CDN, Google Fonts, unpkg (AOS) and Google Tag Manager.

## 2. Visual design

Dark theme only. Sky/violet gradient titles, amber card headings, rounded cards, AOS fade-ups. Consistent, but generic, and text-heavy pages have no internal navigation.

## 3. Content inventory

| Page | Tips |
| --- | --- |
| Pre-Trip Foundation | 1 to 10 |
| Packing & Preparation | 11 to 20 |
| Transportation Safety | 21 to 30 |
| Accommodation Safety | 31 to 40 |
| Daily Exploration | 41 to 50 |
| Money & Valuables | 51 to 60 |
| Digital Safety | 61 to 70 |
| Food & Drink Safety | 71 to 80 |
| Social Safety | 81 to 90 |
| Emergency Response | 91 to 101 |
| The Full Checklist | 48 checklist actions (18 before, 22 daily, 8 emergency) |

So the "101 tips" are real, and the "11 categories" are **10 tip categories plus The Full Checklist**. Version 2 keeps all eleven.

## 4. Useful features worth keeping

Complete, well-grouped advice; three or four labelled points per tip; stable page URLs that are already indexed; works as plain static files.

## 5. Missing

Search, filtering, individual guide links, bookmarks, interactive checklist, planner, packing list, emergency contacts, theme choice, offline use, persistence of any kind, privacy information, 404 page.

## 6. Broken or fragile

- Checklist items look like ticks but cannot be ticked.
- `data-aos-="fade-up"` typo on the Digital Safety card.
- README lists `assets/images/`; the folder is `assets/image/`.
- If unpkg is blocked, `AOS.init` throws before the mobile menu is wired up, so the menu stops working.
- README says 11 pages; there are 12.

## 7. UX

One long page per category with no way to jump to or share a single tip. No route from reading advice to doing something about it. Nothing for a traveller who needs help quickly.

## 8. Accessibility

- Desktop dropdowns open on hover only, so keyboard users cannot reach ten of the twelve pages from the header.
- The menu button has no accessible name or expanded state; Escape does nothing; no skip link; focus outlines are removed.
- Bold-only intros and gradient text with no forced-colours fallback. No reduced-motion handling.

## 9. SEO

No meta descriptions, canonicals, Open Graph tags, sitemap, robots.txt or favicon. Tips have no URLs of their own.

## 10. Performance

1.9 MB hero image loaded on every page through CSS, a client-side CSS compiler, and render-blocking third-party files.

## 11. Technical debt and content accuracy

Content and markup are fused. Navigation changes mean editing twelve files. Some advice needed qualifying: a fixed insurance figure, RFID risk, VPN legality, "first responders are trained to look for ICE", and lift use during a fire.

## 12. Plan and status

- [x] Keep every existing URL working (category pages stay where they were)
- [x] Move all 101 tips into one structured file with stable ids and compare them against the originals
- [x] Design tokens, light and dark themes, component library
- [x] Homepage, guide hub, guide reader, category pages
- [x] Search, bookmarks, read tracking, recently viewed
- [x] Checklist, trip planner, packing and documents organizer
- [x] Emergency Center with locally stored contacts
- [x] Dashboard, destination sources, privacy and data controls
- [x] Offline support, manifest, sitemap, structured data
- [ ] Automated QA in three browser engines

The test suite is `tests/qa.py`.
