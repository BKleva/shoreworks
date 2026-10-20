# -*- coding: utf-8 -*-
"""Shared helpers: layout, SVG art, schema, forms."""
import html, json, os, random, re
from data import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public")
PAGES = []  # (path, priority, changefreq) for sitemap

E = lambda s: html.escape(str(s), quote=True)
def money(n): return "${:,.0f}".format(n)
def slugify(s):
    s = re.sub(r"[\"'()]", "", s.lower())
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

TOWN = {t["slug"]: t for t in TOWNS}
def town_of(l):
    base = TOWN.get(l["town"], dict(slug="", name=l["city"], county="", tagline=""))
    return dict(base, zip=l["zip"] or base.get("zip", ""), lat=l["lat"], lng=l["lng"])

def write(path, content):
    p = os.path.join(OUT, path.strip("/"), "index.html") if not path.endswith((".xml", ".txt", ".svg", ".json", ".html", ".toml", "_headers")) else os.path.join(OUT, path.strip("/"))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)

# ---------------------------------------------------------------- SVG art
from art import scene, landscape, hero_art, _hsl

LOGO_IMG = '<img src="/assets/img/logo-bl.png" alt="Balsley Losco Realty" width="470" height="250">'

def logo(size=46):
    return (f'<svg class="brand-mark" width="{size}" height="{size}" viewBox="0 0 64 64" aria-hidden="true">'
            '<circle cx="32" cy="32" r="30" fill="#f2b632"/><circle cx="32" cy="32" r="25" fill="#c8202f"/>'
            '<path d="M13 31 L32 14 L51 31" fill="none" stroke="#f2b632" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'
            '<text x="32" y="46" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="21" fill="#fff">BL</text></svg>')

# ---------------------------------------------------------------- nav
NAV = [
    ("Buy", "/buy/", [("Search all homes", "/search/"), ("Homes by town", "/homes-for-sale/"), ("Open houses", "/open-houses/"), ("Condos for sale", "/condos-for-sale/"), ("Waterfront homes", "/waterfront-homes/"), ("Buyer's guide", "/buy/"), ("Mortgage calculator", "/buy/mortgage-calculator/"), ("Get pre-approved", "/buy/pre-approval/"), ("First-time buyer programs", "/guides/first-time-home-buyer-programs-new-jersey/")]),
    ("Sell", "/sell/", [("Free home valuation", "/sell/home-value/"), ("Sell with Balsley Losco", "/sell/"), ("What's my home worth?", "/guides/what-is-my-home-worth/")]),
    ("Rent", "/rentals/", [("Rental search", "/rentals/"), ("Rental application", "https://secure2.ntnonline.com/securelease/default.cfm?propcode=BL1630&unit=9498")]),
    ("Agents", "/agents/", [("Find an agent", "/agents/"), ("Join our team", "/careers/"), ("Agent portal", "/agent-portal/")]),
    ("Areas", "/homes-for-sale/", [(t["name"], f"/homes-for-sale/{t['slug']}/") for t in TOWNS]),
    ("About", "/about/", [("Our story", "/about/"), ("Office locations", "/offices/"), ("Buyer & seller guides", "/guides/"), ("Commercial & investment", "/commercial/"), ("Contact us", "/contact/")]),
]

def nav_html(active=""):
    items = []
    for label, href, subs in NAV:
        cols = " cols" if label == "Areas" else ""
        on = " on" if active == label else ""
        drop = "".join(f'<a href="{E(u)}"{" rel=noopener target=_blank" if u.startswith("http") else ""}>{E(t)}</a>' for t, u in subs)
        items.append(f'<li><a class="nl{on}" href="{href}">{label}</a><div class="drop{cols}">{drop}</div></li>')
    return "".join(items)

