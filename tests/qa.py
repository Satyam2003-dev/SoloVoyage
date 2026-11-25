#!/usr/bin/env python3
"""
SoloVoyage end-to-end QA. Development only; the website does not depend on it.

    pip install playwright
    python -m playwright install
    python tests/qa.py                 # all installed engines
    python tests/qa.py chromium        # one engine

It serves the repository under /SoloVoyage/ (like GitHub Pages) on 127.0.0.1.
"""
import datetime as dt
import functools
import http.server
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import traceback
import urllib.parse
from html.parser import HTMLParser

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREFIX = "/SoloVoyage/"
WIDTHS = [320, 360, 375, 390, 430, 480, 768, 1024, 1280, 1440, 1920]
PAGES = [p.name for p in sorted(ROOT.glob("*.html")) if p.name not in ("404.html", "guide.html")] + ["guide.html?id=use-official-taxis"]


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".json": "application/json",
                      ".svg": "image/svg+xml", ".avif": "image/avif", ".webp": "image/webp", ".woff2": "font/woff2"}
    root = ROOT

    def translate_path(self, path):
        clean = urllib.parse.unquote(path.split("?")[0].split("#")[0])
        outside = str(self.root / "__outside__")
        if not clean.startswith(PREFIX):
            return outside
        target = (self.root / clean[len(PREFIX):]).resolve()
        if target != self.root and self.root not in target.parents:
            return outside
        return str(target) + ("/" if clean.endswith("/") else "")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


def serve(root=ROOT, port=0):
    handler = type("H", (Handler,), {"root": root})
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}{PREFIX}"


RESULTS = []


def check(group, name, ok, detail=""):
    RESULTS.append((group, name, bool(ok), "" if ok else str(detail)[:600]))
    if not ok:
        print(f"  FAIL [{group}] {name}: {str(detail)[:600]}", flush=True)


# ------------------------------------------------------------------ static checks
class Doc(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "use", "path"}

    def __init__(self):
        super().__init__()
        self.stack, self.errors, self.ids, self.links, self.metas, self.titles, self.h1 = [], [], [], [], {}, 0, 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        for key in ("href", "src"):
            if a.get(key):
                self.links.append(a[key])
        for key in ("srcset", "imagesrcset"):
            if a.get(key):
                self.links += [part.split()[0] for part in a[key].split(",")]
        if tag == "meta" and ("name" in a or "property" in a):
            self.metas[a.get("name") or a.get("property")] = a.get("content", "")
        self.titles += tag == "title"
        self.h1 += tag == "h1"
        if tag == "img" and "alt" not in a:
            self.errors.append("img without alt")
        if tag not in self.VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.VOID:
            return
        if not self.stack or self.stack[-1] != tag:
            self.errors.append(f"unexpected </{tag}> inside {self.stack[-3:]}")
        else:
            self.stack.pop()


def load(name):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


def static_checks():
    guides = load("guides.json")["guides"]
    cats = load("categories.json")["categories"]
    checklist = load("checklist.json")
    ids = {g["id"] for g in guides}
    check("data", "101 guides numbered 1 to 101", sorted(g["number"] for g in guides) == list(range(1, 102)), len(guides))
    check("data", "guide ids are unique", len(ids) == len(guides))
    check("data", "11 categories (10 guide categories + The Full Checklist)", len(cats) == 11 and sum(c["type"] == "guides" for c in cats) == 10, len(cats))
    cat_ids = {c["id"] for c in cats if c["type"] == "guides"}
    check("data", "every guide has a valid category", all(g["category"] in cat_ids for g in guides))
    check("data", "every category has guides", all(any(g["category"] == c for g in guides) for c in cat_ids))
    check("data", "every guide has title, summary, intro, 3+ actions and tags", all(g["title"] and g["summary"] and g["intro"] and len(g["actions"]) >= 3 and g["tags"] for g in guides))
    check("data", "related guide references resolve", all(r in ids and r != g["id"] for g in guides for r in g["related"]))
    check("data", "every category page exists", all((ROOT / c["page"]).exists() for c in cats))
    items = checklist["items"]
    check("data", "48 checklist actions with unique ids and valid guides", len(items) == 48 == len({i["id"] for i in items}) and all(i["guide"] in ids for i in items))
    others = [r for s in load("emergency.json")["situations"] for r in s["guides"]] + [r for t in load("destinations.json")["topics"] for r in t["guides"]]
    check("data", "emergency and destination guide references resolve", all(r in ids for r in others))
    trip = (ROOT / "js" / "trip.js").read_text(encoding="utf-8") + (ROOT / "js" / "packing-data.js").read_text(encoding="utf-8")
    refs = re.findall(r'", "([a-z0-9-]+)"\]', trip) + re.findall(r'guide: "([a-z0-9-]+)"', trip)
    check("data", "planner and document guide references resolve", refs and all(r in ids for r in refs), [r for r in refs if r not in ids])

    docs = {}
    for path in ROOT.glob("*.html"):
        d = Doc()
        d.feed(path.read_text(encoding="utf-8"))
        d.close()
        docs[path.name] = d
    bad = {n: d.errors[:3] for n, d in docs.items() if d.errors or d.stack}
    check("html", f"{len(docs)} pages parse with balanced tags and alt text", not bad, bad)
    check("html", "no duplicate ids in static markup", all(len(d.ids) == len(set(d.ids)) for d in docs.values()))
    titles = [re.search(r"<title>(.*?)</title>", (ROOT / n).read_text(encoding="utf-8")).group(1) for n in docs]
    check("seo", "every page has a unique title", len(titles) == len(set(titles)), titles)
    descs = [d.metas.get("description", "") for d in docs.values()]
    check("seo", "every page has a unique description", all(descs) and len(descs) == len(set(descs)))
    missing = []
    for name, d in docs.items():
        for link in d.links:
            if re.match(r"^(https?:|mailto:|tel:|data:)", link) or name == "404.html":
                continue
            target, _, frag = link.partition("#")
            file = target.split("?")[0] or name
            if not (ROOT / file).exists():
                missing.append(f"{name} -> {link}")
            elif frag and file.endswith(".html") and not file.endswith("sprite.svg") and frag != "main":
                dynamic = {"checklist.html": {c["id"] for c in checklist["categories"]}, "packing.html": {"documents"}}
                if frag not in docs[file].ids and frag not in dynamic.get(file, set()):
                    missing.append(f"{name} -> {link} (no such anchor)")
            q = urllib.parse.parse_qs(urllib.parse.urlparse(link).query)
            if file == "guide.html" and "id" in q and q["id"][0] not in ids:
                missing.append(f"{name} -> {link} (no such guide)")
    check("links", "all internal links, assets and anchors in static HTML resolve", not missing, missing[:10])

    sprite = set(re.findall(r'<symbol id="([\w-]+)"', (ROOT / "assets/icons/sprite.svg").read_text(encoding="utf-8")))
    used = set()
    for f in list(ROOT.glob("*.html")) + list(ROOT.glob("js/**/*.js")) + list(ROOT.glob("data/*.json")):
        text = f.read_text(encoding="utf-8")
        used |= set(re.findall(r"sprite\.svg#([\w-]+)", text)) | set(re.findall(r'\bicon\("([\w-]+)"', text)) | set(re.findall(r'"icon(?:Name)?": "([\w-]+)"', text)) | set(re.findall(r'\bicon(?:Name)?: "([\w-]+)"', text))
    check("links", "every referenced icon exists in the sprite", used <= sprite, sorted(used - sprite))

    for css in ROOT.glob("css/*.css"):
        text = re.sub(r"/\*.*?\*/", "", css.read_text(encoding="utf-8"), flags=re.S)
        text = re.sub(r'"[^"]*"', '""', text)
        check("css", f"{css.name} has balanced braces", text.count("{") == text.count("}"), f"{text.count('{')} vs {text.count('}')}")
        for url in re.findall(r'url\("?([^")]+)"?\)', css.read_text(encoding="utf-8")):
            if url:
                check("css", f"{css.name} asset {url}", (css.parent / url).resolve().exists())

    node = shutil.which("node")
    if node:
        for f in list(ROOT.glob("js/**/*.js")) + [ROOT / "sw.js"]:
            mode = [] if f.name in ("sw.js", "theme-init.js") else ["--input-type=module"]
            run = subprocess.run([node, *mode, "--check"] if mode else [node, "--check", str(f)], input=f.read_bytes() if mode else None, capture_output=True)
            check("js", f"syntax {f.relative_to(ROOT).as_posix()}", run.returncode == 0, run.stderr.decode(errors="ignore"))

    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    cached = re.findall(r'^  "([^"]+)",$', sw, flags=re.M)
    check("pwa", "every precached file exists", cached and all((ROOT / f).exists() for f in cached), [f for f in cached if not (ROOT / f).exists()])
    needed = [p.relative_to(ROOT).as_posix() for pat in ("js/**/*.js", "css/*.css", "data/*.json") for p in ROOT.glob(pat)]
    check("pwa", "all scripts, styles and data are precached", set(needed) <= set(cached), sorted(set(needed) - set(cached)))
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    check("pwa", "manifest icons exist and paths are relative", all((ROOT / i["src"]).exists() for i in manifest["icons"]) and manifest["start_url"].startswith("./"))


