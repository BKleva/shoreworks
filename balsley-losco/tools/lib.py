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
def town_of(l): return TOWN[l["town"]]

def write(path, content):
    p = os.path.join(OUT, path.strip("/"), "index.html") if not path.endswith((".xml", ".txt", ".svg", ".json", ".html", ".toml", "_headers")) else os.path.join(OUT, path.strip("/"))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)

# ---------------------------------------------------------------- SVG art
def _hsl(h, s, l): return "hsl(%d,%d%%,%d%%)" % (h % 360, s, l)

def scene(seed, hue, kind="gable", water=False, w=800, h=600, label=""):
    r = random.Random(seed)
    sky1, sky2 = _hsl(hue, 55, 82), _hsl(hue + 25, 70, 94)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{E(label)}">',
         f'<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{sky1}"/><stop offset="1" stop-color="{sky2}"/></linearGradient></defs>',
         f'<rect width="{w}" height="{h}" fill="url(#s)"/>',
         f'<circle cx="{r.randint(560,700)}" cy="{r.randint(90,150)}" r="46" fill="#fbd45f" opacity=".9"/>']
    for i in range(3):
        cx, cy = r.randint(60, 700), r.randint(50, 200)
        o.append(f'<g fill="#fff" opacity=".75"><ellipse cx="{cx}" cy="{cy}" rx="60" ry="16"/><ellipse cx="{cx+30}" cy="{cy-10}" rx="38" ry="14"/></g>')
    horizon = int(h * 0.64)
    if water:
        o.append(f'<rect y="{horizon-40}" width="{w}" height="{h-horizon+40}" fill="{_hsl(hue+5,55,52)}"/>')
        for i in range(6):
            y = horizon - 30 + i * 22
            o.append(f'<path d="M0 {y} q50 -12 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>')
    o.append(f'<path d="M0 {horizon} Q{w/2} {horizon-26} {w} {horizon} V{h} H0Z" fill="{_hsl(hue-60 if not water else 38,35 if not water else 55,66 if not water else 80)}"/>')
    o.append(f'<rect y="{horizon+30}" width="{w}" height="{h}" fill="{_hsl(hue-70 if not water else 40,32 if not water else 50,56 if not water else 72)}" opacity=".6"/>')
    body = r.choice(["#f6f0e4", "#e3edf2", "#ecdfc9", "#d3e5da", "#f4dccf", "#e9e3f2"])
    roof = r.choice(["#37424f", "#5b3a2e", "#2f4358", "#4a4a4a"])
    door = r.choice(["#c8202f", "#0c2340", "#1f5f8b", "#2e6b4f"])
    def win(x, y, ww=46, hh=58):
        return f'<rect x="{x-3}" y="{y-3}" width="{ww+6}" height="{hh+6}" rx="3" fill="#fff"/><rect x="{x}" y="{y}" width="{ww}" height="{hh}" rx="2" fill="#9fc6dd"/><path d="M{x+ww/2} {y}V{y+hh}M{x} {y+hh/2}H{x+ww}" stroke="#fff" stroke-width="3"/>'
    if kind == "gable":
        x, y, bw, bh = 190, horizon - 150, 420, 170
        o.append(f'<ellipse cx="400" cy="{horizon+32}" rx="260" ry="18" fill="#000" opacity=".12"/>')
        o.append(f'<rect x="{x}" y="{y}" width="{bw}" height="{bh}" fill="{body}"/>')
        o.append(f'<path d="M{x-24} {y+4} L{x+bw/2} {y-100} L{x+bw+24} {y+4}Z" fill="{roof}"/>')
        o.append(f'<rect x="{x+bw-110}" y="{y-92}" width="30" height="62" fill="#9a5f4b"/>')
        o.append(win(x+34, y+34) + win(x+130, y+34) + win(x+290, y+34) + win(x+340, y+34, 40, 58))
        o.append(f'<rect x="{x+bw/2-24}" y="{y+70}" width="48" height="{bh-70}" rx="3" fill="{door}"/><circle cx="{x+bw/2+14}" cy="{y+122}" r="3" fill="#f2b632"/>')
        o.append(f'<rect x="{x+bw/2-70}" y="{y+bh-10}" width="140" height="10" fill="#cfc7b6"/>')
    elif kind == "modern":
        x = 150
        o.append(f'<ellipse cx="400" cy="{horizon+32}" rx="290" ry="18" fill="#000" opacity=".12"/>')
        o.append(f'<rect x="{x}" y="{horizon-120}" width="360" height="150" fill="{body}"/>')
        o.append(f'<rect x="{x+90}" y="{horizon-215}" width="360" height="96" fill="#37424f"/>')
        o.append(f'<rect x="{x+110}" y="{horizon-198}" width="320" height="62" fill="#9fc6dd" opacity=".95"/>')
        o.append(f'<path d="M{x+110+80} {horizon-198}V{horizon-136}M{x+110+160} {horizon-198}V{horizon-136}M{x+110+240} {horizon-198}V{horizon-136}" stroke="#fff" stroke-width="3"/>')
        o.append(f'<rect x="{x+20}" y="{horizon-98}" width="200" height="100" fill="#9fc6dd" opacity=".95"/><path d="M{x+120} {horizon-98}V{horizon+2}" stroke="#fff" stroke-width="3"/>')
        o.append(f'<rect x="{x+250}" y="{horizon-90}" width="44" height="92" rx="3" fill="{door}"/>')
        o.append(f'<rect x="{x+300}" y="{horizon-120}" width="150" height="8" fill="#5b3a2e"/><rect x="{x+300}" y="{horizon-112}" width="150" height="130" fill="{body}" opacity=".0"/>')
    else:  # tall / condo
        x = 270
        o.append(f'<ellipse cx="400" cy="{horizon+32}" rx="200" ry="16" fill="#000" opacity=".12"/>')
        o.append(f'<rect x="{x}" y="{horizon-280}" width="260" height="310" fill="{body}"/><rect x="{x-10}" y="{horizon-292}" width="280" height="16" fill="{roof}"/>')
        for rr in range(4):
            for cc in range(3):
                wx, wy = x + 26 + cc * 80, horizon - 252 + rr * 72
                o.append(f'<rect x="{wx}" y="{wy}" width="54" height="42" fill="#9fc6dd"/><rect x="{wx-6}" y="{wy+44}" width="66" height="7" fill="#fff"/>')
        o.append(f'<rect x="{x+100}" y="{horizon-60}" width="60" height="90" rx="3" fill="{door}"/>')
    if kind != "tall":
        for tx in (70, 720):
            o.append(f'<rect x="{tx-5}" y="{horizon-30}" width="10" height="46" fill="#6b4a36"/><circle cx="{tx}" cy="{horizon-52}" r="36" fill="{_hsl(125,35,40)}"/><circle cx="{tx+18}" cy="{horizon-40}" r="26" fill="{_hsl(125,35,46)}"/>')
    o.append("</svg>")
    return "".join(o)