# ---------------------------------------------------------------- schema
def org_schema():
    hq = OFFICES[0]
    def addr(o): return {"@type": "PostalAddress", "streetAddress": o["street"], "addressLocality": o["city"], "addressRegion": o["state"], "postalCode": o["zip"], "addressCountry": "US"}
    return {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": ["RealEstateAgent", "LocalBusiness"], "@id": SITE_URL + "/#org", "name": BRAND, "alternateName": ["Balsley Losco", "BL Homes"],
             "url": SITE_URL + "/", "logo": SITE_URL + "/assets/img/logo-bl.png", "image": SITE_URL + "/assets/img/og-default.png",
             "telephone": hq["tel"], "foundingDate": str(FOUNDED), "slogan": "Trust the Name You Know", "address": addr(hq),
             "geo": {"@type": "GeoCoordinates", "latitude": hq["lat"], "longitude": hq["lng"]},
             "areaServed": [{"@type": "City", "name": t["name"] + ", NJ"} for t in TOWNS],
             "sameAs": ["https://www.facebook.com/blrealty"],
             "department": [{"@type": "RealEstateAgent", "name": o["name"], "telephone": o["tel"], "address": addr(o),
                             "geo": {"@type": "GeoCoordinates", "latitude": o["lat"], "longitude": o["lng"]}, "url": f"{SITE_URL}/offices/{o['slug']}/"} for o in OFFICES]},
            {"@type": "WebSite", "@id": SITE_URL + "/#website", "url": SITE_URL + "/", "name": BRAND, "publisher": {"@id": SITE_URL + "/#org"},
             "potentialAction": {"@type": "SearchAction", "target": {"@type": "EntryPoint", "urlTemplate": SITE_URL + "/search/?q={search_term_string}"}, "query-input": "required name=search_term_string"}},
        ],
    }

def crumb_schema(crumbs):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE_URL + u} for i, (n, u) in enumerate(crumbs)]}

def faq_schema(faqs):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}

def crumbs_html(crumbs):
    li = []
    for i, (n, u) in enumerate(crumbs):
        li.append(f'<li><a href="{u}">{E(n)}</a></li>' if i < len(crumbs) - 1 else f'<li aria-current="page">{E(n)}</li>')
    return f'<nav class="crumbs" aria-label="Breadcrumb"><div class="wrap"><ol>{"".join(li)}</ol></div></nav>'

def faq_html(faqs):
    return '<div class="faq">' + "".join(f"<details><summary>{E(q)}</summary><p>{E(a)}</p></details>" for q, a in faqs) + "</div>"

# ---------------------------------------------------------------- layout
LEGAL = ("Listing information is deemed reliable but not guaranteed and should be independently verified. All properties are subject to prior sale, change or withdrawal. "
         "Listing data appears in part through participating MLS programs, including the Cape May County MLS, a voluntary cooperative exchange of property listing data between licensed real estate brokerage firms, and is provided through licensing agreements. "
         "Information is provided for consumers' personal, non-commercial use and may not be used for any purpose other than to identify prospective properties consumers may be interested in purchasing.")