# ------------------------------------------------------------------ browser helpers
class Session:
    def __init__(self, browser, base, width=1280, height=900, scheme="light", sw=False, dismiss=True, motion="reduce"):
        self.base = base
        self.errors = []
        self.external = []
        self.context = browser.new_context(viewport={"width": width, "height": height}, color_scheme=scheme, reduced_motion=motion, service_workers="allow" if sw else "block", accept_downloads=True)
        if dismiss:
            # Pre-answer the analytics question and announcement once, without overwriting later changes.
            self.context.add_init_script("""if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa','1');
              if (!localStorage.getItem('solovoyage_preferences')) localStorage.setItem('solovoyage_preferences', JSON.stringify({v:1,data:{analytics:'no'}})); }""")
        self.page = self.context.new_page()
        self.page.set_default_timeout(8000)
        self.page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))
        self.page.on("console", lambda m: m.type == "error" and "Service Worker registration blocked" not in m.text and self.errors.append(m.text))
        self.page.on("response", lambda r: r.status >= 400 and self.errors.append(f"{r.status} {r.url}"))
        self.page.on("request", lambda r: not r.url.startswith(("http://127.0.0.1", "data:", "blob:")) and self.external.append(r.url))

    def go(self, path):
        self.page.goto(self.base + path, wait_until="load")
        self.page.wait_for_function("!document.querySelector('[data-app] .skeleton') && !!document.querySelector('site-header .header') && !(document.body.dataset.page==='guide' && document.querySelector('.skeleton'))")
        self.page.wait_for_load_state("networkidle")

    def stored(self, key):
        raw = self.page.evaluate(f"localStorage.getItem('solovoyage_{key}')")
        return json.loads(raw)["data"] if raw else None

    def close(self):
        self.context.close()


OVERFLOW = """() => {
  const w = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > w + 1) {
    const guilty = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > w + 1).slice(0, 4).map(e => e.tagName + '.' + e.className);
    return {extra: document.documentElement.scrollWidth - w, guilty};
  }
  // Text clipped inside its own box (ignoring intentional scrollers and visually hidden text).
  const clipped = [...document.querySelectorAll('h1,h2,h3,h4,p,a,button,label,span,li,dd,th,td')].filter(e => {
    if (!e.offsetParent || e.closest('.visually-hidden, .chips--scroll, .table-wrap, [data-tip]')) return false;
    const s = getComputedStyle(e); return s.overflowX === 'hidden' && e.scrollWidth > e.clientWidth + 1;
  }).slice(0, 4).map(e => e.tagName + '.' + e.className);
  const off = [...document.querySelectorAll('main a, main button, main input, main select, main h1, main h2, main h3, main p')].filter(e => {
    if (!e.offsetParent || e.closest('.chips--scroll, .table-wrap, .visually-hidden')) return false;
    const r = e.getBoundingClientRect(); return r.width > 1 && (r.left < -1 || r.right > w + 1);
  }).slice(0, 4).map(e => e.tagName + '.' + e.className + ' ' + e.textContent.trim().slice(0, 30));
  return clipped.length || off.length ? {clipped, off} : null;
}"""