def landscape(seed, hue, kind, label=""):
    """town cards, 800x500"""
    w, h = 800, 500
    r = random.Random(seed)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{E(label)}">',
         f'<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{_hsl(hue,60,78)}"/><stop offset="1" stop-color="{_hsl(hue+20,75,94)}"/></linearGradient></defs>',
         f'<rect width="{w}" height="{h}" fill="url(#s)"/><circle cx="{r.randint(100,700)}" cy="100" r="42" fill="#fbd45f" opacity=".9"/>']
    hz = 300
    if kind in ("beach", "bay"):
        o.append(f'<rect y="{hz-40}" width="{w}" height="260" fill="{_hsl(hue+5,55,50)}"/>')
        for i in range(5):
            y = hz - 20 + i * 22
            o.append(f'<path d="M0 {y} q50 -12 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3"/>')
        if kind == "beach":
            o.append(f'<path d="M0 {h-120} Q400 {h-170} {w} {h-110} V{h} H0Z" fill="#f2dfb5"/>')
            for i in range(3):
                x = r.randint(120, 680); c = r.choice(["#c8202f", "#f2b632", "#1f5f8b"])
                o.append(f'<path d="M{x-40} {h-110} A40 40 0 0 1 {x+40} {h-110}Z" fill="{c}"/><rect x="{x-2}" y="{h-110}" width="4" height="46" fill="#6b4a36"/>')
        else:
            o.append(f'<path d="M0 {h-70} Q400 {h-110} {w} {h-60} V{h} H0Z" fill="#c9b58a"/><rect x="60" y="{h-130}" width="300" height="10" fill="#6b4a36"/>')
            for i in range(4): o.append(f'<rect x="{80+i*80}" y="{h-125}" width="8" height="55" fill="#6b4a36"/>')
            for bx in (480, 640):
                o.append(f'<path d="M{bx-50} {hz+40} H{bx+50} L{bx+36} {hz+70} H{bx-36}Z" fill="#fff"/><rect x="{bx-2}" y="{hz-60}" width="4" height="100" fill="#37424f"/><path d="M{bx+4} {hz-56} L{bx+44} {hz+26} H{bx+4}Z" fill="#c8202f"/>')
    elif kind == "farm":
        for i, (c, y) in enumerate([("#a9c77a", hz), ("#8fb562", hz + 40), ("#779f4c", hz + 90), ("#628a3a", hz + 150)]):
            o.append(f'<path d="M0 {y} Q{w/2} {y-30-i*6} {w} {y-6} V{h} H0Z" fill="{c}"/>')
        o.append(f'<rect x="520" y="{hz-70}" width="150" height="100" fill="#b5352f"/><path d="M510 {hz-66} L595 {hz-130} L680 {hz-66}Z" fill="#7a2420"/><rect x="570" y="{hz-30}" width="50" height="60" fill="#f6f0e4"/>')
        for i in range(5):
            x = r.randint(60, 420)
            o.append(f'<rect x="{x}" y="{hz+20}" width="8" height="40" fill="#6b4a36"/><circle cx="{x+4}" cy="{hz+8}" r="30" fill="#4d7a37"/>')
    else:  # suburb
        o.append(f'<path d="M0 {hz} Q400 {hz-24} {w} {hz} V{h} H0Z" fill="#9cc473"/><rect y="{h-70}" width="{w}" height="70" fill="#8a8f98"/><rect y="{h-38}" width="{w}" height="4" fill="#fff" opacity=".8"/>')
        for i in range(3):
            x = 60 + i * 250; body = r.choice(["#f6f0e4", "#e3edf2", "#ecdfc9", "#f4dccf"]); roof = r.choice(["#37424f", "#5b3a2e", "#2f4358"])
            o.append(f'<rect x="{x}" y="{hz-60}" width="190" height="90" fill="{body}"/><path d="M{x-12} {hz-58} L{x+95} {hz-130} L{x+202} {hz-58}Z" fill="{roof}"/><rect x="{x+80}" y="{hz-8}" width="30" height="38" rx="2" fill="#c8202f"/><rect x="{x+20}" y="{hz-40}" width="34" height="30" fill="#9fc6dd"/><rect x="{x+136}" y="{hz-40}" width="34" height="30" fill="#9fc6dd"/>')
            o.append(f'<rect x="{x+205}" y="{hz-10}" width="8" height="40" fill="#6b4a36"/><circle cx="{x+209}" cy="{hz-26}" r="26" fill="#4d7a37"/>')
    o.append("</svg>")
    return "".join(o)