def layout(title, desc, path, main, *, schema=None, noindex=False, active="", og_image="/assets/img/og-default.png", hero=None, prio="0.6", freq="monthly", in_sitemap=True, og_type="website", bare=False, maps=False, home=False):
    url = SITE_URL + path
    full_title = title if SHORT in title else f"{title} | {SHORT}"
    if len(desc) > 160:
        desc = desc[:157].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
    if in_sitemap and not noindex:
        PAGES.append((path, prio, freq))
    graph = [org_schema()] + (schema or [])
    ld = "".join(f'<script type="application/ld+json">{json.dumps(g, ensure_ascii=False, separators=(",", ":"))}</script>' for g in graph)
    robots = '<meta name="robots" content="noindex,nofollow">' if noindex else '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">'
    ho = OFFICES[0]
    topbar = "" if True else f'''<div class="topbar"><div class="wrap"><span>Serving Atlantic &amp; Cape May Counties since {FOUNDED}</span>
<span class="tb-links"><a href="tel:{ho['tel']}">{PHONE}</a><a href="/account/">Sign in</a><a href="/agent-portal/">Agent portal</a></span></div></div>'''
    foot = footer_html()
    mbar = "" if bare else f'<div class="mobilebar"><a class="btn sm navy" href="tel:{ho["tel"]}">Call us</a><a class="btn sm" href="/search/">Search homes</a></div>'
    leaflet_css = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">' if maps else ""
    leaflet_js = '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" defer></script><script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js" defer></script>' if maps else ""
    return f'''<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(full_title)}</title>
<meta name="description" content="{E(desc)}">
{robots}
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#a8192a">
<meta name="geo.region" content="US-NJ"><meta name="geo.placename" content="Northfield, New Jersey">
<meta property="og:type" content="{og_type}"><meta property="og:site_name" content="{BRAND}"><meta property="og:title" content="{E(full_title)}">
<meta property="og:description" content="{E(desc)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE_URL}{og_image}">
<meta property="og:locale" content="en_US"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Open+Sans:wght@400;600;700;800&display=swap">
{leaflet_css}<link rel="stylesheet" href="/assets/css/site.css">
{ld}
</head>
<body{' class="app"' if bare else ' class="home"' if home else ''}>
<a class="skip" href="#main">Skip to main content</a>
{topbar}
<header class="site-header"><div class="wrap">
<a class="brand" href="/" aria-label="{BRAND} home">{LOGO_IMG}</a>
<button class="burger" aria-label="Open menu" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button>
<nav class="nav" id="nav" aria-label="Main"><ul>{nav_html(active)}</ul>
<div class="nav-cta"><a class="phone" href="tel:{ho['tel']}">{PHONE}</a><a class="btn sm ghost" href="/account/">Sign in</a><a class="btn sm" href="/sell/home-value/">Free home value</a></div></nav>
</div></header>
{hero or ""}
<main id="main">{main}</main>
{foot}
{mbar}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
{leaflet_js}<script src="/assets/js/site.js" defer></script>
</body>
</html>'''

def footer_html():
    towns = "".join(f'<li><a href="/homes-for-sale/{t["slug"]}/">{E(t["name"])}</a></li>' for t in TOWNS[:8])
    offs = "".join(f'<p><b style="color:#fff">{E(o["name"].split("– ")[1])}</b><br>{E(o["street"])}<br>{E(o["city"])}, {o["state"]} {o["zip"]}<br><a href="tel:{o["tel"]}">{o["phone"]}</a></p>' for o in OFFICES)
    return f'''<footer class="site-footer"><div class="wrap">
<div class="fgrid">
<div><a class="brand" href="/">{LOGO_IMG}</a>
<p style="margin-top:16px">Locally owned and operated since {FOUNDED}. Trust the name you know.</p>
<p><a href="https://www.facebook.com/blrealty" rel="noopener me" target="_blank">Facebook</a></p></div>
<div><h4>Buy</h4><ul><li><a href="/search/">Search homes</a></li><li><a href="/open-houses/">Open houses</a></li><li><a href="/condos-for-sale/">Condos for sale</a></li><li><a href="/waterfront-homes/">Waterfront homes</a></li><li><a href="/buy/mortgage-calculator/">Mortgage calculator</a></li><li><a href="/buy/pre-approval/">Get pre-approved</a></li></ul></div>
<div><h4>Sell &amp; Rent</h4><ul><li><a href="/sell/home-value/">Free home valuation</a></li><li><a href="/sell/">Sell with us</a></li><li><a href="/rentals/">Rentals</a></li><li><a href="/commercial/">Commercial</a></li><li><a href="/guides/">Guides</a></li></ul></div>
<div><h4>Areas</h4><ul>{towns}<li><a href="/homes-for-sale/">All areas →</a></li></ul></div>
<div><h4>Offices</h4>{offs}</div>
</div>
<div class="legal"><div class="eho"><svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 3 14h4v13h18V14h4z" fill="none" stroke="#a9bdd3" stroke-width="2" stroke-linejoin="round"/><path d="M11 17h10M11 21h10" stroke="#a9bdd3" stroke-width="2"/></svg><span><b style="color:#fff">Equal Housing Opportunity.</b> We pledge to the letter and spirit of U.S. policy for the achievement of equal housing opportunity.</span></div>
<p>{LEGAL}</p>
<p>© 2026 {BRAND}. All rights reserved. · <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/fair-housing/">Fair Housing</a> · <a href="/accessibility/">Accessibility</a> · <a href="/sitemap/">Site map</a> · <a href="/agents/">Agents</a> · <a href="/careers/">Careers</a></p></div>
</div></footer>'''