A11Y = r"""() => {
  const out = [];
  const visible = e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 1 && r.height > 1 && !e.closest('.visually-hidden,[hidden],noscript'); };
  const nameOf = e => (e.getAttribute('aria-label') || '').trim() || (e.labels && [...e.labels].map(l => l.textContent).join(' ').trim()) || (e.getAttribute('aria-labelledby') && document.getElementById(e.getAttribute('aria-labelledby'))?.textContent.trim()) || e.textContent.trim() || e.querySelector('img')?.alt || '';
  for (const e of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=progressbar]')) if (visible(e) && !nameOf(e)) out.push('no accessible name: ' + e.outerHTML.slice(0, 90));
  const ids = [...document.querySelectorAll('[id]:not(symbol)')].map(e => e.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i); if (dup.length) out.push('duplicate ids: ' + dup.slice(0, 5));
  const hs = [...document.querySelectorAll('main h1, main h2, main h3, main h4')].filter(e => !e.closest('details:not([open])') || e.closest('summary')).map(e => +e.tagName[1]);
  if (document.querySelectorAll('h1').length !== 1) out.push('h1 count ' + document.querySelectorAll('h1').length);
  hs.forEach((l, i) => { if (i && l - hs[i - 1] > 1) out.push(`heading jumps h${hs[i-1]} to h${l}`); });
  // Contrast of text against the nearest opaque background (text over photographs is checked by eye).
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', {willReadFrequently: true});
  const rgba = c => { cx.clearRect(0,0,1,1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, base) => top.slice(0,3).map((v, i) => v * top[3] + base[i] * (1 - top[3])).concat(1);
  const background = e => { const layers = []; for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] >= 0.99) break; } let b = rgba(getComputedStyle(document.body).backgroundColor); for (let i = layers.length - 1; i >= 0; i--) b = over(layers[i], b); return b; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t; (t = walker.nextNode());) {
    const e = t.parentElement; if (!t.textContent.trim() || !e || !visible(e) || e.closest('.hero, .cta-final, .guide-head__num, option, :disabled, .header:not(.is-stuck)')) continue;
    if (e.closest('details:not([open])') && !e.closest('summary')) continue;
    const s = getComputedStyle(e); const bg = background(e); const fg = over(rgba(s.color), bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); const ratio = (a + .05) / (b + .05);
    const size = parseFloat(s.fontSize); const need = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700) ? 3 : 4.5;
    if (ratio < need - 0.02) { const key = s.color + bg.map(Math.round); if (!seen.has(key)) { seen.add(key); out.push(`contrast ${ratio.toFixed(2)} < ${need}: "${t.textContent.trim().slice(0, 40)}" .${e.className} ${s.color} on rgb(${bg.slice(0,3).map(Math.round)})`); } }
  }
  return out;
}"""

# WCAG 2.2 AA target size: 24px, with the inline-link exception.
TARGETS = """() => [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,summary')].filter(e => {
  if (!e.offsetParent || e.closest('.visually-hidden,.skip-link,noscript') || e.classList.contains('skip-link') || e.type === 'file') return false;
  if (e.tagName === 'A' && getComputedStyle(e).display === 'inline') return false;
  const r = e.getBoundingClientRect(); return r.width > 1 && (r.width < 24 || r.height < 24);
}).slice(0, 5).map(e => { const r = e.getBoundingClientRect(); return `${e.tagName}.${e.className} ${Math.round(r.width)}x${Math.round(r.height)} ${e.textContent.trim().slice(0,25)}`; })"""


# ------------------------------------------------------------------ flows
def flow_pages(browser, base, engine):
    s = Session(browser, base)
    for path in PAGES:
        s.errors.clear()
        s.go(path)
        check(engine, f"loads without errors: {path}", not s.errors, s.errors)
    check(engine, "no third-party requests without consent", not s.external, s.external[:5])
    s.close()


def flow_responsive(browser, base, engine):
    seeded = {"trips": {"active": "t1", "trips": [{"id": "t1", "name": "A rather long trip name to test wrapping on small screens", "destination": "Thiruvananthapuram", "depart": (dt.date.today() + dt.timedelta(days=40)).isoformat(), "ret": "", "type": "Outdoors and adventure", "travelers": 2, "createdAt": 1, "tasks": [{"id": "a", "group": "research", "title": "Supercalifragilisticexpialidocious_unbroken_task_name_0123456789_abcdefghij", "done": False, "custom": True}]}]},
              "bookmarks": [{"id": "trust-yourself-stay-alert", "at": 1}], "recently_viewed": [{"id": "use-official-taxis", "at": 1}],
              "contacts": {"trustedName": "A very long contact name for wrapping", "trustedContact": "someone.with.a.very.long.address@example-domain.test", "localNumber": "112"},
              "checklist": {"done": ["research-destination"], "custom": []}}
    for width in WIDTHS:
        s = Session(browser, base, width=width, height=800)
        s.go("about.html")
        for key, value in seeded.items():
            s.page.evaluate("([k,v]) => localStorage.setItem('solovoyage_'+k, JSON.stringify({v:1,data:v}))", [key, value])
        problems = {}
        for path in PAGES:
            s.go(path)
            found = s.page.evaluate(OVERFLOW)
            if found:
                problems[path] = found
        check(engine, f"{width}px: no horizontal overflow or clipped text on {len(PAGES)} pages (with data)", not problems, problems)
        if width in (320, 390, 1280):
            small = {}
            for path in PAGES:
                s.go(path)
                found = s.page.evaluate(TARGETS)
                if found:
                    small[path] = found
            check(engine, f"{width}px: controls meet 24px target size", not small, small)
        s.close()


def flow_a11y(browser, base, engine):
    for scheme in ("light", "dark"):
        for width in (1280, 390):
            s = Session(browser, base, width=width, scheme=scheme)
            problems = {}
            for path in PAGES + ["guide.html?id=pack-first-aid-kit"]:
                s.go(path)
                if path == "emergency.html":
                    s.page.evaluate("document.querySelector('details.situation').open = true")
                s.page.wait_for_timeout(120)
                found = s.page.evaluate(A11Y)
                if found:
                    problems[path] = found[:6]
            check(engine, f"names, headings, ids and text contrast: {scheme} {width}px", not problems, json.dumps(problems, indent=1)[:3000])
            s.close()