def hero_art():
    return ('<svg class="hero-art" viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'
            '<path d="M0 90 C240 40 480 140 720 90 S1200 40 1440 100 V180 H0Z" fill="#fff" opacity=".18"/>'
            '<path d="M0 120 C260 70 520 160 780 115 S1220 80 1440 125 V180 H0Z" fill="#fff" opacity=".28"/>'
            '<path d="M0 150 C300 110 560 180 820 146 S1250 120 1440 150 V180 H0Z" fill="#fff"/></svg>')

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
             "url": SITE_URL + "/", "logo": SITE_URL + "/assets/img/logo.svg", "image": SITE_URL + "/assets/img/og-default.png",
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

def layout(title, desc, path, main, *, schema=None, noindex=False, active="", og_image="/assets/img/og-default.png", hero=None, prio="0.6", freq="monthly", in_sitemap=True, og_type="website"):
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
    return f'''<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(full_title)}</title>
<meta name="description" content="{E(desc)}">
{robots}
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#0c2340">
<meta name="geo.region" content="US-NJ"><meta name="geo.placename" content="Northfield, New Jersey">
<meta property="og:type" content="{og_type}"><meta property="og:site_name" content="{BRAND}"><meta property="og:title" content="{E(full_title)}">
<meta property="og:description" content="{E(desc)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE_URL}{og_image}">
<meta property="og:locale" content="en_US"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/assets/css/site.css">
{ld}
</head>
<body>
<a class="skip" href="#main">Skip to main content</a>
<div class="topbar"><div class="wrap"><span>Serving Atlantic &amp; Cape May Counties since {FOUNDED}</span>
<span class="tb-links"><a href="tel:{ho['tel']}">{PHONE}</a><a href="/account/">Sign in</a><a href="/agent-portal/">Agent portal</a></span></div></div>
<header class="site-header"><div class="wrap">
<a class="brand" href="/" aria-label="{BRAND} home">{logo()}<span class="brand-name">Balsley Losco<small>Real Estate · Since {FOUNDED}</small></span></a>
<button class="burger" aria-label="Open menu" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button>
<nav class="nav" id="nav" aria-label="Main"><ul>{nav_html(active)}</ul>
<div class="nav-cta"><a class="btn sm ghost" href="/account/">Sign in</a><a class="btn sm" href="/sell/home-value/">Free home value</a></div></nav>
</div></header>
{hero or ""}
<main id="main">{main}</main>
{footer_html()}
<div class="mobilebar"><a class="btn sm navy" href="tel:{ho['tel']}">Call us</a><a class="btn sm" href="/search/">Search homes</a></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/assets/js/site.js" defer></script>
</body>
</html>'''

