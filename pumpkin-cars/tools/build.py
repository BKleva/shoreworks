"""Static site generator for Pumpkin Fine Cars & Exotics.

Run:  python tools/build.py      (from the pumpkin-cars folder)
Edit inventory in tools/data.py, reviews in tools/reviews.py, page copy below, then rebuild.
"""
import html
import json
import os
from collections import Counter

from data import CARS
from reviews import REVIEWS

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SITE = "https://www.pumpkincars.com"   # canonical domain (same as the current site)
NAME = "Pumpkin Fine Cars & Exotics"
PHONE = "(609) 646-7676"
PHONE_TEL = "+16096467676"
TEXT = "(609) 604-6057"
TEXT_TEL = "+16096046057"
EMAIL = "info@pumpkincars.com"
ADDR1 = "3084 English Creek Avenue"
ADDR2 = "Egg Harbor Township, NJ 08234"
MAPS_Q = "3084+English+Creek+Ave,+Egg+Harbor+Township,+NJ+08234"
DIR_URL = "https://www.google.com/maps/dir/?api=1&destination=" + MAPS_Q
HERO_IMG = "/images/directions.jpg"
SOCIAL = {
    "facebook": "https://www.facebook.com/pumpkincars",
    "instagram": "https://www.instagram.com/pumpkincars_eht",
    "youtube": "https://www.youtube.com/user/pumpkincars",
}
REVIEW_LINKS = [
    ("DealerRater", "https://www.dealerrater.com/dealer/Pumpkin-Fine-Cars-and-Exotics-review-43236/"),
    ("Google", "https://www.google.com/search?q=pumpkin+cars+reviews"),
    ("Cars.com", "https://www.cars.com/dealers/199284/pumpkin-fine-cars-exotics/reviews/"),
    ("Edmunds", "https://www.edmunds.com/dealerships/NewJersey/EggHarborTownship/PumpkinFineCarsExotics_860135/sales.1.html"),
]

esc = html.escape

def _svg(inner, fill="none"):
    st = ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' if fill == "none" else ""
    return f'<svg viewBox="0 0 24 24" fill="{"none" if fill == "none" else "currentColor"}"{st}>{inner}</svg>'