def flow_navigation(browser, base, engine):
    s = Session(browser, base, width=390, height=844)
    p = s.page
    s.go("index.html")
    p.keyboard.press("Tab")
    first = p.evaluate("document.activeElement.className")
    if engine != "webkit":  # Safari does not Tab to links unless the user enables it
        check(engine, "first Tab reaches the skip link", "skip-link" in first, first)
    p.click(".menu-btn")
    check(engine, "mobile drawer opens and reports expanded", p.locator("dialog.drawer[open]").count() == 1 and p.get_attribute(".menu-btn", "aria-expanded") == "true")
    check(engine, "focus moves into the drawer", p.evaluate("!!document.activeElement.closest('dialog.drawer')"))
    check(engine, "drawer marks the current page", p.locator('dialog.drawer a[aria-current="page"]').inner_text().strip() == "Home")
    p.keyboard.press("Escape")
    p.wait_for_selector("dialog.drawer", state="detached")
    check(engine, "Escape closes the drawer and restores focus", p.evaluate("document.activeElement.classList.contains('menu-btn')") and p.get_attribute(".menu-btn", "aria-expanded") == "false")
    p.click(".menu-btn")
    p.locator("dialog.drawer a", has_text="Trip Planner").click()
    p.wait_for_url("**/planner.html")
    check(engine, "drawer link navigates", p.url.endswith("planner.html"))
    s.go("index.html")
    check(engine, "tab bar has five destinations", p.locator(".tabbar a").count() == 5)
    p.click('button[aria-label="Dismiss announcement"]')
    p.reload()
    p.wait_for_selector("site-header .header")
    check(engine, "dismissed announcement stays dismissed", p.locator(".announce").count() == 0)
    faq = p.locator(".accordion details").first
    faq.locator("summary").focus()
    p.keyboard.press("Enter")
    check(engine, "FAQ opens with the keyboard", faq.get_attribute("open") is not None)
    check(engine, "home lists all 11 categories", p.locator(".cat-tile").count() == 11)
    hrefs = p.eval_on_selector_all(".cat-tile a", "a => a.map(x => x.getAttribute('href'))")
    total = 0
    for href in hrefs:
        s.go(href)
        total += p.locator(".toc__item").count()
    check(engine, "all 101 guides are reachable from the category pages", total == 101, total)
    check(engine, "no errors during navigation", not s.errors, s.errors)
    s.close()


def flow_every_guide(browser, base, engine):
    s = Session(browser, base)
    s.go("guides.html")
    bad = []
    for g in load("guides.json")["guides"]:
        s.errors.clear()
        s.go(f"guide.html?id={g['id']}")
        heading = s.page.locator("h1").inner_text()
        if g["title"] not in heading or s.page.locator(".points > li").count() != len(g["actions"]) or s.errors:
            bad.append((g["id"], heading, s.errors))
    check(engine, "all 101 guide pages render title and every action point", not bad, bad[:5])
    check(engine, "guide page sets its own title and canonical", "trust-yourself-stay-alert" in s.page.get_attribute('link[rel="canonical"]', "href") and "Trust Yourself" in s.page.title())
    s.go("guide.html?id=%3Cimg%20src=x%20onerror=alert(1)%3E")
    check(engine, "unknown guide id shows a safe not-found state", "could not find" in s.page.locator("h1").inner_text() and s.page.locator("main img").count() == 0)
    s.close()


def flow_search(browser, base, engine):
    s = Session(browser, base)
    p = s.page
    s.go("guides.html")
    count = lambda: p.locator("#result-count").inner_text()
    check(engine, "library starts with 101 guides", count().startswith("101 guides"), count())
    check(engine, "library pages the results", p.locator("[data-app] > .grid > .guide-card").count() == 24)
    p.locator("button", has_text="more of").click()
    p.wait_for_function("document.querySelectorAll('[data-app] > .grid > .guide-card').length === 48")
    check(engine, "show more adds results", True)
    p.fill("#guide-search", "passport")
    p.wait_for_function("document.querySelector('#result-count').textContent.includes('passport')")
    check(engine, "search narrows results and highlights terms", 0 < p.locator(".guide-card").count() < 101 and p.locator(".guide-card mark").count() > 0, count())
    check(engine, "search is reflected in the URL", "q=passport" in p.url)
    p.fill("#guide-search", "")
    p.wait_for_function("document.querySelector('#result-count').textContent.startsWith('101')")
    p.click('[data-c="digital-safety"]')
    p.wait_for_function("document.querySelector('#result-count').textContent.includes('Digital')")
    check(engine, "category filter shows 10", count().startswith("10 guides"), count())
    p.select_option("#sort", "az")
    p.wait_for_timeout(200)
    titles = p.locator(".guide-card h3").all_inner_texts()
    check(engine, "sort A to Z", titles == sorted(titles, key=str.casefold), titles[:4])
    p.reload()
    s.page.wait_for_selector(".guide-card")
    check(engine, "filters survive reload", count().startswith("10 guides") and p.input_value("#sort") == "az", count())
    p.fill("#guide-search", "zzzqqqxx")
    p.wait_for_selector(".empty")
    check(engine, "no-results state offers to clear filters", "No guides found" in p.locator(".empty").inner_text())
    p.locator(".empty button", has_text="Clear filters").click()
    p.wait_for_function("document.querySelector('#result-count').textContent.startsWith('101')")
    check(engine, "clear filters restores all", True)
    for query in ['<img src=x onerror="window.__x=1">', "(.*)+[", "   ", "a" * 500]:
        s.go("search.html?q=" + urllib.parse.quote(query))
        check(engine, f"hostile or odd query is safe: {query[:20]!r}", p.evaluate("window.__x === undefined && !document.querySelector('main img')") and not s.errors, s.errors)
    s.go("search.html?q=taxi")
    check(engine, "search page lists results with a count", p.locator(".toc__item").count() > 0 and "result" in p.locator("[data-app] > p").first.inner_text())
    s.go("search.html?q=" + urllib.parse.quote("lost passport"))
    check(engine, "search includes emergency situations", p.locator('.toc__item a[href="emergency.html#lost-passport"]').count() == 1)
    p.select_option("#cat", "money-valuables")
    p.wait_for_timeout(250)
    check(engine, "search category filter applies", "Money" in p.locator("main").inner_text())
    s.go("search.html?q=spiking")
    check(engine, "search covers guide body and tags", p.locator('a[href="guide.html?id=never-accept-drinks-from-strangers"]').count() == 1)
    s.go("index.html")
    p.keyboard.press("/")
    p.wait_for_selector(".search-dialog[open]")
    p.keyboard.type("hotel")
    p.wait_for_selector(".search-dialog a.result")
    p.keyboard.press("ArrowDown")
    check(engine, "search overlay: arrow keys move into results", p.evaluate("document.activeElement.classList.contains('result')"))
    p.keyboard.press("Escape")
    p.wait_for_selector(".search-dialog", state="detached")
    p.click('button[aria-label="Search"]')
    p.fill(".search-dialog input", "insurance")
    p.keyboard.press("Enter")
    p.wait_for_url("**/search.html?q=insurance")
    check(engine, "search overlay submits to the search page", True)
    check(engine, "no errors during search", not s.errors, s.errors)
    s.close()