def page_hero(h1, lead="", crumbs=None, eyebrow="", extra="", small=True):
    cr = crumbs_html(crumbs) if crumbs else ""
    return (f'<section class="hero{" small" if small else ""}">{cr}<div class="wrap">'
            f'{f"<span class=eyebrow style=color:var(--red)>{E(eyebrow)}</span>" if eyebrow else ""}<h1>{h1}</h1>'
            f'{f"<p class=lead>{lead}</p>" if lead else ""}{extra}</div>{hero_art()}</section>')

# ---------------------------------------------------------------- components
CONSENT = ('<div class="consent"><label><input type="checkbox" name="sms_consent" value="yes"> Yes, I consent to receive calls and texts from Balsley Losco Real Estate about my inquiry. '
           'Message &amp; data rates may apply. Reply STOP to opt out. See our <a href="/privacy/">Privacy Policy</a> and <a href="/terms/">Terms</a>.</label></div>')

def form(name, fields, button="Send", hidden=None, consent=True, extra_class=""):
    h = "".join(f'<input type="hidden" name="{E(k)}" value="{E(v)}">' for k, v in (hidden or {}).items())
    return (f'<form class="form {extra_class}" name="{name}" method="POST" action="/thanks/" data-netlify="true" netlify-honeypot="bot-field" data-ajax>'
            f'<input type="hidden" name="form-name" value="{name}"><p class="hp"><label>Do not fill this out <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>{h}'
            f'{fields}{CONSENT if consent else ""}<button class="btn" type="submit">{E(button)}</button><div class="ok-msg" role="status">Thank you! A Balsley Losco agent will be in touch shortly.</div></form>')

def field(label, name, typ="text", req=False, ph="", ac=""):
    r = " required" if req else ""
    a = f' autocomplete="{ac}"' if ac else ""
    return f'<div><label for="{name}-{typ}">{E(label)}</label><input id="{name}-{typ}" name="{name}" type="{typ}"{r} placeholder="{E(ph)}"{a}></div>'

def lprice(l): return money(l["price"]) + ("/mo" if l["type"] == "Rental" else "")

def ll(l):
    return round(l["lat"], 5), round(l["lng"], 5)

def short_price(l):
    p = l["price"]
    if l["type"] == "Rental": return "$%.1fK/mo" % (p / 1000)
    return "$%.1fM" % (p / 1e6) if p >= 1e6 else "$%dK" % round(p / 1000)

HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-8-4.9-9.5-10C1.400 7.500 3.800 4.500 7 4.500c2 0 3.700 1 5 2.800 1.300-1.800 3-2.800 5-2.800 3.200 0 5.600 3 4.500 6.500C20 16.100 12 21 12 21z"/></svg>'

