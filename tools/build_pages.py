#!/usr/bin/env python3
"""
Optional maintenance helper. The website does NOT need a build step: its output is committed.

Run `python tools/build_pages.py` after changing a shared <head>, page copy in this file,
data/categories.json or data/emergency.json. It rewrites the HTML pages, sitemap.xml and
the service worker's file list and cache version. Standard library only.
"""
import hashlib
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://satyam2003-dev.github.io/SoloVoyage/"
UPDATED = "2026-11-26"


def read(name):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


CATS = read("categories.json")["categories"]
GUIDES = read("guides.json")["guides"]
EMERGENCY = read("emergency.json")
CHECK = read("checklist.json")
G = {g["id"]: g for g in GUIDES}
e = lambda s: html.escape(str(s), quote=True)


def icon(name, extra=""):
    cls = ("icon " + extra).strip()
    return f'<svg class="{cls}" aria-hidden="true"><use href="assets/icons/sprite.svg#{name}"/></svg>'


MODULES = ["app", "config", "utils", "storage", "components", "layout", "search", "data", "theme"]


def page(file, *, title, desc, body, nav="", name="", cls="", attrs="", robots="", extra_head="", canonical=None):
    url = SITE + ("" if file == "index.html" else file) if canonical is None else canonical
    modules = "".join(f'\n  <link rel="modulepreload" href="js/{m}.js">' for m in MODULES)
    out = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">{f'''
  <meta name="robots" content="{robots}">''' if robots else ""}
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="SoloVoyage">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{SITE}assets/images/social-card.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="A solo traveller with a headlamp beside a lit tent under a night sky">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#faf6ed">
  <script src="js/theme-init.js"></script>
  <link rel="icon" href="assets/icons/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
  <link rel="manifest" href="manifest.json">
  <link rel="preload" href="assets/fonts/geist-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/fraunces-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/themes.css">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/layout.css">
  <link rel="stylesheet" href="css/components.css">
  <link rel="stylesheet" href="css/pages.css">
  <link rel="stylesheet" href="css/gradients.css">
  <link rel="stylesheet" href="css/responsive.css">{extra_head}
  <script type="module" src="js/app.js"></script>{modules}{f'''
  <link rel="modulepreload" href="js/pages/{name}.js">''' if name else ""}
</head>
<body{f' class="{cls}"' if cls else ""} data-nav="{nav}" data-page="{name}"{attrs}>
  <a class="skip-link" href="#main">Skip to content</a>
  <site-header></site-header>
  <main id="main" tabindex="-1">
{body.rstrip()}
  </main>
  <site-footer></site-footer>
  <noscript><nav class="noscript-nav" aria-label="Main"><p>JavaScript is off. Interactive tools are unavailable.</p><a href="index.html">Home</a> <a href="guides.html">Guides</a> <a href="emergency.html">Emergency Center</a> <a href="about.html">About</a></nav></noscript>
</body>
</html>
"""
    (ROOT / file).write_text(out, encoding="utf-8", newline="\n")


def head(title, lead, *, eyebrow="", crumbs=(), aside=""):
    c = ""
    if crumbs:
        c = '<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>' + "".join(f'<li><a href="{h}">{e(t)}</a></li>' for t, h in crumbs) + "</ol></nav>"
    eb = f'<p class="eyebrow">{eyebrow}</p>' if eyebrow else ""
    return f"""    <header class="page-head">
      <div class="container page-head__grid">
        <div>{c}{eb}<h1>{e(title)}</h1><p class="lead">{e(lead)}</p></div>
        {aside}
      </div>
    </header>"""


def app(skeletons=3, cls="section--tight"):
    sk = '<div class="skeleton"></div>' * skeletons
    return f"""    <div class="container {cls}">
      <div data-app><p class="visually-hidden">Loading</p><div class="grid grid--3" aria-hidden="true">{sk}</div></div>
      <noscript><p class="empty">This tool needs JavaScript. The <a href="emergency.html">Emergency Center</a> guidance works without it.</p></noscript>
    </div>"""


# ---------------------------------------------------------------- Home
guide_cats = [c for c in CATS if c["type"] == "guides"]
count = {c["id"]: sum(g["category"] == c["id"] for g in GUIDES) for c in guide_cats}


def cat_tile(i, c):
    meta = f'{count[c["id"]]} guides' if c["type"] == "guides" else f'{len(CHECK["items"])} actions'
    return f"""          <li class="cat-tile cat-tile--{i}"><a href="{c['page']}">{icon(c['icon'])}<span class="cat-tile__text"><span class="cat-tile__name">{e(c['name'])}</span><span class="cat-tile__desc">{e(c['description'])}</span></span><span class="cat-tile__meta">{meta}</span></a></li>"""


def minutes(g):
    parts = [g["summary"], g["intro"], g.get("note", ""), g.get("warning", "")] + [a["title"] + " " + a["text"] for a in g["actions"]]
    return max(1, int(len(" ".join(parts).split()) / 200 + 0.5))


cat_name = {c["id"]: c["name"] for c in CATS}
featured_ids = ["research-your-destination", "share-your-plans", "use-official-taxis", "know-emergency-exits", "divide-your-money"]


def feature(gid, lead=False):
    g = G[gid]
    meta = f'{e(cat_name[g["category"]])} · {minutes(g)} min read'
    summary = f'<p>{e(g["summary"])}</p>'
    return f"""<li class="feature{' feature--lead' if lead else ''}"><span class="feature__num" aria-hidden="true">{g['number']:03d}</span><div><h3><a href="guide.html?id={gid}">{e(g['title'])}</a></h3>{summary}<p class="feature__meta">{meta}</p></div></li>"""


prep = [
    ("file-text", "Documents", "Check validity, make copies and track what is ready.", "packing.html#documents", "Track documents"),
    ("bed-double", "Accommodation", "Choose the area first, then check locks and exits.", "accommodation-safety.html", "Stay securely"),
    ("train-front", "Transportation", "Plan the airport run and learn the late-night options.", "transportation-safety.html", "Move safely"),
    ("wallet", "Money", "Split cash and cards, and keep a reserve apart.", "money-valuables.html", "Protect money"),
    ("lock", "Digital security", "Secure your phone, accounts and location.", "digital-safety.html", "Lock it down"),
    ("life-buoy", "Emergency readiness", "Save numbers and contacts while you are calm.", "emergency.html", "Get ready"),
]
faqs = [
    ("Is SoloVoyage free? Do I need an account?", "It is free and open source, and there is no account. Your trips, lists and saved guides are kept in your own browser."),
    ("Where is my information stored?", 'In this browser\'s local storage on your device. It is not encrypted, so anyone who can use this browser profile could read it. You can export or delete it from the <a href="privacy.html">privacy page</a>.'),
    ("Does it work offline?", 'After your first visit over a secure (https) connection, the guides, tools and Emergency Center are saved for offline use. External links, official advisories and anything live still need a connection. See <a href="about.html#offline">what works offline</a>.'),
    ("Can SoloVoyage tell me whether a destination is safe?", 'No. It does not rate countries or show live risk data. It helps you prepare and points you to <a href="destinations.html">official government sources</a>.'),
    ("Can it contact emergency services for me?", 'No. SoloVoyage cannot call for help, track you or send alerts. In an emergency, use your phone to call the local emergency number. The <a href="emergency.html">Emergency Center</a> explains how to prepare.'),
    ("How reliable is the advice?", "The guides are general good practice, not legal or medical advice. Rules differ by country and change, so check official sources for anything that matters to your trip."),
]

faq_html = "".join(f'<details><summary><span>{e(q)}</span>{icon("chevron-down")}</summary><div class="accordion__body"><p>{a}</p></div></details>' for q, a in faqs)

home = f"""    <section class="hero" aria-labelledby="hero-title">
      <picture class="hero__media">
        <source media="(max-width: 47.99rem)" type="image/avif" srcset="assets/images/hero-tall-480.avif 480w, assets/images/hero-tall-828.avif 828w" sizes="100vw">
        <source media="(max-width: 47.99rem)" type="image/webp" srcset="assets/images/hero-tall-480.webp 480w, assets/images/hero-tall-828.webp 828w" sizes="100vw">
        <source media="(max-width: 47.99rem)" srcset="assets/images/hero-tall-828.jpg">
        <source type="image/avif" srcset="assets/images/hero-wide-1280.avif 1280w, assets/images/hero-wide-1920.avif 1920w, assets/images/hero-wide-2560.avif 2560w" sizes="100vw">
        <source type="image/webp" srcset="assets/images/hero-wide-1280.webp 1280w, assets/images/hero-wide-1920.webp 1920w, assets/images/hero-wide-2560.webp 2560w" sizes="100vw">
        <img src="assets/images/hero-wide-1280.jpg" width="1280" height="640" alt="A solo traveller wearing a headlamp stands beside a lit orange tent under a star-filled sky" fetchpriority="high" decoding="async">
      </picture>
      <div class="container hero__content">
        <h1 id="hero-title">Travel Solo. <span>Travel Smart.</span> Travel Fearlessly.</h1>
        <p class="hero__lead">Your trusted companion for safer, smarter and more confident solo adventures.</p>
        <div class="hero__cta">
          <a class="btn btn--primary btn--lg" href="guides.html">Explore Safety Guides {icon("arrow-right", "icon--nudge")}</a>
          <a class="btn btn--on-dark btn--lg" href="planner.html">Prepare for Your Trip</a>
        </div>
      </div>
    </section>

    <nav class="now-strip" aria-label="Start where you are">
      <div class="container">
        <ul>
          <li><a href="planner.html">{icon("route")}<span><strong>Planning a trip</strong><span>Work through six stages</span></span></a></li>
          <li><a href="checklist.html">{icon("plane-takeoff")}<span><strong>Leaving soon</strong><span>Check what is still open</span></span></a></li>
          <li><a class="now-strip__sos" href="emergency.html">{icon("life-buoy")}<span><strong>Travelling now</strong><span>Emergency help and contacts</span></span></a></li>
          <li><a href="guides.html">{icon("book-open")}<span><strong>Learning</strong><span>Search {len(GUIDES)} guides</span></span></a></li>
        </ul>
      </div>
    </nav>

    <section class="section" aria-labelledby="intro-title">
      <div class="container intro">
        <div class="stack">
          <h2 id="intro-title">Preparation is what makes independence feel easy</h2>
        </div>
        <div class="stack">
          <p class="lead">When you travel alone there is nobody beside you to double-check the plan. SoloVoyage helps you do it yourself: read practical safety advice, turn it into tasks, and keep what you need close.</p>
          <p class="muted">No guide can remove risk or guarantee safety. Good preparation means fewer surprises, and knowing your next step when one happens.</p>
          <ol class="how">
            <li><strong>Read</strong><span>{len(GUIDES)} short guides in {len(guide_cats)} categories.</span></li>
            <li><strong>Prepare</strong><span>A trip plan, checklist, packing list and document status.</span></li>
            <li><strong>Carry</strong><span>Saved guides and your own emergency contacts.</span></li>
          </ol>
        </div>
      </div>
    </section>

    <section class="section section--tint" aria-labelledby="cat-title">
      <div class="container">
        <div class="section-head" data-reveal><h2 id="cat-title">Eleven categories, from first research to first aid</h2><p class="lead">Follow them in order as you plan, or go straight to the one you need.</p></div>
        <ul class="cat-grid">
{chr(10).join(cat_tile(i + 1, c) for i, c in enumerate(CATS))}
        </ul>
      </div>
    </section>

    <section class="section" aria-labelledby="feat-title">
      <div class="container">
        <div class="section-head" data-reveal><h2 id="feat-title">Guides worth reading first</h2></div>
        <ol class="features">
          {"".join(feature(g, i == 0) for i, g in enumerate(featured_ids))}
        </ol>
        <p style="margin-top:2rem"><a class="btn btn--secondary" href="guides.html">See all {len(GUIDES)} guides {icon("arrow-right", "icon--nudge")}</a></p>
      </div>
    </section>

    <section class="section band" aria-labelledby="prep-title">
      <div class="container prep">
        <figure class="prep__photo" data-reveal>
          <picture>
            <source type="image/avif" srcset="assets/images/tent-640.avif 640w, assets/images/tent-1200.avif 1200w" sizes="(min-width: 64rem) 34rem, 100vw">
            <img src="assets/images/tent-640.webp" srcset="assets/images/tent-640.webp 640w, assets/images/tent-1200.webp 1200w" sizes="(min-width: 64rem) 34rem, 100vw" width="640" height="400" alt="An orange and white tent lit from inside on a dark beach" loading="lazy" decoding="async">
          </picture>
        </figure>
        <div>
          <h2 id="prep-title">Get ready before you go</h2>
          <p class="lead">Six areas cause most of the avoidable stress. Sort each one while you are still at home.</p>
          <ul class="prep__list">
            {"".join(f'<li><a href="{h}">{icon(i)}<span><strong>{t}</strong><span>{d}</span></span><span class="prep__go">{cta}{icon("arrow-right")}</span></a></li>' for i, t, d, h, cta in prep)}
          </ul>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="check-title">
      <div class="container preview">
        <div class="stack" data-reveal>
          <h2 id="check-title">Your checklist, as it stands</h2>
          <p class="lead">{len(CHECK["items"])} actions for before you leave, while you travel and in an emergency. Add your own, print it, pick up where you stopped.</p>
          <p><a class="btn btn--primary" href="checklist.html">Open My Checklist {icon("arrow-right", "icon--nudge")}</a></p>
        </div>
        <div class="panel preview__panel stack" data-app><div class="skeleton" style="min-height:20rem"></div></div>
      </div>
    </section>

    <section class="section section--tint" aria-labelledby="em-title">
      <div class="container emergency-promo">
        <div class="stack">
          <p class="eyebrow">{icon("life-buoy")}Calm, clear steps</p>
          <h2 id="em-title">Prepare for the day something goes wrong</h2>
          <p class="lead">Most trips never need this page. Spend ten minutes on it anyway, so that your numbers and next steps are ready.</p>
          <div class="row"><a class="btn btn--primary" href="emergency.html">Open the Emergency Center</a><a class="btn btn--secondary" href="emergency.html#contacts">Save my contacts</a></div>
        </div>
        <ul class="emergency-promo__links">
          <li><a href="emergency.html#contacts">{icon("phone")}<span><strong>Important contacts</strong><span>Build your own contact card</span></span></a></li>
          <li><a href="emergency.html#lost-passport">{icon("stamp")}<span><strong>Lost passport</strong><span>What to do, in order</span></span></a></li>
          <li><a href="emergency.html#medical">{icon("heart-pulse")}<span><strong>Medical emergency</strong><span>First priorities</span></span></a></li>
          <li><a href="emergency.html#numbers">{icon("siren")}<span><strong>Emergency numbers</strong><span>With the source for each</span></span></a></li>
          <li><a href="emergency-response.html">{icon("shield-check")}<span><strong>Quick safety guides</strong><span>Eleven response guides</span></span></a></li>
        </ul>
      </div>
    </section>

    <section class="section" aria-labelledby="faq-title">
      <div class="container faq">
        <h2 id="faq-title">Questions travellers ask</h2>
        <div class="accordion">{faq_html}</div>
      </div>
    </section>

    <section class="cta-final" aria-labelledby="cta-title">
      <picture>
        <source type="image/avif" srcset="assets/images/campfire-640.avif 640w, assets/images/campfire-1400.avif 1400w" sizes="100vw">
        <img src="assets/images/campfire-640.webp" srcset="assets/images/campfire-640.webp 640w, assets/images/campfire-1400.webp 1400w" sizes="100vw" width="640" height="400" alt="" loading="lazy" decoding="async">
      </picture>
      <div class="container stack">
        <h2 id="cta-title">Before you travel, give it one good hour</h2>
        <p>Start a plan, tick what you have done, and see what is left.</p>
        <div class="row"><a class="btn btn--primary btn--lg" href="planner.html">Start my trip plan</a><a class="btn btn--on-dark btn--lg" href="checklist.html">Open the checklist</a></div>
      </div>
    </section>"""

ld = {"@context": "https://schema.org", "@type": "WebSite", "name": "SoloVoyage", "url": SITE, "description": "Solo travel safety guides and trip preparation tools.", "potentialAction": {"@type": "SearchAction", "target": {"@type": "EntryPoint", "urlTemplate": SITE + "search.html?q={search_term_string}"}, "query-input": "required name=search_term_string"}}
hero_preload = """
  <link rel="preload" as="image" type="image/avif" media="(max-width: 47.99rem)" imagesrcset="assets/images/hero-tall-480.avif 480w, assets/images/hero-tall-828.avif 828w" imagesizes="100vw" fetchpriority="high">
  <link rel="preload" as="image" type="image/avif" media="(min-width: 48rem)" imagesrcset="assets/images/hero-wide-1280.avif 1280w, assets/images/hero-wide-1920.avif 1920w, assets/images/hero-wide-2560.avif 2560w" imagesizes="100vw" fetchpriority="high">"""
page("index.html", title="SoloVoyage: Solo Travel Safety and Trip Preparation", desc=f"{len(GUIDES)} practical solo travel safety guides, a trip planner, checklist, packing organizer and Emergency Center. Free, with no account.", body=home, nav="home", name="home", cls="page-home", extra_head=hero_preload + f'\n  <script type="application/ld+json">{json.dumps(ld)}</script>')

# ---------------------------------------------------------------- Library and tools
page("guides.html", title="Explore Safety Guides | SoloVoyage", desc=f"Search and filter {len(GUIDES)} solo travel safety guides in {len(guide_cats)} categories.", nav="guides", name="guides",
     body=head("Safety guides", f"{len(GUIDES)} practical guides in {len(guide_cats)} categories. Search them, filter them and save the ones you need.") + "\n" + app(6) + f"""
    <section class="section section--tint" aria-labelledby="browse-title"><div class="container"><h2 id="browse-title" style="margin-bottom:1.5rem">Browse by category</h2><ul class="cat-links">{"".join(f'<li><a href="{c["page"]}">{icon(c["icon"])}<span>{e(c["name"])}</span></a></li>' for c in CATS)}</ul></div></section>""")

page("guide.html", title="Safety guide | SoloVoyage", desc="A SoloVoyage solo travel safety guide.", nav="guides", name="guide", robots="noindex",
     body="""    <div data-app><div class="page-head"><div class="container"><h1 class="visually-hidden">Loading guide</h1><div class="skeleton" style="min-height:12rem"></div></div></div></div>
    <noscript><p class="container section">Guides need JavaScript to display. The <a href="emergency.html">Emergency Center</a> works without it.</p></noscript>""")

for c in guide_cats:
    aside = f'<p class="page-head__stat">{icon(c["icon"])}<span>{count[c["id"]]} guides</span></p>'
    page(c["page"], title=f'{c["name"]} | SoloVoyage', desc=f'{count[c["id"]]} solo travel guides. {c["description"]}', nav="guides", name="category", attrs=f' data-category="{c["id"]}"',
         body=head(c["name"], c["intro"], crumbs=[("Guides", "guides.html")], aside=aside) + "\n" + app(3, "section--tight narrow"))

page("search.html", title="Search | SoloVoyage", desc="Search every SoloVoyage safety guide and emergency situation.", nav="search", name="search",
     body=head("Search", "Every safety guide and emergency situation, in one place.") + "\n" + app(3, "section--tight narrow"))
page("bookmarks.html", title="Saved Guides | SoloVoyage", desc="Your personal library of saved SoloVoyage safety guides.", nav="bookmarks", name="bookmarks", robots="noindex, follow",
     body=head("Your library", "The guides you saved. They stay in this browser.") + "\n" + app())
page("checklist.html", title="The Full Checklist | SoloVoyage", desc=f'An interactive solo travel safety checklist with {len(CHECK["items"])} actions, your own tasks, saved progress and printing.', nav="checklist", name="checklist",
     body=head("The Full Checklist", "Use it before and during your trip. Tick what you have really done; it saves as you go.") + "\n" + app())
page("planner.html", title="Trip Planner | SoloVoyage", desc="Plan a solo trip through six preparation stages, with tasks, progress and suggested milestones. No account needed.", nav="planner", name="planner",
     body=head("Trip planner", "Organize your preparation from first research to the journey itself. Nothing here books or verifies travel.") + "\n" + app())
page("packing.html", title="Packing and Document Organizer | SoloVoyage", desc="A packing list with quantities and a private document readiness tracker. No document numbers or scans are collected.", nav="packing", name="packing",
     body=head("Packing and documents", "Pack from a list you can change, and see which documents are ready.") + "\n" + app())
page("dashboard.html", title="Your Dashboard | SoloVoyage", desc="Your trip, checklist, saved guides and emergency preparation, from data kept in your browser.", nav="dashboard", name="dashboard", robots="noindex, follow",
     body=head("Your dashboard", "Your preparation at a glance. No account, and nothing leaves this browser.") + "\n" + app())
page("destinations.html", title="Destination Information Sources | SoloVoyage", desc="Official government travel advice, health sources and the questions to answer for any destination.", nav="destinations", name="destinations",
     body=head("Destination information", "Where to find reliable, current information. SoloVoyage does not score or rank destinations.") + "\n" + app(2))

# ---------------------------------------------------------------- Emergency Center (static content, works without JS)
def ul(items, cls):
    return f'<ul class="{cls}">' + "".join(f"<li>{e(x)}</li>" for x in items) + "</ul>"


def situation(s):
    guides = "".join(f'<li><a href="guide.html?id={g}">{e(G[g]["title"])}</a></li>' for g in s["guides"])
    res = "".join(f'<li><a href="{e(r["url"])}" target="_blank" rel="noopener noreferrer">{e(r["label"])}{icon("external-link")}<span class="visually-hidden"> (opens in a new tab)</span></a></li>' for r in s["resources"])
    return f"""        <details class="situation disclosure" id="{s['id']}">
          <summary><span class="situation__icon">{icon(s['icon'])}</span><span class="situation__title"><h3>{e(s['title'])}</h3><span>{e(s['summary'])}</span></span>{icon("chevron-down")}</summary>
          <div class="situation__body">
            <p>{e(s['situation'])}</p>
            <div class="priority"><h4>Immediate priorities</h4><ol>{"".join(f"<li>{e(x)}</li>" for x in s['priorities'])}</ol></div>
            <div class="grid grid--2">
              <div><h4>What to do next</h4>{ul(s['actions'], 'bullets')}</div>
              <div><h4>Avoid</h4>{ul(s['avoid'], 'bullets bullets--avoid')}</div>
            </div>
            <p class="situation__limits">{icon("info")}<span><strong>Country differences:</strong> {e(s['limits'])}</span></p>
            <div class="grid grid--2">
              <div><h4>Official and external resources</h4><ul class="sources">{res}</ul></div>
              <div><h4>Related guides</h4><ul class="sources">{guides}</ul></div>
            </div>
          </div>
        </details>"""


def number_row(n):
    nums = "".join(f'<span class="nowrap">{e(p["label"])}: <a href="tel:{p["number"]}"><strong>{p["number"]}</strong></a></span>' for p in n["primary"])
    return f'<tr><th scope="row">{e(n["area"])}</th><td class="nums">{nums}</td><td><a href="{e(n["url"])}" target="_blank" rel="noopener noreferrer">{e(n["source"])}<span class="visually-hidden"> (opens in a new tab)</span></a></td></tr>'


tiles = "".join(f'<li><a class="sit-tile" href="#{s["id"]}">{icon(s["icon"])}<span>{e(s["title"])}</span></a></li>' for s in EMERGENCY["situations"])
em = f"""    <header class="em-head">
      <div class="container">
        <h1>Emergency Center</h1>
        <p class="em-head__now">{icon("triangle-alert")}<span><strong>In immediate danger?</strong> Get to safety and call the local emergency number now, or ask someone near you to call.</span></p>
        <p class="em-head__limit">SoloVoyage cannot contact emergency services, send your location or alert anyone.</p>
        <ul class="em-jump"><li><a href="#situations">What happened?</a></li><li><a href="#numbers">Emergency numbers</a></li><li><a href="#contacts">My contacts</a></li></ul>
      </div>
    </header>

    <section class="container section--tight" id="situations" aria-labelledby="sit-title">
      <h2 id="sit-title">What happened?</h2>
      <ul class="sit-tiles">{tiles}</ul>
      <div class="situations">
{chr(10).join(situation(s) for s in EMERGENCY["situations"])}
      </div>
    </section>

    <section class="section--tight section--tint" id="numbers" aria-labelledby="num-title">
      <div class="container stack">
        <h2 id="num-title">Emergency numbers</h2>
        <p class="muted" style="max-width:var(--measure)">Only places with a recorded source are listed. Numbers can change, so confirm yours with an official source before you travel.</p>
        <div data-numbers></div>
        <details class="disclosure numbers-all"><summary><span>See the full list with sources</span>{icon("chevron-down")}</summary>
          <div class="table-wrap"><table class="data-table"><caption class="visually-hidden">Emergency numbers by country or region</caption><thead><tr><th scope="col">Country or region</th><th scope="col">Numbers</th><th scope="col">Source</th></tr></thead>
          <tbody>{"".join(number_row(n) for n in EMERGENCY["numbers"])}</tbody></table></div>
          <p class="small muted">Recorded 26 November 2026.</p>
        </details>
      </div>
    </section>

    <section class="container section--tight" id="contacts" aria-labelledby="con-title">
      <div class="split">
        <div class="stack">
          <h2 id="con-title">My emergency contacts</h2>
          <p class="muted">Keep the people and places you may need on one card. Calls and emails start only when you press the button.</p>
          <div class="callout callout--warning">{icon("lock")}<div><strong>Privacy</strong>Saved in this browser only, without encryption. Anyone using this browser profile can read it. Do not use a shared or public computer, and do not enter passport, card or policy numbers.</div></div>
          <p class="muted small">Browsers can clear stored data. Also keep these on paper and in your phone's own contacts.</p>
        </div>
        <div class="panel" data-contacts><p class="muted">Contacts need JavaScript. Write them on paper and keep it with you.</p></div>
      </div>
    </section>"""
page("emergency.html", title="Emergency Center: What to Do When Travel Goes Wrong | SoloVoyage", desc="Clear steps for medical emergencies, theft, a lost passport or phone, disasters and more, with sourced emergency numbers and your own contact card.", nav="emergency", name="emergency", body=em)

# ---------------------------------------------------------------- About and privacy
about = head("About SoloVoyage", "A free preparation companion for people who travel on their own.") + f"""
    <div class="container section--tight doc">
      <nav class="doc__toc" aria-label="On this page"><ul><li><a href="#what">What it does</a></li><li><a href="#content">About the content</a></li><li><a href="#offline">Offline use</a></li><li><a href="#accessibility">Accessibility</a></li><li><a href="#disclaimer">Disclaimer</a></li></ul></nav>
      <article class="prose">
        <h2 id="what">What it does</h2>
        <p>SoloVoyage brings {len(GUIDES)} safety guides together with the tools to act on them: a <a href="planner.html">trip planner</a>, a <a href="checklist.html">checklist</a>, a <a href="packing.html">packing and document organizer</a>, an <a href="emergency.html">Emergency Center</a> and a <a href="bookmarks.html">personal library</a>. There is no account and no server holding your data.</p>
        <h2 id="content">About the content</h2>
        <p>The {len(GUIDES)} guides and the {len(guide_cats)} categories come from the original SoloVoyage project. Version 2.0 edited them for clarity and added practical notes and warnings where a point needed context. Where a guide links to an official source, the link was checked on 26 November 2026; some government sites refuse automated checks.</p>
        <p>SoloVoyage has no certifications, partnerships or professional endorsements. If you find an error, please <a href="https://github.com/Satyam2003-dev/SoloVoyage/issues" target="_blank" rel="noopener noreferrer">report it on GitHub<span class="visually-hidden"> (opens in a new tab)</span></a>.</p>
        <h2 id="offline">Offline use</h2>
        <p>Offline support needs a secure connection (https, or localhost during development) and one successful visit while online.</p>
        <h3>Available offline</h3>
        <ul class="bullets"><li>All pages, all {len(GUIDES)} guides, search and the Emergency Center guidance</li><li>Your trip plan, checklist, packing list, saved guides and contacts, which live in your browser</li></ul>
        <h3>Not available offline</h3>
        <ul class="bullets"><li>External links, government advisories and anything that changes live</li><li>Updates to the guides until you reconnect</li></ul>
        <p>Browsers may clear offline files when space is short. Keep a paper copy of anything essential.</p>
        <h2 id="accessibility">Accessibility</h2>
        <p>SoloVoyage aims to follow WCAG 2.2 AA principles: keyboard operation, visible focus, sufficient contrast, labelled forms, announced updates and reduced motion. It has not had an independent audit or testing with screen reader users. Please report anything that gets in your way.</p>
        <h2 id="disclaimer">Disclaimer</h2>
        <p>SoloVoyage gives general information to help you prepare. It is not legal, medical, financial, insurance or security advice, and it cannot guarantee your safety. Laws, entry rules, health risks and emergency numbers differ by country and change over time. Check current official sources for your destination, and use your own judgement. In an emergency, contact local emergency services.</p>
        <h2>Credits</h2>
        <p>Typefaces: Fraunces and Geist (SIL Open Font License). Icons: Lucide (ISC licence). The night camping photograph comes from the original SoloVoyage repository.</p>
      </article>
    </div>"""
page("about.html", title="About SoloVoyage | Solo Travel Preparation", desc="What SoloVoyage does, where its content comes from, what works offline, and its limits.", nav="about", body=about)

privacy = head("Privacy and your data", "What is stored, where it lives, and how to remove it.") + f"""
    <div class="container section--tight doc">
      <nav class="doc__toc" aria-label="On this page"><ul><li><a href="#summary">Summary</a></li><li><a href="#your-data">Your data</a></li><li><a href="#analytics">Visit statistics</a></li><li><a href="#links">Links and hosting</a></li></ul></nav>
      <div>
        <article class="prose">
          <h2 id="summary">Summary</h2>
          <ul class="bullets"><li>SoloVoyage has no accounts and no database. What you type is saved in this browser's local storage.</li><li>Local storage is <strong>not encrypted</strong>. Anyone who can use this browser profile, and some browser extensions, can read it.</li><li>The site never asks for passport numbers, document scans or payment details. Please do not type them into free text fields.</li><li>Clearing your browser data deletes your SoloVoyage data. Private windows usually forget it when closed.</li></ul>
          <h2 id="your-data">Your data</h2>
        </article>
        <div data-app><p class="muted">Data controls need JavaScript. You can also clear this site's data in your browser settings.</p></div>
        <article class="prose">
          <h2 id="analytics">Visit statistics</h2>
          <p>The earlier SoloVoyage site used Google Tag Manager on every page. It is now off until you allow it. If you allow it, Google receives technical information about your visit, such as pages viewed, device type and IP address, under Google's own terms, and the tags configured in the container may set cookies. SoloVoyage's code does not send your trips, lists or contacts to it. Page addresses can contain a search term or guide name.</p>
          <div data-analytics></div>
          <h2 id="links">Links and hosting</h2>
          <p>External links open the other site, which has its own privacy rules. Whoever hosts this site, such as GitHub Pages, may log technical details such as your IP address. Fonts, icons and images are served with the site itself.</p>
        </article>
      </div>
    </div>"""
page("privacy.html", title="Privacy and Your Data | SoloVoyage", desc="What SoloVoyage stores in your browser, how to export or delete it, and how optional visit statistics work.", nav="privacy", name="privacy", body=privacy)

page("offline.html", title="You are offline | SoloVoyage", desc="This page is not saved for offline use.", robots="noindex",
     body=head("You are offline", "That page is not saved on this device yet. These are, once SoloVoyage has finished caching.") + """
    <div class="container section--tight narrow"><ul class="link-list link-list--lg"><li><a href="emergency.html">Emergency Center</a></li><li><a href="guides.html">Safety guides</a></li><li><a href="checklist.html">Checklist</a></li><li><a href="planner.html">Trip planner</a></li><li><a href="bookmarks.html">Saved guides</a></li></ul><p class="muted" style="margin-top:1.5rem">External websites and live information need a connection.</p></div>""")

# 404 can be served from any depth, so it is self-contained and links with full URLs.
(ROOT / "404.html").write_text(f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Page not found | SoloVoyage</title>
  <meta name="description" content="The page you asked for does not exist.">
  <style>
    body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; background: #08131f; color: #f4eee1; font: 1.0625rem/1.6 system-ui, sans-serif; text-align: center; }}
    h1 {{ font: 500 2.4rem/1.15 Georgia, serif; }}
    a {{ color: #f6a76e; display: inline-block; padding: .6rem .8rem; }}
  </style>
</head>
<body>
  <main>
    <h1>This trail does not go anywhere</h1>
    <p>The page you asked for does not exist or has moved.</p>
    <p><a id="home" href="{SITE}">SoloVoyage home</a> <a id="guides" href="{SITE}guides.html">All guides</a> <a id="sos" href="{SITE}emergency.html">Emergency Center</a></p>
  </main>
  <script>
    /* Keep visitors on the same host, whether that is GitHub Pages or a local server. */
    var base = location.pathname.indexOf("/SoloVoyage/") === 0 ? "/SoloVoyage/" : "/";
    [["home", ""], ["guides", "guides.html"], ["sos", "emergency.html"]].forEach(function (x) {{ document.getElementById(x[0]).href = base + x[1]; }});
  </script>
</body>
</html>
""", encoding="utf-8", newline="\n")

# ---------------------------------------------------------------- Sitemap, robots
public = ["", "guides.html"] + [c["page"] for c in CATS] + ["planner.html", "packing.html", "emergency.html", "destinations.html", "search.html", "about.html", "privacy.html"]
urls = [SITE + p for p in public] + [f"{SITE}guide.html?id={g['id']}" for g in GUIDES]
(ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"  <url><loc>{html.escape(u)}</loc><lastmod>{UPDATED}</lastmod></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8", newline="\n")
(ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE}sitemap.xml\n", encoding="utf-8", newline="\n")

# ---------------------------------------------------------------- Service worker file list and version
files = sorted(p.name for p in ROOT.glob("*.html") if p.name != "404.html")
for pattern in ["css/*.css", "js/*.js", "js/pages/*.js", "data/*.json", "assets/fonts/*.woff2"]:
    files += sorted(p.relative_to(ROOT).as_posix() for p in ROOT.glob(pattern))
files += ["manifest.json", "assets/icons/sprite.svg", "assets/icons/favicon.svg", "assets/icons/icon-192.png", "assets/images/contours.svg",
          "assets/images/hero-tall-828.avif", "assets/images/hero-wide-1280.avif"]
sw = ROOT / "sw.js"
if sw.exists():
    digest = hashlib.sha256()
    for f in files:
        p = ROOT / f
        if p.exists():
            digest.update(f.encode())
            data = p.read_bytes()
            if p.suffix not in {".png", ".woff2", ".avif"}:
                data = data.replace(b"\r\n", b"\n")
            digest.update(data)
    text = sw.read_text(encoding="utf-8")
    text = re.sub(r'const VERSION = "[^"]*";', f'const VERSION = "{digest.hexdigest()[:10]}";', text)
    text = re.sub(r"const PRECACHE = \[.*?\];", "const PRECACHE = [\n" + "".join(f'  "{f}",\n' for f in files) + "];", text, flags=re.S)
    sw.write_text(text, encoding="utf-8", newline="\n")
missing = [f for f in files if not (ROOT / f).exists()]
print(f"{len(list(ROOT.glob('*.html')))} pages, {len(urls)} sitemap URLs, {len(files)} precached files" + (f"; MISSING {missing}" if missing else ""))