def flow_library(browser, base, engine):
    s = Session(browser, base)
    p = s.page
    s.go("bookmarks.html")
    check(engine, "library empty state", "Nothing saved yet" in p.locator("main").inner_text())
    s.go("guide.html?id=use-official-taxis")
    p.locator("button", has_text="Save guide").click()
    p.locator("button", has_text="Mark as read").click()
    s.go("guide.html?id=drink-bottled-water")
    p.locator("button", has_text="Save guide").click()
    s.go("bookmarks.html")
    check(engine, "bookmarks persist across pages", p.locator(".guide-card").count() == 2)
    check(engine, "only identifiers are stored", all(set(b) == {"id", "at"} for b in s.stored("bookmarks")))
    p.fill('[aria-label="Search saved guides"]', "taxi")
    p.wait_for_function("document.querySelectorAll('.guide-card').length === 1")
    check(engine, "search within saved guides", True)
    p.fill('[aria-label="Search saved guides"]', "")
    p.wait_for_function("document.querySelectorAll('.guide-card').length === 2")
    p.reload()
    p.wait_for_selector(".guide-card")
    check(engine, "bookmarks survive reload", p.locator(".guide-card").count() == 2)
    p.locator('.guide-card[data-id="drink-bottled-water"] button').click()
    p.wait_for_function("document.querySelectorAll('.guide-card').length === 1")
    p.locator(".toast button", has_text="Undo").click()
    p.wait_for_function("document.querySelectorAll('.guide-card').length === 2")
    check(engine, "remove bookmark with undo", True)
    s.context.grant_permissions(["clipboard-read", "clipboard-write"]) if engine == "chromium" else None
    s.go("guide.html?id=use-official-taxis")
    check(engine, "read state persists", p.locator("button", has_text="Marked as read").count() == 1)
    p.evaluate("Object.defineProperty(navigator,'share',{value:undefined,configurable:true})")
    p.locator("button", has_text="Share").click()
    p.wait_for_selector(".toast, dialog[open]")
    text = p.locator(".toast, dialog[open]").first.inner_text()
    ok = "copied" in text.lower() or "copy this link" in text.lower()
    if engine == "chromium":
        ok = ok and "use-official-taxis" in p.evaluate("navigator.clipboard.readText()")
    check(engine, "share falls back to copying the link", ok, text)
    p.keyboard.press("Escape")
    p.evaluate("Object.defineProperty(navigator,'share',{value:(d)=>{window.__shared=d;return Promise.resolve()},configurable:true})")
    p.locator("button", has_text="Share").click()
    check(engine, "share uses the system sheet when available", p.evaluate("window.__shared && window.__shared.url.includes('use-official-taxis')"))
    box = p.locator(".practice .task__check")
    if box.count() == 0:
        s.go("guide.html?id=check-passport-expiry")
        box = p.locator(".practice .task__check")
    box.first.check()
    check(engine, "guide practice task writes to the checklist", len(s.stored("checklist")["done"]) == 1)
    check(engine, "no errors in library flow", not s.errors, s.errors)
    s.close()


def flow_checklist(browser, base, engine):
    s = Session(browser, base)
    p = s.page
    s.go("checklist.html")
    check(engine, "48 tasks in 9 categories", p.locator(".check-section .task__check").count() == 48 and p.locator(".check-section").count() == 9)
    check(engine, "starts at 0%", p.locator(".tool-side .ring__text").inner_text() == "0%" and not p.locator(".callout--success").is_visible())
    p.locator("#research .task__check").nth(0).check()
    p.locator("#research .task__check").nth(1).check()
    check(engine, "category and overall counts update", p.locator("#research .panel__head span").inner_text() == "2 of 2" and "2 of 48" in p.locator(".tool-side").inner_text())
    p.reload()
    p.wait_for_selector(".check-section")
    check(engine, "progress restored after reload", p.locator("#research .task__check:checked").count() == 2)
    form = p.locator("#packing form.inline-form")
    form.locator("button").click()
    check(engine, "empty custom task is rejected", p.locator("#packing .task").count() == p.locator("#packing .tasks li").count() == 7)
    form.locator("input").fill('<b onclick="window.__x=1">Pack sunscreen</b>')
    form.locator("button").click()
    check(engine, "custom task added as plain text", p.locator("#packing .task").count() == 8 and "<b onclick" in p.locator("#packing .task__title").last.inner_text())
    p.locator('#packing button[aria-label^="Edit"]').click()
    p.locator("#packing .task-edit input").fill("Pack sunscreen")
    p.keyboard.press("Enter")
    check(engine, "custom task edited", p.locator("#packing .task__title").last.inner_text() == "Pack sunscreen")
    p.locator('#packing button[aria-label^="Edit"]').click()
    p.keyboard.press("Escape")
    check(engine, "Escape cancels editing", p.locator("#packing .task-edit").count() == 0)
    p.locator('#packing button[aria-label^="Delete"]').click()
    check(engine, "custom task deleted", p.locator("#packing .task").count() == 7)
    p.locator(".toast button", has_text="Undo").click()
    check(engine, "delete can be undone", p.locator("#packing .task").count() == 8)
    p.click('[data-v="done"]')
    check(engine, "completed filter", p.locator(".check-section .task").count() == 2)
    p.click('[data-v="todo"]')
    check(engine, "remaining filter", p.locator(".check-section .task").count() == 47)
    p.click('.chips[aria-label="Status"] [data-v=""]')
    p.click('[data-v="emergency"]')
    check(engine, "phase filter shows emergency readiness", p.locator(".check-section .task").count() == 8)
    p.click('.chips[aria-label="Phase"] [data-v=""]')
    p.locator("button", has_text="Reset progress").first.click()
    p.locator("dialog button", has_text="Cancel").click()
    check(engine, "cancelled reset keeps progress", len(s.stored("checklist")["done"]) == 2)
    p.locator("button", has_text="Reset progress").first.click()
    p.locator("dialog button", has_text="Reset progress").click()
    check(engine, "reset unticks everything and keeps custom tasks", s.stored("checklist")["done"] == [] and len(s.stored("checklist")["custom"]) == 1)
    for box in p.locator(".check-section .task__check").all():
        box.check()
    check(engine, "completion message only when everything is ticked", p.locator(".callout--success").is_visible() and p.locator(".tool-side .ring__text").inner_text() == "100%")
    p.locator(".check-section .task__check").first.uncheck()
    check(engine, "completion message hides again", not p.locator(".callout--success").is_visible())
    p.emulate_media(media="print")
    check(engine, "print view keeps tasks and hides chrome", p.locator("#research .task").first.is_visible() and not p.locator("site-header").is_visible())
    p.emulate_media(media="screen")
    check(engine, "no errors in checklist", not s.errors, s.errors)
    s.close()