def lcard(l):
    t = town_of(l)
    tag = ""
    if l.get("open"): tag = '<span class="tag open">Open house</span>'
    elif l["status"] == "Reduced": tag = '<span class="tag new">Price reduced</span>'
    elif l["status"] == "New": tag = '<span class="tag new">New</span>'
    elif l.get("label"): tag = f'<span class="tag">{E(l["label"])}</span>'
    baths = ("%g" % l["baths"])
    facts = f'<li><b>{l["beds"]}</b> beds</li><li><b>{baths}</b> baths</li>' + (f'<li><b>{l["sqft"]:,}</b> sqft</li>' if l["sqft"] else "") + (f'<li><b>{l["lot"]}</b> acres</li>' if l["lot"] else "")
    search = f'{l["addr"]} {t["name"]} {t["zip"]} {l["type"]} {l["title"]}'.lower()
    lat, lng = ll(l)
    return (f'<article class="card lcard" data-slug="{l["slug"]}" data-price="{l["price"]}" data-label="{short_price(l)}" data-lat="{lat}" data-lng="{lng}" data-beds="{l["beds"]}" data-baths="{l["baths"]}" data-sqft="{l["sqft"]}" '
            f'data-type="{l["type"]}" data-town="{t["slug"]}" data-wf="{int(l["wf"])}" data-open="{int(bool(l.get("open")))}" data-new="{int(l["status"] in ("New", "Reduced"))}" data-search="{E(search)}">'
            f'<div class="img"><img src="{E(l["img"])}" alt="{E(l["title"])} — {E(l["addr"])}, {E(t["name"])}, NJ" width="800" height="600" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=&#39;/assets/img/placeholder.svg&#39;">{tag}</div>'
            f'<div class="body"><div class="prow"><div class="price">{lprice(l)}</div><button class="fav" type="button" aria-pressed="false" aria-label="Save {E(l["addr"])}" data-fav="{l["slug"]}">{HEART}</button></div>'
            f'<ul class="facts">{facts}</ul><p class="addr">{E(l["addr"])}, {E(t["name"])}, NJ {t["zip"]}</p></div>'
            f'<a class="cover" href="/listing/{l["slug"]}/">View {E(l["addr"])}, {E(t["name"])}</a></article>')

def _opts(vals, fmt):
    return "".join(f'<option value="{v}">{fmt(v)}</option>' for v in vals)

def filter_bar():
    prices = [100000, 200000, 300000, 400000, 500000, 750000, 1000000, 1500000, 2000000]
    pf = lambda v: "${:,}".format(v)
    dl = "".join(f'<option value="{E(t["name"])}">' for t in TOWNS)
    return (f'<form class="ml-bar" role="search" onsubmit="return false"><div class="ml-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>'
            f'<label class="sr" for="f-q">City, ZIP or address</label><input id="f-q" placeholder="City, ZIP or address" autocomplete="off" list="towns-dl"><datalist id="towns-dl">{dl}</datalist></div>'
            f'<label class="sr" for="f-min">Min price</label><select id="f-min" class="sel"><option value="">No min</option>{_opts(prices, pf)}</select>'
            f'<label class="sr" for="f-max">Max price</label><select id="f-max" class="sel"><option value="">No max</option>{_opts(prices[1:] + [3000000], pf)}</select>'
            f'<label class="sr" for="f-beds">Beds</label><select id="f-beds" class="sel"><option value="">Beds</option>{_opts(range(1, 6), lambda v: f"{v}+ beds")}</select>'
            f'<label class="sr" for="f-baths">Baths</label><select id="f-baths" class="sel"><option value="">Baths</option>{_opts(range(1, 5), lambda v: f"{v}+ baths")}</select>'
            f'<label class="sr" for="f-type">Home type</label><select id="f-type" class="sel"><option value="">Home type</option><option>Single Family</option><option>Condo</option><option>Townhouse</option><option>Multi-Family</option><option>Rental</option></select>'
            f'<button type="button" class="sel more-btn" id="f-more" aria-expanded="false">More filters</button>'
            f'<button type="button" class="btn dark sm" id="save-search">Save search</button>'
            f'<div class="ml-more" id="ml-more" hidden><label><input type="checkbox" id="f-wf"> Waterfront / water access</label><label><input type="checkbox" id="f-open"> Open houses</label><label><input type="checkbox" id="f-new"> New / price reduced</label><button type="button" class="btn ghost sm" id="f-reset">Reset all</button></div></form>')