ICON = {
    "phone": _svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
    "chat": _svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    "pin": _svg('<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
    "clock": _svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    "mail": _svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
    "flag": _svg('<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>'),
    "home": _svg('<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
    "tag": _svg('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>'),
    "shield": _svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
    "wrench": _svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7V21h3.3l6.3-6.3a4 4 0 0 0 5.1-5.4L15 12l-3-3z"/>'),
    "key": _svg('<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 10-10M17 6l3 3M14 9l2 2"/>'),
    "truck": _svg('<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'),
    "globe": _svg('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>'),
    "fb": _svg('<path d="M14 8V6.5c0-.8.2-1.2 1.3-1.2H17V2.2C16.6 2.1 15.7 2 14.7 2 12.3 2 10.7 3.4 10.7 6v2H8v3.4h2.7V22H14V11.4h2.6L17 8z"/>', "solid"),
    "ig": _svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>'),
    "yt": _svg('<path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z"/>', "solid"),
}

# ---------------------------------------------------------------- helpers
def money(n): return "${:,}".format(n)
def num(n): return "{:,}".format(n)
def short(c): return f"{c['year']} {c['make']} {c['model']}"
def full(c): return f"{short(c)} {c['trim']}"
def url(c): return f"/used-cars-nj/{c['slug']}.html"

for _i, _c in enumerate(CARS, 1):
    _c["n"] = _i
    _c["imgs"] = [f"/images/cars/car-{_i:02d}-{j}.jpg" for j in range(1, len(_c['gal'].split(',')) + 1)]

MAKES = [m for m, _ in Counter(c["make"] for c in CARS).most_common()]
MAKE_COUNT = Counter(c["make"] for c in CARS)
BODIES = sorted(set(c["body"] for c in CARS))


def car_card(c):
    search = " ".join([short(c), c["trim"], c["ext"], c["body"], c["stock"]]).lower()
    return f'''<article class="car-card" data-make="{esc(c['make'])}" data-body="{c['body']}" data-price="{c['price']}" data-miles="{c['miles']}" data-year="{c['year']}" data-search="{esc(search)}">
  <a class="car-media" href="{url(c)}" tabindex="-1" aria-hidden="true"><img src="{c['imgs'][0]}" width="640" height="427" loading="lazy" decoding="async" alt="{esc(full(c))} in {esc(c['ext'])} for sale in Egg Harbor Township, NJ"><span class="car-tag">{esc(c['tag'])}</span></a>
  <div class="car-body">
    <h3><a href="{url(c)}">{esc(short(c))}</a></h3>
    <p class="car-trim">{esc(c['trim'])}</p>
    <ul class="car-meta"><li>{num(c['miles'])} mi</li><li>{esc(c['ext'])}</li><li>Stock #{c['stock']}</li></ul>
    <div class="car-foot"><span class="price">{money(c['price'])}</span><a class="btn btn-dark btn-sm" href="{url(c)}" aria-label="View details for {esc(full(c))}">View details</a></div>
  </div>
</article>'''


def logo(cls=""):
    return f'''<a class="logo {cls}" href="/" aria-label="Pumpkin Fine Cars &amp; Exotics by Franck Freon, home">
  <svg class="logo-swoosh" viewBox="0 0 230 28" preserveAspectRatio="none" aria-hidden="true"><path d="M3 26C52 -2 150 -4 226 15 150 8 62 11 3 26z" fill="#C8281C"/></svg>
  <span class="logo-word">Pumpkin<small>LLC</small></span>
  <span class="logo-sub">Fine Cars &amp; Exotics</span>
  <span class="logo-by">by <em>Franck Freon</em></span>
</a>'''


NAV = [
    ("/used-cars-nj.html", "Inventory"),
    ("/vehicle-appraisal.html", "Sell Your Car"),
    ("/financing-warranties.html", "Financing"),
    ("/meet-franck-freon.html", "Meet Franck"),
    ("/customer-testimonials.html", "Reviews"),
    ("/contact-us.html", "Contact"),
]

TICKER = [
    "28 déjà?? That’s 28 years in business",
    "Large indoor showroom open Tuesday through Saturday",
    "We buy your car even if you don’t buy ours",
    "Credit applications taken by phone",
    "Vehicles shipped to your front door at a low cost",
    "Hablamos Español — atención personalizada",
    "Owned by retired race car champion Franck Freon",
]


def header(active):
    links = "".join(
        '<a href="%s"%s>%s</a>' % (h, ' aria-current="page"' if h == active else "", t) for h, t in NAV)
    ticker = "".join(f"<span>{esc(t)}</span>" for t in TICKER)
    return f'''<a class="skip" href="#main">Skip to content</a>
<div class="topbar"><div class="container">
  <div class="tb-left"><span data-open-status><span class="dot closed"></span>Tue–Fri 9–6:30 · Sat 9–3</span></div>
  <div class="tb-right"><a href="{DIR_URL}" target="_blank" rel="noopener">{ADDR1}, Egg Harbor Twp</a><a href="sms:{TEXT_TEL}">Text {TEXT}</a><a href="mailto:{EMAIL}">{EMAIL}</a></div>
</div></div>
<header class="header"><div class="container">
  {logo()}
  <nav id="site-nav" class="nav" aria-label="Main">{links}<a class="nav-cta" href="tel:{PHONE_TEL}">Call {PHONE}</a></nav>
  <div class="header-cta">
    <a class="header-phone" href="tel:{PHONE_TEL}"><small>Call us</small><strong>{PHONE}</strong></a>
    <a class="btn btn-primary" href="/used-cars-nj.html">Browse Inventory</a>
    <button class="menu-btn" aria-expanded="false" aria-controls="site-nav" aria-label="Menu"><span></span></button>
  </div>
</div></header>
<div class="ticker" aria-label="Announcements"><div class="ticker-track">{ticker}</div></div>'''


def hours_rows():
    rows = [("Monday", 1, "Closed"), ("Tuesday", 2, "9:00 AM – 6:30 PM"), ("Wednesday", 3, "9:00 AM – 6:30 PM"),
            ("Thursday", 4, "9:00 AM – 6:30 PM"), ("Friday", 5, "9:00 AM – 6:30 PM"),
            ("Saturday", 6, "9:00 AM – 3:00 PM"), ("Sunday", 0, "Closed")]
    return "".join(f'<tr data-day="{d}"><td>{n}</td><td>{h}</td></tr>' for n, d, h in rows)


def footer():
    navs = "".join(f'<li><a href="{h}">{t}</a></li>' for h, t in NAV)
    brands = "".join(f'<li><a href="/used-cars-nj.html?make={esc(m)}">Used {esc(m)}</a></li>' for m in MAKES[:7])
    return f'''<footer class="footer"><div class="container">
  <div class="foot-grid">
    <div>{logo("light")}
      <p>Family-owned since 1998. A pre-owned car boutique without the boutique prices, in an indoor showroom minutes from Atlantic City.</p>
      <div class="social">
        <a href="{SOCIAL['facebook']}" aria-label="Pumpkin on Facebook" rel="noopener" target="_blank">{ICON['fb']}</a>
        <a href="{SOCIAL['instagram']}" aria-label="Pumpkin on Instagram" rel="noopener" target="_blank">{ICON['ig']}</a>
        <a href="{SOCIAL['youtube']}" aria-label="Pumpkin on YouTube" rel="noopener" target="_blank">{ICON['yt']}</a>
      </div>
    </div>
    <div><h4>Explore</h4><ul>{navs}
      <li><a href="/international-exports.html">International Exports</a></li></ul></div>
    <div><h4>Shop by Brand</h4><ul>{brands}</ul></div>
    <div><h4>Visit the Showroom</h4>
      <ul>
        <li>{ADDR1}<br>{ADDR2}</li>
        <li><a href="tel:{PHONE_TEL}">{PHONE}</a><br><a href="sms:{TEXT_TEL}">Text {TEXT}</a></li>
        <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
        <li>Tue–Fri 9:00–6:30<br>Sat 9:00–3:00 · Sun–Mon closed</li>
        <li><a href="/directions-to-indoor-showroom.html">Directions &rarr;</a></li>
      </ul></div>
  </div>
  <p class="disclaimer">Prices reflect only the vehicle sales price and do not include licensing, registration and taxes. All information is deemed reliable but not guaranteed. Photos may show optional equipment. EPA fuel-economy and range figures are estimates for comparison only; actual results vary.</p>
  <div class="foot-bottom">
    <span>&copy; <span data-current-year>2026</span> Pumpkin LLC. All rights reserved.</span>
    <span><a href="https://www.pumpkincars.com/legal-notice.html">Terms &amp; Conditions</a> &nbsp;|&nbsp; <a href="https://www.pumpkincars.com/privacy-policy.html">Privacy Policy</a></span>
  </div>
</div></footer>
<nav class="mobile-bar" aria-label="Quick contact">
  <a class="call" href="tel:{PHONE_TEL}">{ICON['phone']}Call</a>
  <a href="sms:{TEXT_TEL}">{ICON['chat']}Text</a>
  <a href="{DIR_URL}" target="_blank" rel="noopener">{ICON['pin']}Directions</a>
</nav>'''


def dealer_schema():
    return {
        "@context": "https://schema.org",
        "@type": "AutoDealer",
        "@id": SITE + "/#dealer",
        "name": NAME,
        "alternateName": "Pumpkin Cars",
        "url": SITE + "/",
        "logo": SITE + "/favicon.svg",
        "image": SITE + HERO_IMG,
        "telephone": "+1-609-646-7676",
        "email": EMAIL,
        "foundingDate": "1998",
        "priceRange": "$$",
        "address": {"@type": "PostalAddress", "streetAddress": "3084 English Creek Avenue",
                    "addressLocality": "Egg Harbor Township", "addressRegion": "NJ", "postalCode": "08234", "addressCountry": "US"},
        "openingHoursSpecification": [
            {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Tuesday", "Wednesday", "Thursday", "Friday"], "opens": "09:00", "closes": "18:30"},
            {"@type": "OpeningHoursSpecification", "dayOfWeek": "Saturday", "opens": "09:00", "closes": "15:00"},
        ],
        "areaServed": ["Atlantic City", "Egg Harbor Township", "Galloway", "Somers Point", "Margate City", "Ventnor", "Ocean City",
                       "Cape May", "Cherry Hill", "Philadelphia", "South Jersey"],
        "knowsLanguage": ["English", "Spanish", "French"],
        "sameAs": list(SOCIAL.values()) + [REVIEW_LINKS[0][1]],
    }


def page(path, title, desc, body, active=None, schema=None, og_image=HERO_IMG, noindex=False):
    canon = SITE + ("/" if path == "index.html" else "/" + path)
    ld = "".join('<script type="application/ld+json">%s</script>\n' % json.dumps(s, ensure_ascii=False) for s in (schema or []))
    robots = '<meta name="robots" content="noindex,follow">\n' if noindex else ""
    doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
{robots}<link rel="canonical" href="{canon}">
<meta name="theme-color" content="#121212">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{NAME}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{SITE}{og_image}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=Racing+Sans+One&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
{ld}</head>
<body>
{header(active)}
<main id="main">
{body}
</main>
{footer()}
<script src="/script.js" defer></script>
</body>
</html>
'''
    out = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(doc)


def page_hero(title, sub, crumbs):
    cr = ' <span>/</span> '.join(f'<a href="{h}">{t}</a>' if h else t for t, h in crumbs)
    return f'''<section class="page-hero"><div class="container">
  <div class="crumbs">{cr}</div>
  <h1>{title}</h1>
  <p>{sub}</p>
</div></section>'''


def honeypot():
    return '<p class="hp" aria-hidden="true"><label>Don’t fill this out: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>'


def faq_items():
    return [
        ("Where is Pumpkin Fine Cars & Exotics located?",
         "We’re at 3084 English Creek Avenue in Egg Harbor Township, NJ 08234, between the Black Horse Pike and West Jersey Avenue. That’s minutes from Atlantic City, about 40 minutes from Philadelphia, about 2 hours from New York City and 3 hours from Washington, D.C."),
        ("What are your showroom hours?",
         "We’re open Tuesday through Friday from 9:00 AM to 6:30 PM and Saturday from 9:00 AM to 3:00 PM. We’re closed Sunday and Monday. Can’t make it during those times? Leave us a message or send an email and we’ll follow through."),
        ("Do you buy cars or take trade-ins?",
         "Yes. We take trade-ins, and we buy cars even if you don’t buy one from us. Start with our online appraisal form, or call us at (609) 646-7676 and email photos of your vehicle."),
        ("Do you offer financing?",
         "Yes. We work with banks we have built relationships with over many years, and we work with each customer one-on-one to get the best approval possible. Credit applications can be taken in person, by phone, or by text or email."),
        ("Do your cars come with a warranty?",
         "Most of our cars are sold with a minimum powertrain warranty of 1 month or 1,000 miles. We also offer service contracts through Guardian Warranty Company, which we’ve worked with for over 15 years, customized to each car at the time of sale."),
        ("Can you ship a car to me if I live out of state?",
         "Yes. We can coordinate transportation of your vehicle straight to your front door at a low cost, take credit applications by phone and priority-mail documents to your location."),
        ("Do you export vehicles?",
         "Yes. We’ve exported cars since 2001, including to Canada, France and Australia. We can locate, purchase and ship a car for you and handle the customs and title paperwork. See our International Exports page."),
        ("What if I don’t see the car I’m looking for?",
         "Call (609) 646-7676 or email info@pumpkincars.com and tell us what you want. If it’s not in our inventory, we may be able to find one for you."),
        ("Is the listed price the final price?",
         "The listed price is the vehicle’s sales price. It does not include licensing, registration and taxes. Warranties are quoted separately, at the time of sale, so you only pay for what fits your car."),
        ("Se habla español?",
         "Sí. Hablamos español. Atención personalizada, estamos para ayudarte — desde 1998 cumpliendo sueños."),
    ]


def faq_html():
    return '<div class="faq">' + "".join(
        f'<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in faq_items()) + "</div>"


def faq_schema():
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq_items()]}


def review_card(r, trim=None):
    name, loc, text = r
    if trim and len(text) > trim:
        text = text[:trim].rsplit(" ", 1)[0] + "…"
    return f'''<figure class="review" style="margin:0"><div class="stars" aria-label="5 out of 5 stars">★★★★★</div>
<blockquote>“{esc(text)}”</blockquote><cite>{esc(name)}<span>{esc(loc)}</span></cite></figure>'''


def platforms_html(center=False):
    style = ' style="justify-content:center"' if center else ""
    return f'<div class="platforms"{style}>' + "".join(
        f'<a class="platform" href="{u}" target="_blank" rel="noopener">Read our {n} reviews &rarr;</a>' for n, u in REVIEW_LINKS) + "</div>"


def rating_panel():
    return f'''<div class="panel leather" style="text-align:center;max-width:760px;margin:0 auto"><div class="stars" style="font-size:1.6rem" aria-label="5 out of 5 stars">★★★★★</div>
<h3 style="margin-top:8px">5.0 rating from 550+ customer reviews</h3>
<p>DealerRater Certified Dealer, winner of the Best of the Press Awards and the Cars.com Consumer Satisfaction Award. Read what drivers say on the review sites they trust:</p>{platforms_html(True)}</div>'''


AREAS = ["Atlantic City", "Egg Harbor Township", "Galloway", "Somers Point", "Linwood", "Northfield", "Pleasantville", "Absecon",
         "Margate City", "Ventnor", "Longport", "Ocean City", "Marmora", "Cape May", "Vineland", "Williamstown", "Turnersville",
         "Cherry Hill", "Freehold", "Philadelphia, PA", "New York, NY", "Baltimore, MD", "Manchester, MA", "Peoria, AZ"]


def map_embed(min_h=""):
    st = f' style="min-height:{min_h}"' if min_h else ""
    return f'<iframe title="Map to Pumpkin Fine Cars &amp; Exotics" loading="lazy"{st} referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q={MAPS_Q}&amp;output=embed"></iframe>'


def visit_block():
    return f'''<div class="visit-grid">
  <div class="visit-info">
    <span class="eyebrow">Visit us</span>
    <h2>Come see it in person</h2>
    <p class="info-line">{ICON['pin']}<span>{ADDR1}<br>{ADDR2}<br><small>Between the Black Horse Pike and West Jersey Avenue</small></span></p>
    <p class="info-line">{ICON['phone']}<span><a href="tel:{PHONE_TEL}">{PHONE}</a> &middot; Text <a href="sms:{TEXT_TEL}">{TEXT}</a></span></p>
    <p class="info-line">{ICON['mail']}<span><a href="mailto:{EMAIL}">{EMAIL}</a></span></p>
    <table class="hours" aria-label="Showroom hours"><tbody>{hours_rows()}</tbody></table>
    <a class="btn btn-primary btn-block" href="{DIR_URL}" target="_blank" rel="noopener">Get Directions</a>
  </div>
  <div class="map">{map_embed()}</div>
</div>'''


# ---------------------------------------------------------------- pages
def build_home():
    feats = CARS[:8]
    make_chips = "".join(f'<a class="chip" href="/used-cars-nj.html?make={esc(m)}">{esc(m)} <b>{MAKE_COUNT[m]}</b></a>' for m in MAKES)
    body_chips = "".join(
        f'<a class="chip" href="/used-cars-nj.html?body={b}">{b}s <b>{sum(1 for c in CARS if c["body"] == b)}</b></a>' for b in BODIES)
    make_opts = "".join(f'<option>{esc(m)}</option>' for m in sorted(MAKES))
    body_opts = "".join(f'<option value="{b}">{b}</option>' for b in BODIES)
    prices = "".join(f'<option value="{p}">Under {money(p)}</option>' for p in (15000, 20000, 25000, 30000, 35000, 40000))
    reviews_block = (f'<div class="review-grid">{"".join(review_card(r, 330) for r in REVIEWS[:3])}</div>{platforms_html()}'
                     if REVIEWS else rating_panel())
    car_cards = "".join(car_card(c) for c in feats)
    bodyhtml = f'''
<section class="hero"><div class="container hero-grid">
  <div>
    <span class="eyebrow">Family-owned since 1998 &middot; Egg Harbor Township, NJ</span>
    <h1>Pristine pre-owned cars, <em>hand-picked</em> by a racing champion.</h1>
    <p class="lead">Every car on our showroom floor was bought personally by Franck Freon, then inspected, serviced and detailed before you ever see it. Indoors. No balloons, no gimmicks.</p>
    <form class="search-card" action="/used-cars-nj.html" method="get" aria-label="Search inventory">
      <h2>Find your Pumpkin car</h2>
      <div class="search-form">
        <div class="field"><label for="h-make">Make</label><select id="h-make" name="make"><option value="">All makes</option>{make_opts}</select></div>
        <div class="field"><label for="h-body">Body style</label><select id="h-body" name="body"><option value="">Any</option>{body_opts}</select></div>
        <div class="field"><label for="h-max">Price</label><select id="h-max" name="max"><option value="">Any price</option>{prices}</select></div>
        <button class="btn btn-primary btn-lg" type="submit">Search {len(CARS)} cars</button>
      </div>
    </form>
    <div class="hero-cta">
      <a class="btn btn-outline-light" href="tel:{PHONE_TEL}">{ICON['phone']} {PHONE}</a>
      <a class="btn btn-outline-light" href="/vehicle-appraisal.html">Value your trade</a>
    </div>
  </div>
  <div class="hero-visual">
    <div class="hero-photo"><img src="{HERO_IMG}" width="625" height="468" alt="Inside the Pumpkin Fine Cars indoor showroom in Egg Harbor Township, NJ" fetchpriority="high"></div>
    <div class="badge-float b2"><span class="big">28</span><small>years in<br>business</small></div>
    <div class="badge-float b1"><div><div class="stars" aria-hidden="true">★★★★★</div><strong style="font-size:1.05rem">5.0 on DealerRater</strong><small>Certified Dealer &middot; 550+ reviews</small></div></div>
  </div>
</div></section>

<section class="trust" aria-label="Why customers trust Pumpkin"><div class="container trust-grid">
  <div class="trust-item"><span class="num">5.0</span><span>DealerRater certified dealer rating</span></div>
  <div class="trust-item"><span class="num">550+</span><span>genuine online reviews</span></div>
  <div class="trust-item"><span class="num">1998</span><span>serving South Jersey drivers since</span></div>
  <div class="trust-item"><span class="num">100%</span><span>of our inventory kept indoors, out of the weather</span></div>
</div></section>

<section class="section" id="inventory"><div class="container">
  <div class="row-between">
    <div class="section-head"><span class="eyebrow">Fresh on the floor</span><h2>Featured used cars in South Jersey</h2></div>
    <a class="btn btn-outline" href="/used-cars-nj.html">See all {len(CARS)} vehicles &rarr;</a>
  </div>
  <div class="car-grid">{car_cards}</div>
  <p class="fine" style="margin-top:22px">Price reflects only the vehicle sales price and does not include licensing, registration and taxes.</p>
</div></section>

<section class="section tight white"><div class="container">
  <div class="section-head"><span class="eyebrow">Browse</span><h2>Shop pre-owned by brand or body style</h2>
  <p class="lead">Mercedes-Benz, BMW, Audi, Genesis, Honda, Jeep and more, plus Corvettes, Mustangs and the occasional Porsche or Ferrari. Ask us what’s coming.</p></div>
  <div class="chips" style="margin-bottom:14px">{make_chips}</div>
  <div class="chips">{body_chips}</div>
</div></section>

<section class="section"><div class="container">
  <div class="section-head center"><span class="eyebrow">The Pumpkin difference</span><h2>A boutique experience without the boutique prices</h2>
  <p class="lead">We’re a family business, not a chain. Here’s what that means for you.</p></div>
  <div class="feature-grid">
    <div class="feature"><div class="ico">{ICON['key']}</div><h3>Bought by Franck, personally</h3><p>Every car is purchased by Franck Freon before it hits the floor. He won’t sell a car he wouldn’t drive himself.</p></div>
    <div class="feature"><div class="ico">{ICON['home']}</div><h3>A real indoor showroom</h3><p>Not a car lot. Warm in winter, cool in summer and always dry when it rains, with our whole inventory under one roof.</p></div>
    <div class="feature"><div class="ico">{ICON['wrench']}</div><h3>Serviced and detailed</h3><p>Each vehicle is carefully selected, thoroughly inspected, properly serviced, professionally detailed and presented with pride.</p></div>
    <div class="feature"><div class="ico">{ICON['tag']}</div><h3>Straight-up pricing</h3><p>The price of the vehicle is the price of the vehicle. Warranties are quoted separately, with no hidden costs and no monkey business.</p></div>
    <div class="feature"><div class="ico">{ICON['shield']}</div><h3>Financing &amp; warranties</h3><p>Competitive bank financing worked out one customer at a time, plus service contracts through Guardian Warranty Company.</p></div>
    <div class="feature"><div class="ico">{ICON['truck']}</div><h3>We ship to your door</h3><p>Out of town? We take credit applications by phone, priority-mail documents and coordinate transport to your driveway.</p></div>
  </div>
</div></section>

<section class="section dark"><div class="container split">
  <div>
    <span class="eyebrow">Meet the owner</span>
    <h2>Franck Freon: racing champion turned car guy</h2>
    <p class="lead">Born and raised in Paris, Franck spent 18 years racing around the world at 200 mph on three continents. Today he brings that eye for detail to every car in the showroom.</p>
    <div class="stat-row">
      <div class="stat"><b>24 Hrs</b><span>Winner of the Daytona 24, 2001</span></div>
      <div class="stat"><b>10×</b><span>Consecutive 24 Hours of Le Mans starts</span></div>
      <div class="stat"><b>4</b><span>Le Mans podiums, 2000–2003</span></div>
    </div>
    <ul class="check-list">
      <li>Indy Lights Rookie of the Year (1991)</li>
      <li>Factory driver for GM Corvette Racing</li>
      <li>Founded Pumpkin in 1998</li>
    </ul>
    <a class="btn btn-primary" href="/meet-franck-freon.html">Read Franck’s story</a>
  </div>
  <div class="split-media"><div class="frame"><img src="/images/Podium-Daytona-2001.jpg" width="627" height="411" loading="lazy" alt="The Corvette Racing team on the podium at the 2001 24 Hours of Daytona"></div></div>
</div></section>

<section class="section"><div class="container split">
  <div class="split-media"><div class="frame"><img src="/images/pumpkin-inventory.jpg" width="625" height="355" loading="lazy" alt="Overhead view of the Pumpkin indoor showroom floor"></div></div>
  <div>
    <span class="eyebrow">Our showroom</span>
    <h2>Not a car lot. An indoor showroom.</h2>
    <p class="lead">Since 1998, Franck has kept the entire inventory indoors. You see the car exactly as it is, in good light, without a drop of rain or a blast of August sun.</p>
    <ul class="check-list">
      <li>Open Tuesday through Saturday, 9 to 6:30 (Sat 9 to 3)</li>
      <li>Minutes from Atlantic City, 40 minutes from Philadelphia</li>
      <li>Easy off the Black Horse Pike (Route 40) on English Creek Avenue</li>
    </ul>
    <a class="btn btn-dark" href="/directions-to-indoor-showroom.html">Directions &amp; parking</a>
  </div>
</div></section>

<section class="section tight"><div class="container"><div class="cta-band">
  <div><h2>Sell your car to Pumpkin, even if we don’t sell to you.</h2>
  <p>Fill out a quick appraisal form or call us, then email pictures. We buy cars every week, and we take trade-ins too.</p></div>
  <div class="cta-actions"><a class="btn btn-dark btn-lg" href="/vehicle-appraisal.html">Get my appraisal</a><a class="btn btn-outline btn-lg" href="tel:{PHONE_TEL}">Call {PHONE}</a></div>
</div></div></section>

<section class="section"><div class="container">
  <div class="section-head center"><span class="eyebrow">Buying made simple</span><h2>Financing, warranties &amp; delivery</h2></div>
  <div class="two-up">
    <div class="panel leather"><h3>Financing</h3>
      <p>We’ve built strong relationships with banks over many years, and their rates are competitive and based on the market, your credit and the vehicle you choose. We work with you one-on-one to get the best approval possible.</p>
      <ul class="check-list"><li>Apply in person or over the phone</li><li>Documents can be priority-mailed to you</li><li>Text or email your completed application</li></ul>
      <a class="btn btn-dark" href="/financing-warranties.html">Financing &amp; warranties</a></div>
    <div class="panel"><h3>Sell, ship &amp; export</h3>
      <p>Not local? No problem. We’ve helped customers in New York, Maryland, Massachusetts, Arizona and beyond, and we’ve exported cars to Europe, Asia and Africa since 2001.</p>
      <ul class="check-list"><li>Vehicles shipped to your front door at a low cost</li><li>Exports to Canada, France, Australia and more</li><li>Can’t find it? We may be able to find it for you</li></ul>
      <a class="btn btn-outline" href="/international-exports.html">International exports</a></div>
  </div>
</div></section>

<section class="section white"><div class="container">
  <div class="row-between"><div class="section-head"><span class="eyebrow">What customers say</span><h2>5.0 stars, one car at a time</h2></div>
  <a class="btn btn-outline" href="/customer-testimonials.html">All reviews &rarr;</a></div>
  {reviews_block}
</div></section>

<section class="section"><div class="container">
  <div class="section-head"><span class="eyebrow">Where our customers come from</span><h2>Used cars near Atlantic City and across the Tri-State area</h2>
  <p class="lead">Customers drive in from all over South Jersey, Philadelphia and New York, and some have bought from us from as far as Arizona.</p></div>
  <div class="area-list">{"".join(f"<span>{a}</span>" for a in AREAS)}</div>
</div></section>

<section class="section white"><div class="container">
  <div class="section-head center"><span class="eyebrow">Good to know</span><h2>Frequently asked questions</h2></div>
  {faq_html()}
</div></section>

<section class="section"><div class="container">{visit_block()}</div></section>
'''
    page("index.html",
         "Used Cars Egg Harbor Township NJ | Pumpkin Fine Cars & Exotics",
         "Family-owned used car dealership near Atlantic City, NJ since 1998. Hand-picked Mercedes-Benz, BMW, Audi, Genesis, Honda and Jeep in an indoor showroom. Call (609) 646-7676.",
         bodyhtml, schema=[dealer_schema(), faq_schema(), {"@context": "https://schema.org", "@type": "WebSite", "url": SITE + "/", "name": NAME}])


def build_inventory():
    make_opts = "".join(f'<option>{esc(m)}</option>' for m in sorted(MAKES))
    body_opts = "".join(f'<option value="{b}">{b}</option>' for b in BODIES)
    prices = "".join(f'<option value="{p}">{money(p)}</option>' for p in (15000, 20000, 25000, 30000, 35000, 40000))
    miles = "".join(f'<option value="{m}">{num(m)} mi</option>' for m in (25000, 40000, 60000, 80000))
    item_list = {"@context": "https://schema.org", "@type": "ItemList", "name": "Used cars at Pumpkin Fine Cars & Exotics",
                 "itemListElement": [{"@type": "ListItem", "position": i, "url": SITE + url(c), "name": full(c)} for i, c in enumerate(CARS, 1)]}
    cards = "".join(car_card(c) for c in CARS)
    body = page_hero("Used cars for sale in Egg Harbor Township, NJ",
                     f"{len(CARS)} pristine pre-owned vehicles, all kept inside our showroom. Every one backed by Franck Freon’s expertise and over 28 years of serving South Jersey.",
                     [("Home", "/"), ("Inventory", None)]) + f'''
<section class="section tight"><div class="container">
  <div class="inv-layout">
    <button class="btn btn-dark filter-toggle" type="button" aria-expanded="false" aria-controls="filters">Filter &amp; sort <span id="f-active"></span></button>
    <aside class="filters" id="filters" aria-label="Filter inventory">
      <h2>Filter</h2>
      <div class="field full"><label for="f-q">Search</label><input id="f-q" type="search" placeholder="Make, model, color, stock #" autocomplete="off"></div>
      <div class="field"><label for="f-make">Make</label><select id="f-make"><option value="">All makes</option>{make_opts}</select></div>
      <div class="field"><label for="f-body">Body style</label><select id="f-body"><option value="">Any</option>{body_opts}</select></div>
      <div class="field"><label for="f-max">Max price</label><select id="f-max"><option value="">Any price</option>{prices}</select></div>
      <div class="field"><label for="f-miles">Max mileage</label><select id="f-miles"><option value="">Any mileage</option>{miles}</select></div>
      <div class="field full"><a href="#" id="f-reset" class="btn btn-outline btn-sm btn-block">Reset filters</a></div>
      <div class="notice full"><strong>Don’t see it?</strong> We may be able to find it for you. Call <a href="tel:{PHONE_TEL}">{PHONE}</a>.</div>
    </aside>
    <div>
      <div class="inv-top">
        <span class="inv-count"><span id="inv-count">{len(CARS)} vehicles</span> available</span>
        <div class="field" style="flex-direction:row;align-items:center;gap:10px"><label for="f-sort">Sort by</label>
        <select id="f-sort" style="width:auto"><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="miles">Lowest mileage</option><option value="year">Newest year</option></select></div>
      </div>
      <div class="car-grid" id="inv-grid">{cards}</div>
      <div class="inv-empty" id="inv-empty"><h3>No matches right now</h3><p>Try widening your filters, or tell us what you’re after at <a href="tel:{PHONE_TEL}">{PHONE}</a> and we’ll look for it.</p></div>
      <p class="fine" style="margin-top:26px"><strong>Disclaimer:</strong> Price reflects ONLY the vehicle sales price and DOES NOT include the licensing, registration, and taxes. All information is deemed reliable but not guaranteed. We take trade-ins and offer <a href="/financing-warranties.html">financing and warranties</a> on our vehicles, and we can coordinate transportation straight to your front door.</p>
    </div>
  </div>
</div></section>
'''
    page("used-cars-nj.html",
         "Used Cars for Sale in Egg Harbor Township, NJ | Pumpkin Fine Cars",
         f"Browse {len(CARS)} pristine pre-owned BMW, Mercedes-Benz, Audi, Genesis, Honda, Jeep and more at Pumpkin Fine Cars & Exotics near Atlantic City, NJ. Filter by price, make and mileage.",
         body, active="/used-cars-nj.html", schema=[item_list], og_image=CARS[0]["imgs"][0])


def similar(c):
    others = [o for o in CARS if o is not c]
    others.sort(key=lambda o: (o["body"] != c["body"], abs(o["price"] - c["price"])))
    return others[:3]


def build_vehicle(c):
    t = short(c)
    thumbs = "".join(
        '<button type="button" data-full="%s"%s aria-label="Show photo %d of %d"><img src="%s" width="160" height="107" loading="lazy" alt=""></button>'
        % (src, ' aria-current="true"' if i == 0 else "", i + 1, len(c["imgs"]), src) for i, src in enumerate(c["imgs"]))
    feats = "".join(f"<li>{esc(f)}</li>" for f in c["feat"])
    msrp = f'<tr><th>Original MSRP</th><td>{money(c["msrp"])}</td></tr>' if c.get("msrp") else ""
    sms_body = f"Hi Pumpkin, I'm interested in the {t} (Stock #{c['stock']})".replace(" ", "%20").replace("#", "%23").replace("'", "%27").replace(",", "%2C")
    sims = "".join(car_card(o) for o in similar(c))
    body = page_hero(esc(full(c)), f"{esc(c['ext'])} with {esc(c['intr'])} interior. {num(c['miles'])} miles. Stock #{c['stock']}.",
                     [("Home", "/"), ("Inventory", "/used-cars-nj.html"), (esc(t), None)]) + f'''
<section class="section tight"><div class="container">
  <div class="vdp">
    <div>
      <div class="gallery-main"><img id="gallery-main" src="{c['imgs'][0]}" width="640" height="427" alt="{esc(full(c))} for sale at Pumpkin Fine Cars, Egg Harbor Township NJ" fetchpriority="high"></div>
      <div class="thumbs">{thumbs}</div>
      <p class="fine" style="margin-top:12px">Want more photos or a walk-around video? Call <a href="tel:{PHONE_TEL}">{PHONE}</a> or text {TEXT}.</p>
    </div>
    <aside class="buy-box" aria-label="Pricing and contact">
      <span class="price">{money(c['price'])}</span>
      <p class="sub">Plus licensing, registration and taxes. Stock #{c['stock']} &middot; {num(c['miles'])} miles</p>
      <div class="buy-actions">
        <a class="btn btn-primary btn-lg btn-block" href="tel:{PHONE_TEL}">{ICON['phone']} Call {PHONE}</a>
        <a class="btn btn-dark btn-block" href="sms:{TEXT_TEL}?&amp;body={sms_body}">{ICON['chat']} Text us about this car</a>
        <a class="btn btn-outline btn-block" href="#test-drive">Schedule a test drive</a>
      </div>
      <table class="spec"><tbody>
        <tr><th>Year</th><td>{c['year']}</td></tr>
        <tr><th>Make / Model</th><td>{esc(c['make'])} {esc(c['model'])}</td></tr>
        <tr><th>Trim</th><td>{esc(c['trim'])}</td></tr>
        <tr><th>Mileage</th><td>{num(c['miles'])}</td></tr>
        <tr><th>Exterior</th><td>{esc(c['ext'])}</td></tr>
        <tr><th>Interior</th><td>{esc(c['intr'])}</td></tr>
        <tr><th>Body style</th><td>{c['body']}</td></tr>
        {msrp}
        <tr><th>Stock #</th><td>{c['stock']}</td></tr>
        <tr><th>VIN</th><td>{c['vin']}</td></tr>
      </tbody></table>
    </aside>
  </div>

  <div class="detail-blocks">
    <div style="display:grid;gap:28px">
      <div class="detail-card">
        <h2>About this {esc(t)}</h2>
        <p>{esc(c['blurb'])}</p>
        <h3 style="margin-top:22px">Highlights &amp; equipment</h3>
        <ul class="feat-list">{feats}</ul>
        <p class="fine" style="margin-top:18px">EPA fuel-economy and range figures are estimates for comparison only. Actual mileage and range vary with options, driving conditions, driving habits and vehicle condition. Equipment is listed to the best of our knowledge; please confirm details with us.</p>
      </div>
      <div class="detail-card" id="test-drive">
        <h2>Ask about this car or book a test drive</h2>
        <form name="test-drive" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field">
          <input type="hidden" name="form-name" value="test-drive">
          <input type="hidden" name="vehicle" value="{esc(full(c))}">
          <input type="hidden" name="stock" value="{c['stock']}">
          {honeypot()}
          <div class="form-grid">
            <div class="field"><label for="td-name">Your name</label><input id="td-name" name="name" required autocomplete="name"></div>
            <div class="field"><label for="td-phone">Phone</label><input id="td-phone" name="phone" type="tel" required autocomplete="tel"></div>
            <div class="field full"><label for="td-email">Email</label><input id="td-email" name="email" type="email" autocomplete="email"></div>
            <div class="field full"><label for="td-msg">Message</label><textarea id="td-msg" name="message">I’d like to see the {esc(t)} (Stock #{c['stock']}).</textarea></div>
            <div class="full"><button class="btn btn-primary btn-lg" type="submit">Send message</button></div>
          </div>
          <p class="form-note">We reply during showroom hours (Tue–Fri 9–6:30, Sat 9–3). Your information is never shared.</p>
        </form>
      </div>
    </div>
    <div style="display:grid;gap:28px;align-content:start">
      <div class="detail-card"><h2>Why buy from Pumpkin</h2>
        <ul class="assure">
          <li>{ICON['key']}<span>Personally purchased by Franck Freon, then inspected, serviced and detailed.</span></li>
          <li>{ICON['home']}<span>Kept indoors in our showroom. Come see it in perfect light.</span></li>
          <li>{ICON['shield']}<span>Financing and service contracts available. <a href="/financing-warranties.html">Learn more</a>.</span></li>
          <li>{ICON['truck']}<span>We can coordinate shipping to your front door.</span></li>
          <li>{ICON['tag']}<span>Have a trade? <a href="/vehicle-appraisal.html">Get an appraisal</a>.</span></li>
        </ul></div>
      <div class="detail-card"><h2>Visit us</h2>
        <p class="info-line" style="color:var(--ink)">{ICON['pin']}<span>{ADDR1}<br>{ADDR2}</span></p>
        <p class="info-line" style="color:var(--ink)">{ICON['clock']}<span>Tue–Fri 9:00–6:30<br>Sat 9:00–3:00<br>Closed Sun &amp; Mon</span></p>
        <a class="btn btn-outline btn-block" href="{DIR_URL}" target="_blank" rel="noopener">Get directions</a></div>
    </div>
  </div>
</div></section>

<section class="section white tight"><div class="container">
  <div class="section-head"><span class="eyebrow">You may also like</span><h2>Similar vehicles</h2></div>
  <div class="car-grid">{sims}</div>
</div></section>
'''
    vehicle_ld = {
        "@context": "https://schema.org", "@type": "Car", "name": full(c), "brand": {"@type": "Brand", "name": c["make"]},
        "model": c["model"], "vehicleModelDate": str(c["year"]), "bodyType": c["body"], "color": c["ext"],
        "vehicleInteriorColor": c["intr"], "vehicleIdentificationNumber": c["vin"], "sku": c["stock"],
        "itemCondition": "https://schema.org/UsedCondition", "description": c["blurb"],
        "mileageFromOdometer": {"@type": "QuantitativeValue", "value": c["miles"], "unitCode": "SMI"},
        "image": [SITE + s for s in c["imgs"]],
        "offers": {"@type": "Offer", "price": c["price"], "priceCurrency": "USD", "availability": "https://schema.org/InStock",
                   "url": SITE + url(c), "seller": {"@id": SITE + "/#dealer"}},
    }
    crumbs_ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Inventory", "item": SITE + "/used-cars-nj.html"},
        {"@type": "ListItem", "position": 3, "name": t}]}
    page(f"used-cars-nj/{c['slug']}.html",
         f"{full(c)} for Sale in Egg Harbor Township, NJ | Pumpkin Fine Cars",
         f"{t} {c['trim']}, {num(c['miles'])} miles, {c['ext']}. {money(c['price'])} at Pumpkin Fine Cars in Egg Harbor Township, NJ. Stock #{c['stock']}. Call {PHONE}.",
         body, active="/used-cars-nj.html", schema=[vehicle_ld, crumbs_ld], og_image=c["imgs"][0])


def build_franck():
    tl = [
        ("1986", "Racing begins", "Wins the Winfield Racing School Award and starts racing Formula Renault, Formula 3 and F3000 in Europe."),
        ("1991", "Indy Lights Rookie of the Year", "Moves to the United States and earns the Firestone Indy Lights Rookie of the Year title."),
        ("1992–93", "Two championship runner-up finishes", "Six wins, seven pole positions and 18 podiums in 36 races."),
        ("1994–95", "Indy Car (CART)", "Steps up to Indy Car and takes to Indianapolis Motor Speedway in 1995."),
        ("1996", "Le Mans class win", "Drives for the Mazdaspeed factory team and wins the LMP2 class at the 24 Hours of Le Mans."),
        ("1998", "Pumpkin is born", "Franck starts Pumpkin LLC with a simple goal: high-quality vehicles and genuine, personal care."),
        ("2000–03", "GM Corvette Racing", "Wins Petit Le Mans twice (2000, 2001), wins the 24 Hours of Daytona in 2001 and a GTS class win at the 12 Hours of Sebring. Podiums at Le Mans in 2000, 2001, 2002 and 2003."),
        ("2002", "Olympic torch", "Among the chosen few to carry the Olympic flame through the streets of Philadelphia ahead of the Salt Lake City Winter Games."),
    ]
    tlh = "".join(f'<li><span class="yr">{y}</span><b>{t}</b><p>{d}</p></li>' for y, t, d in tl)
    body = page_hero("Meet Franck Freon", "Racing champion, car guy and the heart of Pumpkin Fine Cars & Exotics.", [("Home", "/"), ("Meet Franck Freon", None)]) + f'''
<section class="section"><div class="container split">
  <div>
    <span class="eyebrow">The owner</span>
    <h2>Born in Paris, raced on three continents, now in Egg Harbor Township</h2>
    <p>Franck Freon was born and raised in Paris, France. He raced professionally for over 18 years all over the world, working his way from European single-seaters to Indy Car, then to the world of endurance racing, where he became a factory driver for General Motors.</p>
    <p>That life taught him what a great car feels like, and what a bad one hides. It’s why Franck buys every car on the Pumpkin floor himself, and why he says he’s test-driven every one of the thousands he’s sold, autographing many of them.</p>
    <p>Choose expertise, right pricing, pristine quality and service nobody else offers. That’s Franck’s promise, and his name is on it.</p>
    <a class="btn btn-primary" href="/used-cars-nj.html">See what Franck picked</a>
  </div>
  <div class="split-media"><div class="frame"><img src="/images/franck-freon-blue-indy-car.jpg" width="627" height="432" alt="Franck Freon sitting on a blue Indy car at Indianapolis Motor Speedway"></div></div>
</div></section>

<section class="section dark"><div class="container">
  <div class="split">
    <div class="split-media"><div class="frame"><img src="/images/24-hours-le-mans-02.jpg" width="627" height="402" loading="lazy" alt="Franck Freon’s race car in the pits at the 24 Hours of Le Mans"></div></div>
    <div>
      <span class="eyebrow">Endurance racing</span>
      <h2>Ten years at Le Mans. A Daytona 24 win.</h2>
      <p class="lead">Franck raced the legendary 24 Hours of Le Mans ten years in a row, then signed with the ultra-successful GM Corvette Racing team, where he won Petit Le Mans twice and the 24 Hours of Daytona in 2001.</p>
      <div class="stat-row">
        <div class="stat"><b>18 yrs</b><span>racing professionally worldwide</span></div>
        <div class="stat"><b>200 mph</b><span>on three continents</span></div>
        <div class="stat"><b>2001</b><span>24 Hours of Daytona winner</span></div>
      </div>
    </div>
  </div>
</div></section>

<section class="section"><div class="container split">
  <div><span class="eyebrow">Career highlights</span><h2>From Formula Renault to the showroom floor</h2><ol class="timeline" style="padding-left:30px">{tlh}</ol></div>
  <div class="split-media"><div class="frame"><img src="/images/trophies-franck-freon-627.jpg" width="627" height="836" loading="lazy" alt="Trophies from Franck Freon’s racing career displayed in the Pumpkin office"></div></div>
</div></section>

<section class="section tight"><div class="container"><div class="cta-band">
  <div><h2>Come say hello. Franck loves talking cars.</h2><p>Stop by the showroom Tuesday through Saturday, or call to talk about what you’re looking for.</p></div>
  <div class="cta-actions"><a class="btn btn-dark btn-lg" href="/contact-us.html">Contact us</a><a class="btn btn-outline btn-lg" href="/directions-to-indoor-showroom.html">Directions</a></div>
</div></div></section>
'''
    person = {"@context": "https://schema.org", "@type": "Person", "name": "Franck Freon", "jobTitle": "Owner, Pumpkin Fine Cars & Exotics",
              "birthPlace": "Paris, France", "worksFor": {"@id": SITE + "/#dealer"},
              "description": "Retired professional race car driver and winner of the 2001 24 Hours of Daytona; founder of Pumpkin Fine Cars & Exotics."}
    page("meet-franck-freon.html", "Meet Franck Freon | Race Car Champion & Owner of Pumpkin Fine Cars",
         "Franck Freon won the 24 Hours of Daytona, raced Le Mans ten years in a row, and founded Pumpkin Fine Cars in 1998. Meet the owner who hand-picks every car.",
         body, active="/meet-franck-freon.html", schema=[person], og_image="/images/franck-freon-blue-indy-car.jpg")


def build_reviews():
    cards = f'<div class="review-mason">{"".join(review_card(r) for r in REVIEWS)}</div>' if REVIEWS else ""
    body = page_hero("Customer testimonials", "Don’t take our word for it. See what Pumpkin customers say.", [("Home", "/"), ("Testimonials", None)]) + f'''
<section class="section"><div class="container">
  <div style="margin-bottom:38px">{rating_panel()}</div>
  {cards}
</div></section>
<section class="section tight"><div class="container"><div class="cta-band">
  <div><h2>Ready to join the Pumpkin family?</h2><p>Browse our current inventory or stop by the showroom.</p></div>
  <div class="cta-actions"><a class="btn btn-dark btn-lg" href="/used-cars-nj.html">Browse inventory</a><a class="btn btn-outline btn-lg" href="tel:{PHONE_TEL}">Call {PHONE}</a></div>
</div></div></section>
'''
    page("customer-testimonials.html", "Customer Reviews & Testimonials | Pumpkin Fine Cars & Exotics NJ",
         "Read what customers say about Pumpkin Fine Cars & Exotics in Egg Harbor Township, NJ: a 5.0-rated, DealerRater Certified family dealership.",
         body, active="/customer-testimonials.html")


def build_appraisal():
    body = page_hero("Sell your car to Pumpkin", "We buy even if you don’t buy. Tell us about your vehicle and we’ll contact you to explain how the process works.", [("Home", "/"), ("Vehicle Appraisal", None)]) + f'''
<section class="section tight"><div class="container">
  <div class="steps" style="margin-bottom:40px">
    <div class="step"><h3>Tell us about it</h3><p>Fill out the form below or call {PHONE}. The VIN, mileage and features help us most.</p></div>
    <div class="step"><h3>Send photos</h3><p>Email pictures of your vehicle to <a href="mailto:{EMAIL}">{EMAIL}</a>, or text them to {TEXT}.</p></div>
    <div class="step"><h3>Hear back from us</h3><p>We’ll contact you to explain the process. Trading in? We can apply your value to one of our cars.</p></div>
  </div>
  <div class="split" style="align-items:start">
    <div class="form-card">
      <h2>Appraise your vehicle</h2>
      <form name="appraisal" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field">
        <input type="hidden" name="form-name" value="appraisal">{honeypot()}
        <fieldset><legend>Contact information</legend><div class="form-grid">
          <div class="field"><label for="a-first">First name</label><input id="a-first" name="first_name" required autocomplete="given-name"></div>
          <div class="field"><label for="a-last">Last name</label><input id="a-last" name="last_name" required autocomplete="family-name"></div>
          <div class="field"><label for="a-phone">Phone</label><input id="a-phone" name="phone" type="tel" required autocomplete="tel"></div>
          <div class="field"><label for="a-email">Email</label><input id="a-email" name="email" type="email" required autocomplete="email"></div>
        </div></fieldset>
        <fieldset style="margin-top:22px"><legend>Vehicle information</legend><div class="form-grid">
          <div class="field full"><label for="a-vin">VIN</label><input id="a-vin" name="vin" maxlength="17" autocapitalize="characters"></div>
          <div class="field"><label for="a-year">Year</label><input id="a-year" name="year" inputmode="numeric" required></div>
          <div class="field"><label for="a-make">Make</label><input id="a-make" name="make" required></div>
          <div class="field"><label for="a-model">Model</label><input id="a-model" name="model" required></div>
          <div class="field"><label for="a-miles">Mileage</label><input id="a-miles" name="mileage" inputmode="numeric"></div>
          <div class="field"><label for="a-color">Color</label><input id="a-color" name="color"></div>
          <div class="field"><label for="a-value">Desired or estimated value</label><input id="a-value" name="desired_value"></div>
          <div class="field full"><label for="a-feat">Features &amp; options</label><textarea id="a-feat" name="features" style="min-height:90px"></textarea></div>
          <div class="field full"><label for="a-msg">Anything else we should know?</label><textarea id="a-msg" name="message" style="min-height:90px"></textarea></div>
          <div class="full"><button class="btn btn-primary btn-lg" type="submit">Request my appraisal</button></div>
        </div></fieldset>
        <p class="form-note">We take your privacy very seriously and will never share this information with anyone except to review your appraisal. Please email photos to {EMAIL}.</p>
      </form>
    </div>
    <div>
      <span class="eyebrow">Why sell to Pumpkin</span>
      <h2>A fair offer from someone who actually knows cars</h2>
      <p class="lead">Franck has been buying cars for nearly three decades. He can see what your car is really worth, and he’ll tell you straight.</p>
      <ul class="check-list"><li>We buy cars even if you don’t buy one from us</li><li>Trade-ins welcome on any vehicle in our inventory</li><li>Friendly, pressure-free, family-owned</li><li>Located minutes from Atlantic City in Egg Harbor Township</li></ul>
      <div class="frame"><img src="{HERO_IMG}" width="625" height="468" loading="lazy" alt="Inside the Pumpkin indoor showroom, where your trade-in could end up"></div>
    </div>
  </div>
</div></section>
'''
    page("vehicle-appraisal.html", "Sell Your Car in South Jersey | Free Vehicle Appraisal | Pumpkin Cars",
         "Sell or trade your car at Pumpkin Fine Cars in Egg Harbor Township, NJ. We buy even if you don’t buy. Request a vehicle appraisal online or call (609) 646-7676.",
         body, active="/vehicle-appraisal.html")


def build_financing():
    opts = "".join(f'<option>{esc(full(c))} (#{c["stock"]})</option>' for c in CARS)
    body = page_hero("Financing & warranties", "Straightforward financing and service contracts, explained by people who aren’t trying to upsell you.", [("Home", "/"), ("Financing & Warranties", None)]) + f'''
<section class="section"><div class="container">
  <div class="two-up">
    <div class="panel"><span class="eyebrow">Financing</span><h2>Competitive rates, worked out one customer at a time</h2>
      <p>We’ve developed very good relationships with the banks we’ve worked with over many years. Rates are competitive and based on the market, your credit history and the vehicle you choose. We work hard with each customer on a one-by-one basis toward the best approval possible for you.</p>
      <h3>Ways to apply</h3>
      <ul class="check-list"><li>Stop by the showroom to submit a credit application in person</li><li>Call us at <a href="tel:{PHONE_TEL}">{PHONE}</a> to apply over the phone</li><li>Text or email a completed application to {TEXT} or <a href="mailto:{EMAIL}">{EMAIL}</a></li></ul>
      <p class="fine">For your security, please don’t send Social Security numbers through the website form. We’ll collect them by phone or in person.</p></div>
    <div class="panel leather"><span class="eyebrow">Service contracts</span><h2>Warranties built around your car</h2>
      <p>Most Pumpkin cars are sold with a minimum powertrain warranty of 1 month or 1,000 miles. We also offer service contracts that fit the needs of each customer and vehicle.</p>
      <p>We’ve worked with <strong>Guardian Warranty Company</strong> for over 15 years, and our customers have nothing but great things to say about their plans.</p>
      <p>We don’t pre-package a warranty into the price of the car. Every car needs a different plan, so we customize it at the time of sale and we’re always upfront about cost. The price of the vehicle is the price of the vehicle. No hidden costs.</p></div>
  </div>
</div></section>
<section class="section white"><div class="container split" style="align-items:start">
  <div><span class="eyebrow">Get started</span><h2>Start a financing conversation</h2>
  <p class="lead">Tell us which car you’re interested in and the best way to reach you. A real person from our team will call you back.</p>
  <ul class="check-list"><li>No pressure and no obligation</li><li>Out-of-state buyers welcome: applications by phone, documents priority-mailed</li><li>We can coordinate transport to your door</li></ul></div>
  <div class="form-card"><form name="financing" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field">
    <input type="hidden" name="form-name" value="financing">{honeypot()}
    <div class="form-grid">
      <div class="field"><label for="fi-name">Your name</label><input id="fi-name" name="name" required autocomplete="name"></div>
      <div class="field"><label for="fi-phone">Phone</label><input id="fi-phone" name="phone" type="tel" required autocomplete="tel"></div>
      <div class="field full"><label for="fi-email">Email</label><input id="fi-email" name="email" type="email" autocomplete="email"></div>
      <div class="field full"><label for="fi-car">Vehicle of interest</label><select id="fi-car" name="vehicle"><option>Not sure yet</option>{opts}</select></div>
      <div class="field full"><label for="fi-msg">Message</label><textarea id="fi-msg" name="message" style="min-height:90px"></textarea></div>
      <div class="full"><button class="btn btn-primary btn-lg" type="submit">Request a call back</button></div>
    </div></form></div>
</div></section>
'''
    page("financing-warranties.html", "Used Car Financing & Extended Warranties | Pumpkin Fine Cars NJ",
         "Competitive bank financing and Guardian Warranty service contracts at Pumpkin Fine Cars in Egg Harbor Township, NJ. Apply in person, by phone or by text.",
         body, active="/financing-warranties.html")


def build_contact():
    body = page_hero("Contact Pumpkin Fine Cars", "Call, text, email or stop by. We’ll gladly follow through, in typical Pumpkin fashion.", [("Home", "/"), ("Contact Us", None)]) + f'''
<section class="section"><div class="container split" style="align-items:start">
  <div class="form-card"><h2>Send us a message</h2>
    <form name="contact" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field">
      <input type="hidden" name="form-name" value="contact">{honeypot()}
      <div class="form-grid">
        <div class="field"><label for="c-name">Your name</label><input id="c-name" name="name" required autocomplete="name"></div>
        <div class="field"><label for="c-phone">Phone</label><input id="c-phone" name="phone" type="tel" autocomplete="tel"></div>
        <div class="field full"><label for="c-email">Email</label><input id="c-email" name="email" type="email" required autocomplete="email"></div>
        <div class="field full"><label for="c-msg">How can we help?</label><textarea id="c-msg" name="message" required></textarea></div>
        <div class="full"><button class="btn btn-primary btn-lg" type="submit">Send message</button></div>
      </div>
      <p class="form-note">Looking for something specific? Tell us the make, model and budget and we may be able to find it for you.</p>
    </form></div>
  <div style="display:grid;gap:22px">
    <div class="panel"><h3>The showroom</h3>
      <p class="info-line" style="color:var(--ink)">{ICON['pin']}<span>{ADDR1}<br>{ADDR2}</span></p>
      <p class="info-line" style="color:var(--ink)">{ICON['phone']}<span>Call <a href="tel:{PHONE_TEL}">{PHONE}</a><br>Text <a href="sms:{TEXT_TEL}">{TEXT}</a></span></p>
      <p class="info-line" style="color:var(--ink)">{ICON['mail']}<span><a href="mailto:{EMAIL}">{EMAIL}</a></span></p>
      <p class="info-line" style="color:var(--ink)">{ICON['flag']}<span>Hablamos Español. Atención personalizada.</span></p></div>
    <div class="panel" style="background:var(--ink);color:#fff;border:0"><h3 style="color:#fff">Hours</h3><table class="hours" aria-label="Showroom hours"><tbody>{hours_rows()}</tbody></table></div>
  </div>
</div></section>
<section class="section tight"><div class="container"><div class="map" style="min-height:420px">{map_embed("420px")}</div></div></section>
'''
    page("contact-us.html", "Contact Pumpkin Fine Cars & Exotics | Egg Harbor Township, NJ",
         "Call (609) 646-7676, text (609) 604-6057 or visit 3084 English Creek Ave, Egg Harbor Township, NJ. Open Tuesday through Saturday.",
         body, active="/contact-us.html", schema=[dealer_schema()])


def build_directions():
    body = page_hero("Directions to our indoor showroom", "Minutes from Atlantic City, 40 minutes from Philadelphia, about 2 hours from New York City and 3 hours from Washington, D.C.", [("Home", "/"), ("Directions", None)]) + f'''
<section class="section"><div class="container split" style="align-items:start">
  <div>
    <span class="eyebrow">{ADDR1}, {ADDR2}</span>
    <h2>Just off the Black Horse Pike</h2>
    <p>We’re conveniently located just off the Black Horse Pike (Route 40) on English Creek Avenue, between the Pike and West Jersey Avenue.</p>
    <div class="panel" style="margin:20px 0"><h3>From Atlantic City (traveling east on the Pike)</h3><p style="margin:0">Make a right on English Creek at the intersection with the English Creek Shopping Center (ShopRite).</p></div>
    <div class="panel" style="margin:20px 0"><h3>From Philadelphia (traveling west on the Pike)</h3><p style="margin:0">Make a left at the intersection just past Auto Lenders onto English Creek.</p></div>
    <div class="panel" style="margin:20px 0"><h3>From the south (Cape May, Ocean City, Linwood, Northfield, Somers Point)</h3><p style="margin:0">Take Garden State Parkway Exit 29 to U.S. 9 North toward Somers Point. After 3.3 miles, turn left onto Ocean Heights Avenue (CVS on your left, Wawa on your right). Continue 4.8 miles, and just past Mill Road turn right onto English Creek Avenue (County Rd 575). Drive 2.5 miles. Shortly after the traffic light at West Jersey Avenue (CVS on your left), we’re on your right.</p></div>
    <p class="notice"><strong>Not a car lot.</strong> We’re an indoor showroom, warm in the winter, cool in the summer and always dry when it’s raining. Lost? Call us at <a href="tel:{PHONE_TEL}">{PHONE}</a>.</p>
    <p style="margin-top:22px"><a class="btn btn-primary" href="{DIR_URL}" target="_blank" rel="noopener">Open in Google Maps</a></p>
  </div>
  <div style="display:grid;gap:22px"><div class="map" style="min-height:420px">{map_embed("420px")}</div>
  <div class="frame"><img src="{HERO_IMG}" width="625" height="468" loading="lazy" alt="Inside the Pumpkin indoor showroom"></div></div>
</div></section>
'''
    page("directions-to-indoor-showroom.html", "Directions to Pumpkin Fine Cars | 3084 English Creek Ave, Egg Harbor Twp NJ",
         "Driving directions to Pumpkin Fine Cars & Exotics, 3084 English Creek Avenue, Egg Harbor Township, NJ, just off the Black Horse Pike near Atlantic City.",
         body, schema=[dealer_schema()])


def build_exports():
    globe = ICON['globe'].replace('<svg', '<svg style="width:22px;height:22px;vertical-align:-4px;margin-right:6px;color:var(--orange-d)"')
    body = page_hero("International exports", "We can locate and export your car right to your front door, anywhere in the world.", [("Home", "/"), ("International Exports", None)]) + f'''
<section class="section"><div class="container split" style="align-items:start">
  <div>
    <span class="eyebrow">Trust · Expertise · Professionalism · Honesty</span>
    <h2>Exporting since 2001</h2>
    <p>Franck Freon spent 18 years traveling the world as a professional race car driver, racing and living in countries like France, Japan, the USA, Germany and Spain. It was a natural step to start exporting cars from the US. The first one left our showroom in 2001.</p>
    <p>Because Franck was born and raised in Paris, exporting to France came easily. With the European community growing, Germany became another hub. We’re very familiar shipping vehicles to Bremerhaven, Germany; Antwerp, Belgium; Le Havre, France; and more. If you buy from us, we also export to other countries like Canada, France and Australia.</p>
    <p>If you’re in Europe, Asia or Africa, we can locate your car, purchase it, find the right transportation company, and manage all the customs and title documents. Our administrative staff is highly qualified, dedicated and efficient with the paperwork.</p>
    <a class="btn btn-primary btn-lg" href="/contact-us.html">Ask about an export</a>
  </div>
  <div class="panel leather"><h3>What we handle</h3>
    <ul class="check-list">
      <li>Locating the right vehicle for you</li><li>Purchasing and inspecting it</li><li>Finding and booking the right shipper</li><li>Customs and title documents</li><li>Exotic and regular cars, carefully selected</li>
    </ul>
    <p style="margin:0">{globe} Customers from all over the world trust us. Our main asset is our integrity.</p></div>
</div></section>
'''
    page("international-exports.html", "International Car Exports from New Jersey | Pumpkin Fine Cars",
         "Pumpkin Fine Cars & Exotics has exported cars from New Jersey to Europe, Asia, Africa, Canada and Australia since 2001. We locate, buy, ship and handle the paperwork.",
         body)


def build_thanks():
    body = f'''<section class="section"><div class="container narrow" style="text-align:center">
  <span class="eyebrow">Message received</span><h1>Thank you!</h1>
  <p class="lead">Someone from the Pumpkin team will get back to you during showroom hours (Tue–Fri 9–6:30, Sat 9–3). In a hurry? Call <a href="tel:{PHONE_TEL}">{PHONE}</a>.</p>
  <p><a class="btn btn-primary btn-lg" href="/used-cars-nj.html">Keep browsing inventory</a></p>
</div></section>'''
    page("thanks.html", "Thank You | Pumpkin Fine Cars & Exotics", "Thanks for contacting Pumpkin Fine Cars & Exotics.", body, noindex=True)


def build_404():
    body = '''<section class="section"><div class="container narrow" style="text-align:center">
  <span class="eyebrow">Error 404</span><h1>That page took a wrong turn.</h1>
  <p class="lead">The page you’re looking for isn’t here. If you were after a specific car it may have found a new owner.</p>
  <p><a class="btn btn-primary btn-lg" href="/used-cars-nj.html">See current inventory</a> <a class="btn btn-outline btn-lg" href="/">Home</a></p>
</div></section>'''
    page("404.html", "Page Not Found | Pumpkin Fine Cars & Exotics", "Page not found.", body, noindex=True)


def build_seo_files():
    paths = ["/", "/used-cars-nj.html", "/meet-franck-freon.html", "/customer-testimonials.html",
             "/vehicle-appraisal.html", "/financing-warranties.html", "/contact-us.html", "/directions-to-indoor-showroom.html",
             "/international-exports.html"] + [url(c) for c in CARS]
    urls = "".join(f"  <url><loc>{SITE}{p}</loc></url>\n" for p in paths)
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n')
    with open(os.path.join(ROOT, "robots.txt"), "w", newline="\n") as fh:
        fh.write(f"User-agent: *\nAllow: /\nDisallow: /thanks.html\n\nSitemap: {SITE}/sitemap.xml\n")


if __name__ == "__main__":
    build_home(); build_inventory()
    for car in CARS:
        build_vehicle(car)
    build_franck(); build_reviews(); build_appraisal(); build_financing()
    build_contact(); build_directions(); build_exports(); build_thanks(); build_404(); build_seo_files()
    print("built", 9 + len(CARS) + 2, "pages")