def flow_planner(browser, base, engine):
    s = Session(browser, base)
    p = s.page
    s.go("planner.html")
    check(engine, "planner starts empty", "Set up your trip" in p.locator("main").inner_text())
    depart = dt.date.today() + dt.timedelta(days=30)
    p.fill("#t-depart", depart.isoformat())
    p.fill("#t-return", (depart - dt.timedelta(days=2)).isoformat())
    p.locator("button", has_text="Create my plan").click()
    check(engine, "return before departure is rejected", "cannot be before" in p.locator("#t-error").inner_text() and s.stored("trips") is None)
    p.fill("#t-return", (depart + dt.timedelta(days=7)).isoformat())
    p.fill("#t-travelers", "0")
    p.locator("button", has_text="Create my plan").click()
    check(engine, "invalid traveller count is rejected", p.locator("#t-error").is_visible() and s.stored("trips") is None)
    p.fill("#t-travelers", "1")
    p.fill("#t-name", "QA trip")
    p.fill("#t-destination", "Kyoto")
    p.locator("button", has_text="Create my plan").click()
    p.wait_for_selector(".trip-card")
    check(engine, "trip summary and countdown", "QA trip" in p.locator(".trip-card").inner_text() and "30 days until departure" in p.locator(".trip-card").inner_text())
    check(engine, "six stages with 31 starter tasks", p.locator(".stage").count() == 6 and len(s.stored("trips")["trips"][0]["tasks"]) == 31)
    check(engine, "milestones listed", p.locator(".mile").count() == 6 and p.locator(".mile--overdue").count() == 1)
    stage = p.locator("#stage-research")
    stage.locator(".task__check").first.check()
    check(engine, "completing a task updates progress", "1 of 31" in p.locator(".trip-card").inner_text())
    stage.locator("form.inline-form input").fill("Book a cooking class")
    stage.locator("form.inline-form button").click()
    check(engine, "add task", "1 of 32" in p.locator(".trip-card").inner_text())
    stage.locator('button[aria-label="Edit “Book a cooking class”"]').click()
    stage.locator(".task-edit input").fill("Book a tea ceremony")
    p.keyboard.press("Enter")
    check(engine, "edit task", "Book a tea ceremony" in stage.inner_text())
    stage.locator('button[aria-label="Delete “Book a tea ceremony”"]').click()
    check(engine, "delete task", "1 of 31" in p.locator(".trip-card").inner_text())
    p.click('[data-f="done"]')
    check(engine, "planner filter: completed", p.locator(".stage .task").count() == 1)
    p.click('[data-f=""]')
    p.reload()
    p.wait_for_selector(".trip-card")
    check(engine, "trip persists after reload", "1 of 31" in p.locator(".trip-card").inner_text() and "Kyoto" in p.locator(".trip-card").inner_text())
    p.locator("button", has_text="Edit details").click()
    p.locator("dialog #t-destination").fill("Osaka")
    p.locator("dialog button", has_text="Save changes").click()
    check(engine, "edit trip details", "Osaka" in p.locator(".trip-card").inner_text())
    p.locator("button", has_text="New trip").click()
    p.locator("dialog button", has_text="Create plan").click()
    check(engine, "a trip with every field empty is allowed", "Untitled trip" in p.locator(".trip-card").inner_text() and p.locator("#trip-select").count() == 1)
    p.select_option("#trip-select", label="QA trip")
    check(engine, "switch between trips", "1 of 31" in p.locator(".trip-card").inner_text())
    p.locator("button", has_text="Reset plan").click()
    p.locator("dialog button", has_text="Reset plan").click()
    check(engine, "reset planner", "0 of 31" in p.locator(".trip-card").inner_text())
    p.locator("button", has_text="Delete trip").click()
    p.locator("dialog button", has_text="Delete trip").click()
    check(engine, "delete trip", len(s.stored("trips")["trips"]) == 1)
    check(engine, "no errors in planner", not s.errors, s.errors)
    s.close()


def flow_packing(browser, base, engine):
    s = Session(browser, base)
    p = s.page
    s.go("packing.html")
    check(engine, "starter list in 7 categories, nothing saved until changed", p.locator("#panel-packing section").count() == 7 and s.stored("packing") is None)
    section = p.locator('section[aria-labelledby="pk-clothing"]')
    section.locator(".task__check").first.check()
    section.locator("form.inline-form input").first.fill("Sun hat")
    section.locator('form.inline-form input[type="number"]').fill("3")
    section.locator("form.inline-form button").click()
    check(engine, "add item with quantity", "Sun hat × 3" in section.inner_text())
    section.locator('button[aria-label="Edit “Sun hat”"]').click()
    section.locator('.task-edit input[type="number"]').fill("2")
    section.locator(".task-edit button", has_text="Save").click()
    check(engine, "edit quantity", "Sun hat × 2" in section.inner_text())
    section.locator('button[aria-label="Delete “Tops”"]').click()
    p.reload()
    p.wait_for_selector("#panel-packing section")
    check(engine, "packing persists", "Sun hat × 2" in section.inner_text() and "Tops" not in section.inner_text())
    p.locator("#tab-packing").focus()
    p.keyboard.press("ArrowRight")
    check(engine, "tabs work with arrow keys", p.locator("#panel-documents").is_visible() and p.get_attribute("#tab-documents", "aria-selected") == "true")
    check(engine, "document tracker has 7 documents and only status menus", p.locator(".doc[data-doc]").count() == 7 and p.locator("#panel-documents input, #panel-documents textarea").count() == 0)
    p.select_option("#doc-passport", "ready")
    p.select_option("#doc-visa", "na")
    check(engine, "document progress ignores not-needed items", "1 of 6" in p.locator("#panel-documents").inner_text())
    s.go("packing.html#documents")
    p.reload()
    p.wait_for_selector("#doc-passport")
    check(engine, "document status persists and deep link opens tab", p.input_value("#doc-passport") == "ready" and p.locator("#panel-documents").is_visible())
    check(engine, "no errors in packing", not s.errors, s.errors)
    s.close()