def maplist(ls, heading="homes", full=False, center=None, zoom=11):
    cx, cy = center or (39.40, -74.55)
    cards = "".join(lcard(l) for l in ls)
    return (f'<section class="ml{" full" if full else ""}" data-maplist data-view="list" data-center="{cx},{cy},{zoom}">{filter_bar() if full else ""}'
            f'<div class="ml-body"><div class="ml-map" role="region" aria-label="Map of homes"></div>'
            f'<aside class="ml-list" aria-label="Homes for sale"><div class="ml-head"><h2><span id="count">{len([x for x in ls if x["type"] != "Rental"]) if full else len(ls)}</span> {heading}</h2>'
            f'<div><label class="sr" for="sort">Sort</label><select id="sort" class="sel"><option value="rec">Sort: Recommended</option><option value="plh">Price: low to high</option><option value="phl">Price: high to low</option><option value="beds">Most bedrooms</option><option value="sqft">Largest</option></select></div></div>'
            f'<div class="ml-cards" id="results">{cards}</div><p class="empty" id="empty"><b>No homes match those filters.</b><br>Try widening your search or <a href="/contact/">ask an agent</a> about off-market homes.</p>'
            f'<p class="note" style="margin-top:18px">Listings are a snapshot from the Balsley Losco website (October 2026). Pin locations are approximate. The live MLS/IDX feed keeps listings, photos and map pins current at launch.</p></aside></div>'
            f'<div class="ml-toggle" role="group" aria-label="View"><button type="button" data-mlview="list" aria-pressed="true">List</button><button type="button" data-mlview="map" aria-pressed="false">Map</button></div></section>')

def tcard(t):
    n = sum(1 for l in LISTINGS if l["town"] == t["slug"])
    return (f'<a class="card tcard" href="/homes-for-sale/{t["slug"]}/"><div class="img"><img src="/assets/img/t-{t["slug"]}.svg" alt="Homes for sale in {E(t["name"])}, NJ" width="800" height="500" loading="lazy"></div>'
            f'<div class="body"><h3>{E(t["name"])}</h3><p>{E(t["tagline"])}</p><span class="more">Homes for sale in {E(t["name"])} →</span></div></a>')

def initials(name):
    p = re.sub(r"[\"'()]", "", name).split()
    return (p[0][0] + (p[-1][0] if len(p) > 1 else "")).upper()

PHOTO_BASE = {"D1": "https://d2td4dobkk213c.cloudfront.net/balsleylosco4193/profiles/", "D2": "https://dtzulyujzhqiu.cloudfront.net/balsleylosco4193/profiles/", "D3": "https://dtzulyujzhqiu.cloudfront.net//profiles/"}
def photo_url(code):
    if not code: return ""
    k, f = code.split(":", 1)
    return PHOTO_BASE[k] + f

def acard(a):
    ph = (f'<img src="{E(a["photo"])}" alt="{E(a["name"])}, {E(a["role"])} at Balsley Losco Real Estate" width="400" height="400" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{{className:\'avatar\',textContent:\'{initials(a["name"])}\'}}))">'
          if a["photo"] else f'<div class="avatar" aria-hidden="true">{initials(a["name"])}</div>')
    langs = f'<p class="langs">Also speaks: {E(a["lang"])}</p>' if a["lang"] and a["lang"].strip() != "English" else ""
    return (f'<article class="card acard" data-name="{E(a["name"].lower())}" data-role="{E(a["role"].lower())}" data-lang="{E(a["lang"].lower())}"><div class="ph">{ph}</div>'
            f'<div class="body"><h3>{E(a["name"])}</h3><p class="role">{E(a["role"])}</p>{langs}'
            f'<div class="actions"><a class="btn sm ghost" href="/agents/{a["slug"]}/">View profile</a></div></div></article>')

AGENTS = []
def load_agents():
    seen = set()
    for id_, name, role, lang, photo in json.load(open(os.path.join(ROOT, "tools", "agents.json"), encoding="utf-8")):
        s = slugify(name)
        if s in seen: s += "-" + id_
        seen.add(s)
        AGENTS.append(dict(id=id_, name=name, role=role, lang=lang, photo=photo_url(photo), slug=s))
    AGENTS.sort(key=lambda a: a["name"].split()[0].lower())
load_agents()