def footer_html():
    towns = "".join(f'<li><a href="/homes-for-sale/{t["slug"]}/">{E(t["name"])}</a></li>' for t in TOWNS[:8])
    offs = "".join(f'<p><b style="color:#fff">{E(o["name"].split("– ")[1])}</b><br>{E(o["street"])}<br>{E(o["city"])}, {o["state"]} {o["zip"]}<br><a href="tel:{o["tel"]}">{o["phone"]}</a></p>' for o in OFFICES)
    return f'''<footer class="site-footer"><div class="wrap">
<div class="fgrid">
<div><a class="brand" href="/">{logo(42)}<span class="brand-name">Balsley Losco<small>Real Estate</small></span></a>
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
            f'{f"<span class=eyebrow style=color:var(--gold)>{E(eyebrow)}</span>" if eyebrow else ""}<h1>{h1}</h1>'
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

def lcard(l):
    t = town_of(l)
    tag = ""
    if l.get("open"): tag = '<span class="tag open">Open house</span>'
    elif l["status"] == "New": tag = '<span class="tag new">New</span>'
    baths = ("%g" % l["baths"])
    facts = f'<li><b>{l["beds"]}</b> bd</li><li><b>{baths}</b> ba</li><li><b>{l["sqft"]:,}</b> sf</li>'
    search = f'{l["addr"]} {t["name"]} {t["zip"]} {l["type"]} {l["title"]}'.lower()
    return (f'<article class="card lcard" data-slug="{l["slug"]}" data-price="{l["price"]}" data-beds="{l["beds"]}" data-baths="{l["baths"]}" data-sqft="{l["sqft"]}" '
            f'data-type="{l["type"]}" data-town="{t["slug"]}" data-wf="{int(l["wf"])}" data-open="{int(bool(l.get("open")))}" data-new="{int(l["status"]=="New")}" data-search="{E(search)}">'
            f'<div class="img"><img src="/assets/img/l-{l["slug"]}.svg" alt="{E(l["title"])} — {E(l["addr"])}, {E(t["name"])}, NJ" width="800" height="600" loading="lazy">{tag}'
            f'<button class="fav" type="button" aria-pressed="false" aria-label="Save {E(l["addr"])}" data-fav="{l["slug"]}"><svg viewBox="0 0 24 24"><path d="M12 21s-8-4.9-9.5-10C1.400 7.500 3.800 4.500 7 4.500c2 0 3.700 1 5 2.800 1.300-1.800 3-2.800 5-2.800 3.200 0 5.600 3 4.500 6.500C20 16.100 12 21 12 21z"/></svg></button></div>'
            f'<div class="body"><div class="price">{lprice(l)}</div><p class="addr">{E(l["addr"])}</p><p class="town">{E(t["name"])}, NJ {t["zip"]} · {E(l["type"])}</p><ul class="facts">{facts}</ul></div>'
            f'<a class="cover" href="/listing/{l["slug"]}/">View {E(l["addr"])}, {E(t["name"])}</a></article>')

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