def flow_emergency(browser, base, engine):
    s = Session(browser, base, width=390, height=844)
    p = s.page
    s.go("emergency.html")
    check(engine, "ten emergency situations", p.locator("details.situation").count() == 10 and p.locator(".sit-tile").count() == 10)
    p.click('.sit-tile[href="#lost-passport"]')
    p.wait_for_function("document.getElementById('lost-passport').open")
    check(engine, "tile opens its guide", p.locator("#lost-passport .priority li").count() == 3)
    p.evaluate("document.getElementById('lost-passport').open = false")
    p.click('.sit-tile[href="#lost-passport"]')
    p.wait_for_function("document.getElementById('lost-passport').open")
    check(engine, "tile reopens a closed guide", True)
    s.go("emergency.html#medical")
    check(engine, "deep link opens the guide", p.evaluate("document.getElementById('medical').open"))
    p.select_option("#area", label="Japan")
    dials = p.locator(".number-card__dial").evaluate_all("a => a.map(x => x.getAttribute('href'))")
    check(engine, "number finder shows sourced numbers", dials == ["tel:110", "tel:119"] and p.locator(".number-card a[target=_blank]").count() == 1, dials)
    p.select_option("#area", "other")
    check(engine, "unlisted destination shows an honest unavailable state", "do not have a verified number" in p.locator(".number-result").inner_text())
    p.locator("button", has_text="Add my contacts").click()
    p.fill("#c-trustedName", '<img src=x onerror="window.__x=1">')
    p.fill("#c-trustedContact", "+91 98765 43210")
    p.fill("#c-localNumber", "112")
    p.fill("#c-embassy", "Embassy, 12 Example Road")
    p.fill("#c-medical", "javascript:alert(1)")
    p.fill("#c-accommodation", "desk@hostel.test")
    p.locator("button", has_text="Save contacts").click()
    links = p.locator(".contact-card a").evaluate_all("a => a.map(x => x.getAttribute('href'))")
    check(engine, "only real phone numbers and emails become links", links == ["tel:+919876543210", "tel:112", "mailto:desk@hostel.test"], links)
    check(engine, "contact text is never treated as HTML", p.evaluate("window.__x === undefined && !document.querySelector('.contact-card img')"))
    p.reload()
    p.wait_for_selector(".contact-card")
    check(engine, "contacts persist", p.locator(".contact-card > div").count() == 6)
    p.locator("button", has_text="Delete").click()
    p.locator("dialog button", has_text="Delete contacts").click()
    check(engine, "contacts can be deleted", s.stored("contacts") is None and p.locator(".contact-card").count() == 0)
    check(engine, "no errors in emergency center", not s.errors, s.errors)
    s.close()
    nojs = browser.new_context(java_script_enabled=False, viewport={"width": 390, "height": 844})
    page = nojs.new_page()
    page.goto(base + "emergency.html")
    page.locator("#theft summary").click()
    check(engine, "emergency guidance works without JavaScript", page.locator("#theft .priority").is_visible() and page.locator(".em-head__now").is_visible())
    nojs.close()


def flow_dashboard_privacy(browser, base, engine):
    s = Session(browser, base)
    p = s.page
    s.go("dashboard.html")
    text = p.locator("[data-app]").inner_text()
    check(engine, "dashboard shows honest empty states", all(x in text for x in ["No trip planned yet", "Nothing ticked yet", "Bookmark a guide", "Guides you open will be listed here", "0 guides of 101"]), text[:400])
    s.go("planner.html")
    p.fill("#t-name", "Dash trip")
    p.locator("button", has_text="Create my plan").click()
    s.go("checklist.html")
    p.locator(".check-section .task__check").first.check()
    s.go("guide.html?id=use-official-taxis")
    p.locator("button", has_text="Save guide").click()
    s.go("dashboard.html")
    text = p.locator("[data-app]").inner_text()
    check(engine, "dashboard reflects real data", "Dash trip" in text and "1 of 48" in text and "Use Official Taxi Services Only" in text and "0 of 31" in text, text[:600])
    s.go("index.html")
    check(engine, "home preview shows real checklist progress", "1 of 48 complete" in p.locator("[data-app]").inner_text())
    p.locator("[data-app] .task__check").first.check()
    check(engine, "home preview can tick a task", "2 of 48 complete" in p.locator("[data-app]").inner_text())
    s.go("privacy.html")
    with p.expect_download() as info:
        p.locator("button", has_text="Export a backup").click()
    backup = pathlib.Path(info.value.path()).read_text(encoding="utf-8")
    check(engine, "export contains the saved data", json.loads(backup)["data"]["trips"]["trips"][0]["name"] == "Dash trip")
    p.locator("button", has_text="Delete all data").click()
    p.locator("dialog button", has_text="Delete everything").click()
    left = p.evaluate("Object.keys(localStorage).filter(k => k.startsWith('solovoyage_'))")
    check(engine, "delete all removes every key", left == [], left)
    p.set_input_files("#restore-file", files=[{"name": "b.json", "mimeType": "application/json", "buffer": backup.encode()}])
    p.locator("dialog button", has_text="Restore").click()
    p.wait_for_function("localStorage.getItem('solovoyage_trips') !== null")
    check(engine, "backup restores", s.stored("trips")["trips"][0]["name"] == "Dash trip")
    p.set_input_files("#restore-file", files=[{"name": "bad.json", "mimeType": "application/json", "buffer": b'{"hello":1}'}])
    p.locator("dialog button", has_text="Restore").click()
    p.wait_for_selector(".toast >> text=not a SoloVoyage backup")
    check(engine, "foreign file is refused", True)
    # corrupted and hostile storage must not break any page
    for key in ["theme", "bookmarks", "checklist", "trips", "packing", "documents", "contacts", "preferences", "recently_viewed", "read"]:
        p.evaluate("k => localStorage.setItem('solovoyage_'+k, '{broken')", key)
    s.errors.clear()
    for path in ["index.html", "dashboard.html", "planner.html", "checklist.html", "packing.html", "bookmarks.html", "emergency.html", "privacy.html"]:
        s.go(path)
    check(engine, "damaged storage falls back safely", not s.errors, s.errors)
    for key, value in {"trips": {"active": "zz", "trips": [None, 5, {"id": "a b"}]}, "bookmarks": [{"id": "no-such-guide"}, "x"], "checklist": {"done": "yes", "custom": [None]}, "packing": {"items": 7}}.items():
        p.evaluate("([k,v]) => localStorage.setItem('solovoyage_'+k, JSON.stringify({v:1,data:v}))", [key, value])
    s.errors.clear()
    for path in ["dashboard.html", "planner.html", "checklist.html", "packing.html", "bookmarks.html"]:
        s.go(path)
    check(engine, "wrongly shaped storage is sanitized", not s.errors, s.errors)
    s.close()

    blocked = browser.new_context(service_workers="block")
    blocked.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})")
    page = blocked.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    for path in ["index.html", "checklist.html", "dashboard.html", "privacy.html"]:
        page.goto(base + path)
        page.wait_for_load_state("networkidle")
    page.goto(base + "checklist.html")
    page.locator(".check-section .task__check").first.check()
    page.wait_for_selector(".toast")
    check(engine, "works with storage blocked and says so", not errors and "blocking storage" in page.locator(".toast").first.inner_text(), errors)
    blocked.close()


def flow_theme(browser, base, engine):
    s = Session(browser, base, scheme="dark")
    p = s.page
    theme = lambda: p.evaluate("document.documentElement.dataset.theme")
    s.go("index.html")
    check(engine, "system theme follows a dark device", theme() == "dark")
    p.emulate_media(color_scheme="light")
    p.wait_for_function("document.documentElement.dataset.theme === 'light'")
    check(engine, "system theme reacts to changes", True)
    button = p.locator('.header button[aria-label^="Theme"]')
    button.click()  # system -> light
    button.click()  # light -> dark
    check(engine, "theme button cycles to dark", theme() == "dark" and s.stored("theme") == "dark")
    for path in ["guides.html", "checklist.html"]:
        s.go(path)
        check(engine, f"theme persists on {path}", theme() == "dark")
    p.add_init_script("document.addEventListener('readystatechange', () => { window.__first ??= document.documentElement.dataset.theme; })")
    p.reload()
    check(engine, "saved theme applies before first paint (no flash)", p.evaluate("window.__first") == "dark")
    s.close()


def flow_privacy_network(browser, base, engine):
    s = Session(browser, base, dismiss=False, motion="no-preference")
    p = s.page
    s.go("index.html")
    p.wait_for_timeout(500)
    check(engine, "no third-party request before an analytics choice", not s.external, s.external)
    p.wait_for_selector(".consent", timeout=20000)
    p.locator(".consent button", has_text="No thanks").click()
    s.go("planner.html")
    check(engine, "declining is remembered", p.locator(".consent").count() == 0 and not s.external)
    s.close()


def flow_offline(browser, base, engine):
    if engine != "chromium":
        return
    with tempfile.TemporaryDirectory() as tmp:
        copy = pathlib.Path(tmp).resolve() / "site"
        shutil.copytree(ROOT, copy, ignore=shutil.ignore_patterns(".git", "tests", "docs", "tools"))
        server, url = serve(copy)
        s = Session(browser, url, sw=True)
        p = s.page
        s.go("index.html")
        p.evaluate("navigator.serviceWorker.ready")
        p.wait_for_function("!!navigator.serviceWorker.controller")
        scope = p.evaluate("navigator.serviceWorker.getRegistration().then(r => r.scope)")
        check(engine, "service worker scope is the GitHub Pages subpath", scope == url, scope)
        keys = p.evaluate("caches.keys()")
        check(engine, "one versioned cache", len(keys) == 1 and keys[0].startswith("solovoyage-"), keys)
        p.evaluate("caches.open('solovoyage-old').then(c => c.put('x', new Response('old')))")
        sw = copy / "sw.js"
        sw.write_text(re.sub(r'const VERSION = "[^"]*";', 'const VERSION = "qa-next";', sw.read_text(encoding="utf-8")), encoding="utf-8")
        p.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
        p.wait_for_selector(".toast >> text=new version", timeout=15000)
        check(engine, "an update waits and offers Refresh", p.evaluate("navigator.serviceWorker.getRegistration().then(r => !!r.waiting)"))
        with p.expect_navigation():
            p.locator(".toast button", has_text="Refresh").click()
        p.wait_for_function("caches.keys().then(k => k.length === 1 && k[0] === 'solovoyage-qa-next')")
        check(engine, "old caches are removed after the update", True)
        server.shutdown()
        server.server_close()
        s.context.set_offline(True)
        s.errors.clear()
        failed = []
        for path in ["index.html", "guides.html", "guide.html?id=know-emergency-exits", "emergency.html#medical", "checklist.html", "planner.html", "packing.html", "dashboard.html", "bookmarks.html", "search.html?q=taxi", "digital-safety.html", "about.html", ""]:
            try:
                s.go(path)
                if p.locator("main h1").count() != 1 or "could not be loaded" in p.locator("main").inner_text():
                    failed.append(path)
            except Exception as error:
                failed.append(f"{path}: {error}"[:200])
        check(engine, "13 routes work with the server gone and the browser offline", not failed, failed)
        s.go("no-such-page.html")
        check(engine, "uncached page shows the offline fallback", "You are offline" in p.locator("h1").inner_text())
        entries = p.evaluate("caches.keys().then(async k => (await (await caches.open(k[0])).keys()).map(r => r.url))")
        check(engine, "cache holds only static site files (no query strings, no other origins)", all(u.startswith(url) and "?" not in u for u in entries), [u for u in entries if "?" in u or not u.startswith(url)])
        s.close()


def flow_404(browser, base, engine):
    s = Session(browser, base)
    s.page.goto(base + "404.html")
    hrefs = s.page.locator("a").evaluate_all("a => a.map(x => x.href)")
    check(engine, "404 page links stay under the site path", all(h.startswith(base) for h in hrefs), hrefs)
    s.close()


FLOWS = [flow_pages, flow_navigation, flow_search, flow_library, flow_checklist, flow_planner, flow_packing, flow_emergency, flow_dashboard_privacy, flow_theme, flow_privacy_network, flow_offline, flow_404, flow_every_guide, flow_a11y, flow_responsive]


def main():
    engines = [a for a in sys.argv[1:] if not a.startswith("-")] or ["chromium", "firefox", "webkit"]
    only = next((a.split("=", 1)[1].split(",") for a in sys.argv if a.startswith("--only=")), None)
    if not only:
        static_checks()
    server, base = serve()
    versions = {}
    with sync_playwright() as pw:
        for engine in engines:
            try:
                browser = getattr(pw, engine).launch()
            except Exception as error:
                print(f"SKIP {engine}: {str(error)[:200]}")
                continue
            versions[engine] = browser.version
            for flow in FLOWS:
                name = flow.__name__[5:]
                if only and name not in only:
                    continue
                # The slow sweeps run in full in Chromium; other engines run a smaller set.
                if engine != "chromium" and name in ("every_guide",):
                    continue
                print(f"{engine}: {name}", flush=True)
                try:
                    flow(browser, base, engine)
                except Exception:
                    check(engine, f"{name} flow completed", False, traceback.format_exc()[-900:])
            browser.close()
    server.shutdown()
    failed = [r for r in RESULTS if not r[2]]
    print(f"\n{len(RESULTS) - len(failed)} passed, {len(failed)} failed, {len(RESULTS)} total. Engines: {versions}")
    report = {"date": dt.date.today().isoformat(), "engines": versions, "passed": len(RESULTS) - len(failed), "failed": len(failed), "results": [dict(zip(("group", "name", "ok", "detail"), r)) for r in RESULTS]}
    (pathlib.Path(tempfile.gettempdir()) / "solovoyage-qa.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
