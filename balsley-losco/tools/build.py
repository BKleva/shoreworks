# -*- coding: utf-8 -*-
"""Build the Balsley Losco static site into ./public  —  python tools/build.py"""
import datetime, json, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

TODAY = datetime.date.today().isoformat()
ISLAND = {"ventnor", "margate", "brigantine", "ocean-city"}
SP_OFFICE = {"somers-point", "ocean-city", "linwood", "margate"}

def pick_listings(n):
    """Showcase picks: highest-priced for-sale listing per town, then fill."""
    sale = sorted([x for x in LISTINGS if x["type"] != "Rental" and x["img"] and x["town"]], key=lambda x: -x["price"])
    out, seen = [], set()
    for x in sale:
        if x["town"] not in seen and x["price"] < 4000000: out.append(x); seen.add(x["town"])
        if len(out) >= n: break
    for x in sale:
        if len(out) >= n: break
        if x not in out and x["price"] < 4000000: out.append(x)
    return out

def clean():
    for d in ("assets/img",):
        shutil.rmtree(os.path.join(OUT, d), ignore_errors=True)
    for name in os.listdir(OUT):
        p = os.path.join(OUT, name)
        if name == "assets": continue
        shutil.rmtree(p, ignore_errors=True) if os.path.isdir(p) else os.remove(p)
    for sub in ("assets/img",):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)

# ------------------------------------------------------------------ art + static files
def build_art():
    img = os.path.join(OUT, "assets", "img")
    open(os.path.join(img, "placeholder.svg"), "w", encoding="utf-8").write(scene(11, 18, "gable", False, label="Photo coming soon"))
    tk = {"northfield": "suburb", "linwood": "suburb", "egg-harbor-township": "suburb", "hamilton-township": "farm", "galloway": "farm", "ventnor": "beach",
          "hammonton": "farm", "somers-point": "bay", "margate": "beach", "absecon": "suburb", "brigantine": "beach", "ocean-city": "beach"}
    for i, t in enumerate(TOWNS):
        open(os.path.join(img, f"t-{t['slug']}.svg"), "w", encoding="utf-8").write(landscape(i * 11 + 5, t["hue"], tk[t["slug"]], f"Illustration of {t['name']}, NJ"))
    for i, a in enumerate(ARTICLES):
        open(os.path.join(img, f"a-{a['slug']}.svg"), "w", encoding="utf-8").write(landscape(i * 13 + 2, a["hue"], ["suburb", "beach", "farm", "bay"][i % 4], a["title"]))
    shutil.copy(os.path.join(ROOT, "tools", "brand", "logo-bl.png"), os.path.join(img, "logo-bl.png"))
    open(os.path.join(img, "logo.svg"), "w", encoding="utf-8").write(logo(128).replace('class="brand-mark" ', '').replace('aria-hidden="true"', 'role="img" aria-label="Balsley Losco Real Estate"'))
    open(os.path.join(OUT, "favicon.svg"), "w", encoding="utf-8").write(logo(64).replace('class="brand-mark" ', ''))
    og(os.path.join(img, "og-default.png"))

def og(path):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception:
        return
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), "#a8192a")
    d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(111 + 99 * t), int(15 + 52 * t), int(24 + 23 * t)))
    d.ellipse([880, 70, 1080, 270], fill=(242, 182, 50))
    d.polygon([(0, 560), (300, 520), (600, 565), (900, 520), (1200, 560), (1200, 630), (0, 630)], fill=(255, 255, 255))
    def f(n, bold=True):
        for p in (r"C:\Windows\Fonts\georgiab.ttf" if bold else r"C:\Windows\Fonts\georgia.ttf", r"C:\Windows\Fonts\arialbd.ttf"):
            try: return ImageFont.truetype(p, n)
            except Exception: pass
        return ImageFont.load_default()
    d.ellipse([70, 70, 190, 190], fill=(242, 182, 50)); d.ellipse([80, 80, 180, 180], fill=(200, 32, 47))
    d.text((130, 135), "BL", font=f(48), fill="white", anchor="mm")
    d.text((70, 250), "Balsley Losco", font=f(88), fill="white")
    d.text((70, 360), "Real Estate", font=f(88), fill=(242, 182, 50))
    d.text((70, 480), "Homes for sale in Atlantic & Cape May Counties, NJ  ·  Since 1954", font=f(30, False), fill=(255, 231, 213))
    im.save(path, optimize=True)

# ------------------------------------------------------------------ pages
def town_photo(t):
    ls = [x for x in LISTINGS if x["town"] == t["slug"] and x["img"] and x["type"] != "Rental"]
    ls = [x for x in ls if x["price"] < 4000000] or ls
    if not ls: return None
    ls.sort(key=lambda x: -x["price"])
    return ls[min(1, len(ls) - 1)]["img"]

def tile(t, big=False):
    n = sum(1 for x in LISTINGS if x["town"] == t["slug"] and x["type"] != "Rental")
    ph = town_photo(t)
    img = (f'<img src="{E(ph)}" alt="Homes for sale in {E(t["name"])}, NJ" width="800" height="600" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=&#39;/assets/img/t-{t["slug"]}.svg&#39;">'
           if ph else f'<img src="/assets/img/t-{t["slug"]}.svg" alt="Homes for sale in {E(t["name"])}, NJ" width="800" height="500" loading="lazy">')
    return f'<a class="tile{" big" if big else ""}" href="/homes-for-sale/{t["slug"]}/">{img}<span class="tl"><b>{E(t["name"])}</b><small>{n} homes for sale</small></span></a>'

def head(eyebrow, title, lead="", btn=""):
    return f'<div class="sec-head"><div><span class="eyebrow">{eyebrow}</span><h2>{title}</h2>{f"<p class=lead>{lead}</p>" if lead else ""}</div>{btn}</div>'

def home():
    sel = lambda n, opts: "".join(f'<option value="{v}">{t}</option>' for v, t in opts)
    search = f'''<form class="searchbox" action="/search/" method="get" role="search" aria-label="Search homes">
<div class="f"><label for="hq">Where</label><input id="hq" name="q" placeholder="Town, ZIP or address" autocomplete="off" list="towns"><datalist id="towns">{"".join(f'<option value="{E(t["name"])}">' for t in TOWNS)}</datalist></div>
<div class="f"><label for="ht">Type</label><select id="ht" name="type"><option value="">All homes</option><option>Single Family</option><option>Condo</option><option>Townhouse</option><option>Multi-Family</option><option value="Rental">Rentals</option></select></div>
<div class="f"><label for="hm">Max price</label><select id="hm" name="max"><option value="">No max</option>{sel(0,[(300000,"$300,000"),(500000,"$500,000"),(750000,"$750,000"),(1000000,"$1,000,000"),(2000000,"$2,000,000")])}</select></div>
<div class="f"><label for="hb">Beds</label><select id="hb" name="beds"><option value="">Any</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option></select></div>
<button class="btn" type="submit">Search</button></form>'''
    picks = pick_listings(12)
    hl = picks[:6]
    slides = "".join(f'<div class="slide{" on" if i == 0 else ""}"><img src="{E(l["img"])}" alt="{E(l["title"])} — {E(l["addr"])}, {E(town_of(l)["name"])}, NJ" width="1200" height="800"{"" if i == 0 else " loading=lazy"} referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=&#39;/assets/img/placeholder.svg&#39;"></div>' for i, l in enumerate(hl))
    floats = "".join(f'<a class="float{" on" if i == 0 else ""}" href="/listing/{l["slug"]}/"><b>{lprice(l)}</b><span>{E(l["addr"])} · {E(town_of(l)["name"])}</span></a>' for i, l in enumerate(hl))
    dots = "".join(f'<button type="button" aria-label="Show home {i+1} of {len(hl)}"{" aria-current=true" if i == 0 else ""}></button>' for i in range(len(hl)))
    wave = '<svg class="wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70 C240 10 480 110 760 70 S1200 20 1440 80 V120 H0Z" fill="#fff" opacity=".55"/><path d="M0 90 C260 40 520 120 800 86 S1240 50 1440 96 V120 H0Z" fill="#fff"/></svg>'
    hero = f'''<section class="hero home"><div class="hero-bg" data-rotator role="region" aria-roledescription="carousel" aria-label="Featured homes">{slides}<div class="hero-ov"></div><div class="rot-ui">{floats}<div class="dots">{dots}</div></div></div>
<div class="wrap hero-c"><span class="eyebrow">Atlantic &amp; Cape May Counties, NJ</span><h1>Find your place on the Jersey Shore.</h1>
<p class="lead">Search homes, condos and land for sale from Northfield to Ocean City — backed by a locally owned team that has helped neighbors move since {FOUNDED}.</p>{search}</div>{wave}</section>
<div class="wrap adv"><a class="btn" href="/search/">Advanced search options</a></div>'''
    featured = "".join(lcard(l) for l in picks[6:12])
    feat_slugs = ["linwood", "northfield", "somers-point", "margate", "ventnor", "egg-harbor-township", "galloway"]
    tiles = "".join(tile(TOWN[s], big=i < 3) for i, s in enumerate(feat_slugs))
    groups = [("Island &amp; Beach Communities", "Boardwalks, beaches and walkable shore living on the barrier islands.", ["ventnor", "margate", "brigantine", "ocean-city"]),
              ("Bayfront &amp; Mainland Living", "Established neighborhoods close to the bay, the Parkway and the island beaches.", ["somers-point", "linwood", "northfield", "absecon"]),
              ("Space, Value &amp; Small-Town Charm", "More room to grow, newer construction and country character.", ["egg-harbor-township", "galloway", "hamilton-township", "hammonton"])]
    ghtml = "".join(f'<div class="cgroup"><span class="eyebrow dark">{g}</span><p class="lead">{d}</p><div class="grid g4">' + "".join(f'<a class="ccard" href="/homes-for-sale/{s}/"><h3>{E(TOWN[s]["name"])}</h3><p>{E(TOWN[s]["tagline"])}</p><span>Explore homes →</span></a>' for s in sl) + '</div></div>' for g, d, sl in groups)
    learn_img = E(picks[2]["img"]) if len(picks) > 2 else ""
    ag = "".join(acard(a) for a in [x for x in AGENTS if x["photo"]][:6:])
    art = "".join(f'<a class="card arcard" href="/guides/{a["slug"]}/"><div class="img"><img src="/assets/img/a-{a["slug"]}.svg" alt="" width="800" height="500" loading="lazy"></div><div class="body"><div class="meta">{a["read"]} min read</div><h3>{E(a["title"])}</h3></div></a>' for a in ARTICLES[:3])
    main = f'''<section class="sec"><div class="wrap">{head("Explore Atlantic &amp; Cape May Counties", "Featured Communities", "Find your place across the Jersey Shore with curated area searches for island beaches, bayfront neighborhoods, and mainland communities.")}
<div class="tiles">{tiles}</div></div></section>
<section class="sec tint"><div class="wrap">{head("Fresh on the market", "Featured Homes for Sale", "A look at current Balsley Losco listings across the region.", '<a class="btn" href="/search/">See all homes</a>')}
<div class="grid g3">{featured}</div><p class="note" style="margin-top:22px">Listings are a snapshot from the Balsley Losco website (October 2026). The live MLS/IDX feed keeps them current at launch.</p></div></section>
<section class="learn" style="background-image:url('{learn_img}')"><div class="learn-ov"></div><a class="learn-card" href="/homes-for-sale/">Learn about Atlantic &amp; Cape May Counties</a></section>
<section class="sec"><div class="wrap">{head("Proudly serving the Jersey Shore", "Explore Local Communities", "Learn more about the neighborhoods, lifestyles, and local highlights throughout Atlantic and Cape May Counties so you can find the community that feels like home.")}{ghtml}</div></section>
<section class="sec sea"><div class="wrap"><div class="band"><div><span class="eyebrow">Thinking of selling?</span><h2>What's your home worth today?</h2><p>Get a free, no-obligation valuation from a local agent who knows your street — not just an algorithm.</p><a class="btn" href="/sell/home-value/">Get my free home value</a></div>
<div class="panel" style="color:var(--ink)"><h3>Instant listing alerts</h3><p class="muted">New listings and price drops straight to your inbox.</p>{form("alerts-home", field("Email", "email", "email", True, "you@email.com", "email") + '<div><label for="am">Looking in</label><select id="am" name="area">' + "".join(f"<option>{E(t['name'])}</option>" for t in TOWNS) + '</select></div>', "Send me alerts", consent=False)}</div></div></div></section>
<section class="sec"><div class="wrap">{head("Meet the team", "Local Agents Who Know the Neighborhood", "", f'<a class="btn" href="/agents/">All {len(AGENTS)} agents</a>')}<div class="grid g6">{ag}</div></div></section>
<section class="sec tint"><div class="wrap">{head("Guides", "Buyer &amp; Seller Resources", "", '<a class="btn" href="/guides/">All guides</a>')}<div class="grid g3">{art}</div></div></section>
<section class="sec"><div class="wrap narrow">{head("FAQ", "Questions Home Buyers Ask Us")}{faq_html(FAQ_HOME)}</div></section>'''
    sch = [faq_schema(FAQ_HOME)]
    return layout("Homes for Sale in Atlantic & Cape May County NJ", "Search homes for sale in Northfield, Linwood, Somers Point, Margate, Ventnor and more. Balsley Losco Real Estate — locally owned since 1954. Free home valuation and listing alerts.", "/", main, schema=sch, hero=hero, prio="1.0", freq="daily", home=True)

def search_page():
    main = '<h1 class="sr">Search homes for sale in Atlantic &amp; Cape May Counties, NJ</h1>' + maplist(LISTINGS, "homes for sale", full=True, center=(39.40, -74.56), zoom=11)
    seo = ('<section class="sec tint"><div class="wrap prose"><h2>Homes for sale in Atlantic &amp; Cape May Counties</h2><p>Search every active listing from Northfield, Linwood and Somers Point to Margate, Ventnor, Brigantine and Ocean City. '
           'Use the map to explore neighborhoods, filter by price, bedrooms and home type, and save your search to get alerts when new homes hit the market. '
           'Looking in a specific town? Browse our <a href="/homes-for-sale/">local area guides</a>, or <a href="/contact/">talk to an agent</a>.</p></div></section>')
    return layout("Search Homes for Sale in Atlantic County NJ", "Search homes, condos, townhomes and rentals for sale in Atlantic and Cape May Counties, NJ on an interactive map. Filter by price, beds, baths and more.", "/search/", main + seo, active="Buy", prio="0.9", freq="daily", schema=[crumb_schema([("Home", "/"), ("Search", "/search/")])], bare=True, maps=True)

def itemlist(ls, name):
    return {"@context": "https://schema.org", "@type": "ItemList", "name": name, "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": f"{SITE_URL}/listing/{l['slug']}/", "name": f"{l['addr']}, {town_of(l)['name']}, NJ"} for i, l in enumerate(ls)]}

def town_page(t):
    ls = [l for l in LISTINGS if l["town"] == t["slug"]]
    flood = (f"Much of {t['name']} is within a mapped FEMA flood zone, so flood insurance is common and often required with a mortgage. Ask for the property's flood zone, elevation certificate and an insurance quote before you make an offer."
             if t["slug"] in ISLAND else f"Some properties in {t['name']} may be in FEMA-mapped flood zones, especially near the water. Check the flood zone for any specific address and request an insurance quote before you make an offer.")
    office = OFFICES[1] if t["slug"] in SP_OFFICE else OFFICES[0]
    faqs = [
        (f"What is it like to live in {t['name']}, NJ?", t["intro"][0]),
        (f"How do I find homes for sale in {t['name']}, NJ?", f"Use our search to filter {t['name']} homes by price, bedrooms and property type, or create a free account to receive instant alerts when new {t['name']} listings and price reductions hit the market. A Balsley Losco agent can also tell you about homes before they are widely advertised."),
        (f"Do I need flood insurance in {t['name']}?", flood),
        (f"Which Balsley Losco office serves {t['name']}?", f"Both of our offices serve {t['name']}. The closest is our {office['city']} office at {office['street']}, {office['city']}, NJ {office['zip']}, phone {office['phone']}."),
    ]
    cards = "".join(lcard(l) for l in ls) if ls else f'<p class="muted">No demo listings in {E(t["name"])} yet. <a href="/search/?q={E(t["name"])}">Search all {E(t["name"])} homes</a>.</p>'
    nearby = "".join(f'<a class="chip dk" href="/homes-for-sale/{n}/">Homes in {E(TOWN[n]["name"])}</a>' for n in t["nearby"])
    hl = "".join(f"<li>{E(h)}</li>" for h in t["highlights"])
    bf = "".join(f'<span class="chip dk">{E(b)}</span> ' for b in t["best_for"])
    cr = [("Home", "/"), ("Areas", "/homes-for-sale/"), (t["name"], f"/homes-for-sale/{t['slug']}/")]
    main = f'''<section class="sec" style="padding:30px 0 50px"><div class="wrap">{maplist(ls, f"homes for sale in {t['name']}", center=(t['lat'], t['lng']), zoom=13)}</div></section>
<section class="sec tint"><div class="wrap"><div class="cols2"><div><span class="eyebrow">About {E(t["name"])}</span><h2>Living in {E(t["name"])}, NJ {t["zip"]}</h2>{"".join(f"<p>{E(p)}</p>" for p in t["intro"])}<p><b>Best for:</b> {bf}</p></div>
<div class="panel"><h3>Why buyers choose {E(t["name"])}</h3><ul class="checks">{hl}</ul><a class="btn" href="/contact/?topic=buying&amp;town={E(t["name"])}">Talk to a {E(t["name"])} agent</a></div></div></div></section>
<section class="sec"><div class="wrap narrow"><span class="eyebrow">{E(t["name"])} FAQ</span><h2>Buying a home in {E(t["name"])}</h2>{faq_html(faqs)}
<h3 style="margin-top:36px">Explore nearby</h3><div style="display:flex;gap:10px;flex-wrap:wrap">{nearby}<a class="chip dk" href="/homes-for-sale/">All areas</a></div>
<p style="margin-top:28px">New to the process? Read our <a href="/guides/how-to-buy-a-home-in-atlantic-county-nj/">9-step guide to buying a home in Atlantic County</a>, then <a href="/buy/mortgage-calculator/">estimate your monthly payment</a>.</p></div></section>
<section class="sec sea"><div class="wrap"><div class="band"><div><h2>Get {E(t["name"])} listing alerts</h2><p>Be the first to hear about new homes and price changes in {E(t["name"])}.</p></div><div class="panel" style="color:var(--ink)">{form("alerts-town", field("Email", "email", "email", True, "you@email.com", "email"), "Alert me", hidden={"town": t["name"]}, consent=False)}</div></div></div></section>'''
    hero = page_hero(f"Homes for Sale in {E(t['name'])}, NJ", E(t["tagline"]), cr, "Atlantic County" if t["county"] == "Atlantic" else "Cape May County")
    place = {"@context": "https://schema.org", "@type": "Place", "name": f"{t['name']}, NJ", "geo": {"@type": "GeoCoordinates", "latitude": t["lat"], "longitude": t["lng"]}, "containedInPlace": {"@type": "AdministrativeArea", "name": f"{t['county']} County, NJ"}}
    sch = [crumb_schema(cr), faq_schema(faqs), place] + ([itemlist(ls, f"Homes for sale in {t['name']}, NJ")] if ls else [])
    return layout(f"Homes for Sale in {t['name']}, NJ {t['zip']}", f"Browse {t['name']}, NJ homes for sale, from condos to single-family homes. Local market guide, FAQs, listing alerts and agents from Balsley Losco Real Estate.", f"/homes-for-sale/{t['slug']}/", main, schema=sch, hero=hero, active="Areas", prio="0.9", freq="weekly", maps=True)

def towns_index():
    cr = [("Home", "/"), ("Areas", "/homes-for-sale/")]
    main = f'''<section class="sec"><div class="wrap"><div class="grid g3">{"".join(tcard(t) for t in TOWNS)}</div>
<div class="prose" style="margin-top:50px"><h2>Our home search areas</h2><p>Balsley Losco Real Estate helps buyers and sellers throughout Atlantic County and parts of Cape May County. Every community has its own character — mainland neighborhoods with larger lots and quick highway access, bayfront towns built around marinas, and barrier-island beach communities. Pick an area to see homes for sale, a local guide and answers to common buying questions.</p></div></div></section>'''
    return layout("Homes for Sale by Town — Atlantic & Cape May County NJ", "Browse homes for sale by town: Northfield, Linwood, Egg Harbor Township, Somers Point, Margate, Ventnor, Brigantine, Hammonton, Galloway and more.", "/homes-for-sale/", main,
                  hero=page_hero("Homes for sale by town", "Local guides and listings for the communities we know best.", cr), active="Areas", prio="0.9", schema=[crumb_schema(cr), itemlist_towns()])

def itemlist_towns():
    return {"@context": "https://schema.org", "@type": "ItemList", "name": "Areas served by Balsley Losco Real Estate", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": f"{SITE_URL}/homes-for-sale/{t['slug']}/", "name": f"Homes for sale in {t['name']}, NJ"} for i, t in enumerate(TOWNS)]}

def category(path, title, h1, lead, desc, flt, intro_html, faqs, active="Buy", extra=""):
    ls = [l for l in LISTINGS if flt(l)]
    cr = [("Home", "/"), (h1, path)]
    cards = "".join(lcard(l) for l in ls) or '<p class="muted">No matching demo listings.</p>'
    main = f'''<section class="sec" style="padding:30px 0 50px"><div class="wrap">{maplist(ls, h1.lower())}</div></section>
<section class="sec tint"><div class="wrap narrow prose">{intro_html}</div></section>{extra}
<section class="sec"><div class="wrap narrow"><span class="eyebrow">FAQ</span><h2>Common questions</h2>{faq_html(faqs)}</div></section>'''
    return layout(title, desc, path, main, hero=page_hero(h1, lead, cr), schema=[crumb_schema(cr), faq_schema(faqs), itemlist(ls, h1)], active=active, prio="0.8", freq="weekly", maps=True)

def gallery_urls(l):
    base = re.sub(r"-1\.jpg.*$", "", l["img"])
    return [l["img"], base + "-2.jpg", base + "-3.jpg"] if l["img"].endswith("-1.jpg") else [l["img"]]

def listing_page(l):
    t = town_of(l)
    cr = [("Home", "/"), ("Search", "/search/")]
    if l["town"]: cr.append((t["name"], f"/homes-for-sale/{t['slug']}/"))
    cr.append((l["addr"], f"/listing/{l['slug']}/"))
    baths = "%g" % l["baths"]
    imgs = gallery_urls(l)
    hide = "this.style.display='none'"
    def im(u, a, lazy):
        return f'<img src="{E(u)}" alt="{E(a)}" width="800" height="600" referrerpolicy="no-referrer" onload="this.closest(&#39;.gal&#39;).classList.add(&#39;multi&#39;)" onerror="{hide}">'
    first = f'<img src="{E(imgs[0])}" alt="{E(l["title"])} — {E(l["addr"])}, {E(t["name"])}, NJ" width="800" height="600" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'/assets/img/placeholder.svg\'">'
    side = "".join(im(u, f"{l['addr']} — photo {i+2}", True) for i, u in enumerate(imgs[1:]))
    gal = f'<div class="gal">{first}<div class="side">{side}</div></div>' if side else f'<div class="gal one">{first}</div>'
    dl = [("Property type", l["type"]), ("Year built", l["year"] or "—"), ("Lot size", f"{l['lot']} acres" if l["lot"] else "—"), ("Waterfront / water views", "Yes" if l["wf"] else "—"),
          ("Neighborhood", (l.get("feats") or [""])[0].replace("Neighborhood: ", "") if (l.get("feats") and l["feats"][0].startswith("Neighborhood")) else "—"), ("MLS #", l["mls"] or "—"), ("Listing office", BRAND)]
    dl_html = "".join(f"<div><dt>{a}</dt><dd>{E(b)}</dd></div>" for a, b in dl)
    similar = [x for x in LISTINGS if x is not l and x["type"] == l["type"] and (x["town"] == l["town"] or abs(x["price"] - l["price"]) < l["price"] * .3)][:3]
    sim = "".join(lcard(x) for x in similar)
    money_l = lprice(l)
    ag = next((a for a in AGENTS if a["name"].lower() == (l.get("agent") or "").lower()), None)
    agent_html = ""
    if ag:
        ph = f'<img src="{E(ag["photo"])}" alt="" width="64" height="64" referrerpolicy="no-referrer" style="width:64px;height:64px;border-radius:50%;object-fit:cover">' if ag["photo"] else f'<div class="avatar" style="width:64px;height:64px;border-radius:50%;font-size:1.2rem">{initials(ag["name"])}</div>'
        agent_html = f'<a href="/agents/{ag["slug"]}/" style="display:flex;gap:14px;align-items:center;text-decoration:none;color:inherit;margin-bottom:18px">{ph}<span><small class="muted">Listed by</small><br><b>{E(ag["name"])}</b><br><small class="muted">{E(ag["role"])}</small></span></a>'
    about = f'<h3 style="margin-top:30px">About {E(t["name"])}</h3><p>{E(t["tagline"])} <a href="/homes-for-sale/{t["slug"]}/">Explore homes for sale in {E(t["name"])}</a>.</p>' if l["town"] else ""
    feats = "".join(f"<li>{E(f)}</li>" for f in l["feats"]) or "<li>Contact us for full details</li>"
    lat, lng = ll(l)
    main = f'''<div class="wrap" style="padding-top:22px">{gal}
<div class="ld"><div><span class="eyebrow">{E(l["type"])} for {"rent" if l["type"]=="Rental" else "sale"} · {E(t["name"])}, NJ</span><h1 style="font-size:2.1rem">{E(l["addr"])}, {E(t["name"])}, NJ {t["zip"]}</h1><div class="price">{money_l}</div>
<div class="keyfacts"><div><b>{l["beds"]}</b><span>Beds</span></div><div><b>{baths}</b><span>Baths</span></div><div><b>{l["sqft"]:,}</b><span>Sq ft</span></div><div><b>{l["year"] or "—"}</b><span>Built</span></div></div>
<h2 style="font-size:1.6rem">{E(l["title"])}</h2><p>{E(l["desc"])}</p>
<h3>Highlights</h3><ul class="checks">{feats}</ul>
<h3>Property details</h3><dl class="dl">{dl_html}</dl>
<h3 style="margin-top:30px">Location</h3><div class="ml-map static" data-pin="{lat},{lng}" data-label="{short_price(l)}" role="region" aria-label="Map showing {E(l["addr"])}"></div>
{about}
{"" if l["type"]=="Rental" else f'<p style="margin-top:22px"><a class="btn ghost" href="/buy/mortgage-calculator/?price={l["price"]}">Estimate your monthly payment</a></p>'}
<p class="note">Listing information from the Balsley Losco website, October 2026 snapshot. Deemed reliable but not guaranteed; the live MLS/IDX feed keeps details and photos current.</p></div>
<aside class="sticky"><div class="panel">{agent_html}<h3>Ask about this home</h3>{form("listing-inquiry", field("Name", "name", "text", True, "", "name") + field("Email", "email", "email", True, "", "email") + field("Phone", "phone", "tel", False, "", "tel") + '<div><label for="msg">Message</label><textarea id="msg" name="message">I&#39;d like more information about %s, %s.</textarea></div>' % (E(l["addr"]), E(t["name"])), "Request info", hidden={"listing": l["addr"] + ", " + t["name"], "mls": l["mls"], "agent": l.get("agent", ""), "url": f"/listing/{l['slug']}/"})}
<p style="margin:16px 0 0;text-align:center"><a href="tel:{OFFICES[0]["tel"]}"><b>Call {PHONE}</b></a></p></div></aside></div>
<div class="sec" style="padding-bottom:20px"><h2>Similar homes</h2><div class="grid g3">{sim}</div></div></div>'''
    about_obj = {"@type": "House" if l["type"] == "Single Family" else "Accommodation", "address": {"@type": "PostalAddress", "streetAddress": l["addr"], "addressLocality": t["name"], "addressRegion": "NJ", "postalCode": t["zip"], "addressCountry": "US"},
                 "numberOfBedrooms": l["beds"], "numberOfBathroomsTotal": l["baths"], "geo": {"@type": "GeoCoordinates", "latitude": lat, "longitude": lng}}
    if l["sqft"]: about_obj["floorSize"] = {"@type": "QuantitativeValue", "value": l["sqft"], "unitCode": "FTK"}
    if l["year"]: about_obj["yearBuilt"] = l["year"]
    sch = [crumb_schema(cr), {"@context": "https://schema.org", "@type": "RealEstateListing", "name": f"{l['title']} — {l['addr']}, {t['name']}, NJ", "url": f"{SITE_URL}/listing/{l['slug']}/",
           "description": l["desc"], "image": imgs, "datePosted": TODAY,
           "offers": {"@type": "Offer", "price": l["price"], "priceCurrency": "USD", "availability": "https://schema.org/InStock", "seller": {"@id": SITE_URL + "/#org"}}, "about": about_obj}]
    return layout(f"{l['addr']}, {t['name']}, NJ — {money_l}", f"{l['beds']} bed, {baths} bath {l['type'].lower()} at {l['addr']}, {t['name']}, NJ {t['zip']} for {money_l}. {l['title']}. Photos, details and showing requests.", f"/listing/{l['slug']}/", main, schema=sch, active="Buy", prio="0.7", freq="weekly", maps=True)

def agents_index():
    cr = [("Home", "/"), ("Agents", "/agents/")]
    cards = "".join(acard(a) for a in AGENTS)
    letters = "".join(f'<button class="chip dk" type="button" data-letter="{c}">{c}</button>' for c in sorted({a["name"][0].upper() for a in AGENTS}))
    main = f'''<section class="sec" style="padding-top:44px"><div class="wrap"><div class="filterbar"><div><label class="sr" for="aq">Search agents</label><input id="aq" type="search" placeholder="Search by name or language" autocomplete="off"></div>
<div><label class="sr" for="ar">Role</label><select id="ar"><option value="">All roles</option><option value="broker">Brokers</option><option value="associate">Associates</option><option value="realtor">REALTORS®</option></select></div>
<div><label class="sr" for="al">Language</label><select id="al"><option value="">Any language</option>{"".join(f"<option>{x}</option>" for x in sorted({l.strip() for a in AGENTS for l in a["lang"].split(",") if l.strip()}))}</select></div><span class="muted" id="acount">{len(AGENTS)} agents</span></div>
<div class="letters" aria-label="Jump by first letter">{letters}</div>
<div class="grid g4" id="agrid">{cards}</div><p class="empty" id="aempty">No agents match that search. <a href="/contact/">Contact the office</a> and we'll connect you with the right person.</p></div></section>
<section class="sec tint"><div class="wrap"><div class="band"><div><h2>Not sure who to call?</h2><p>Tell us what you're looking for and we'll match you with an agent who knows your area, price range and timeline.</p><a class="btn gold" href="/contact/?topic=match">Match me with an agent</a></div><div><p style="margin:0">Prefer to talk? Call our Northfield office at <a style="color:var(--red-d)" href="tel:{OFFICES[0]['tel']}"><b>{PHONE}</b></a> or our Somers Point office at <a style="color:var(--red-d)" href="tel:{OFFICES[1]['tel']}"><b>{OFFICES[1]['phone']}</b></a>.</p></div></div></div></section>'''
    return layout("Real Estate Agents in Northfield & Somers Point NJ", f"Meet the {len(AGENTS)}+ agents of Balsley Losco Real Estate. Find a local REALTOR® for buying or selling in Atlantic and Cape May Counties.", "/agents/", main,
                  hero=page_hero("Find a local agent", f"{len(AGENTS)} experienced agents serving Atlantic and Cape May Counties.", cr), schema=[crumb_schema(cr)], active="Agents", prio="0.9", freq="weekly")

def agent_page(a):
    cr = [("Home", "/"), ("Agents", "/agents/"), (a["name"], f"/agents/{a['slug']}/")]
    off = OFFICES[0]
    ph = (f'<img src="{E(a["photo"])}" alt="{E(a["name"])}, {E(a["role"])}" width="640" height="640" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{{className:\'avatar\',textContent:\'{initials(a["name"])}\'}}))">' if a["photo"] else f'<div class="avatar" style="font-size:6rem">{initials(a["name"])}</div>')
    langs = ", ".join(x.strip() for x in a["lang"].split(",") if x.strip()) or "English"
    chips = "".join(f'<a class="chip dk" href="/homes-for-sale/{t["slug"]}/">{E(t["name"])}</a> ' for t in TOWNS)
    others = "".join(acard(x) for x in AGENTS if x is not a and x["photo"])[:0]
    main = f'''<section class="sec" style="padding-top:40px"><div class="wrap"><div class="ap"><div><div class="photo">{ph}</div></div>
<div><span class="eyebrow">{E(a["role"])}</span><h1 style="font-size:2.6rem">{E(a["name"])}</h1><p class="lead">{E(a["name"])} is part of the Balsley Losco Real Estate team in Northfield, NJ, helping buyers and sellers across Atlantic and Cape May Counties.</p>
<dl class="dl" style="max-width:560px"><div><dt>Brokerage</dt><dd>{BRAND}</dd></div><div><dt>Office</dt><dd>{off["street"]}, {off["city"]}, NJ {off["zip"]}</dd></div><div><dt>Office phone</dt><dd><a href="tel:{off["tel"]}">{off["phone"]}</a></dd></div><div><dt>Languages</dt><dd>{E(langs)}</dd></div></dl>
<p style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="#contact">Contact {E(a["name"].split()[0])}</a><a class="btn ghost" href="tel:{off["tel"]}">Call the office</a><a class="btn ghost" href="/search/">Search homes</a></p>
<h2 style="font-size:1.4rem;margin-top:34px">Areas we serve</h2><p>{chips}</p></div></div></div></section>
<section class="sec tint" id="contact"><div class="wrap"><div class="cols2"><div><span class="eyebrow">Get in touch</span><h2>Work with {E(a["name"].split()[0])}</h2><p>Share what you're looking for and {E(a["name"].split()[0])} will follow up. Whether you're buying your first home, selling, or just exploring, there's no obligation.</p><ul class="checks"><li>Local knowledge of Atlantic and Cape May Counties</li><li>Backed by a brokerage serving the area since {FOUNDED}</li><li>Access to every listing in the MLS</li></ul></div>
<div class="panel">{form("agent-contact", field("Your name", "name", "text", True, "", "name") + field("Email", "email", "email", True, "", "email") + field("Phone", "phone", "tel", False, "", "tel") + '<div><label for="am2">How can we help?</label><textarea id="am2" name="message"></textarea></div>', "Send message", hidden={"agent": a["name"], "agent_id": a["id"]})}</div></div></div></section>'''
    sch = [crumb_schema(cr), {"@context": "https://schema.org", "@type": "RealEstateAgent", "@id": f"{SITE_URL}/agents/{a['slug']}/#agent", "name": a["name"], "jobTitle": a["role"], "url": f"{SITE_URL}/agents/{a['slug']}/",
           **({"image": a["photo"]} if a["photo"] else {}), "telephone": off["tel"], "worksFor": {"@id": SITE_URL + "/#org"}, "parentOrganization": {"@id": SITE_URL + "/#org"},
           "address": {"@type": "PostalAddress", "streetAddress": off["street"], "addressLocality": off["city"], "addressRegion": "NJ", "postalCode": off["zip"], "addressCountry": "US"},
           "knowsLanguage": [x.strip() for x in a["lang"].split(",") if x.strip()] or ["English"], "areaServed": [t["name"] + ", NJ" for t in TOWNS]}]
    return layout(f"{a['name']} – Northfield NJ Real Estate Agent", f"Contact {a['name']}, {a['role']} with Balsley Losco Real Estate in Northfield, NJ. Local expert for buying and selling homes in Atlantic and Cape May Counties.", f"/agents/{a['slug']}/", main, schema=sch, active="Agents", prio="0.5", freq="monthly")

def buy_hub():
    cr = [("Home", "/"), ("Buy", "/buy/")]
    main = f'''<section class="sec"><div class="wrap"><div class="grid g3">
<a class="card pcard body" href="/search/" style="text-decoration:none;color:inherit"><div class="num">1</div><h3>Search homes</h3><p>Filter every listing by town, price and type, and save your favorites.</p></a>
<a class="card pcard body" href="/buy/pre-approval/" style="text-decoration:none;color:inherit"><div class="num">2</div><h3>Get pre-approved</h3><p>Know your budget and show sellers you're serious.</p></a>
<a class="card pcard body" href="/buy/mortgage-calculator/" style="text-decoration:none;color:inherit"><div class="num">3</div><h3>Estimate your payment</h3><p>Test price, down payment, taxes and insurance.</p></a></div></div></section>
<section class="sec tint"><div class="wrap"><div class="cols2"><div class="prose"><span class="eyebrow">The buying process</span><h2>Buying a home in New Jersey, step by step</h2><p>New Jersey has a few steps buyers in other states don't see, like attorney review and detailed flood-zone research near the shore. Our agents guide you through each stage.</p>
<ol><li>Set a budget and check your credit</li><li>Get pre-approved</li><li>Choose a buyer's agent and attorney</li><li>Search, tour and make an offer</li><li>Attorney review, inspections and appraisal</li><li>Final walk-through and closing</li></ol><p><a class="btn" href="/guides/how-to-buy-a-home-in-atlantic-county-nj/">Read the full 9-step guide</a></p></div>
<div class="panel"><h3>Talk with a buyer's agent</h3><p class="muted">Tell us a little about what you want and we'll follow up.</p>{form("buyer-contact", field("Name", "name", "text", True, "", "name") + field("Email", "email", "email", True, "", "email") + field("Phone", "phone", "tel", False, "", "tel") + '<div><label for="bw">Towns of interest</label><input id="bw" name="towns" placeholder="e.g. Linwood, Margate"></div>', "Get started", hidden={"topic": "buying"})}</div></div></div></section>
<section class="sec"><div class="wrap narrow"><span class="eyebrow">Learn more</span><h2>Buyer guides</h2><ul class="checks"><li><a href="/guides/first-time-home-buyer-programs-new-jersey/">First-time home buyer programs in New Jersey</a></li><li><a href="/guides/new-jersey-closing-costs-and-transfer-fees/">New Jersey closing costs &amp; transfer fees</a></li><li><a href="/guides/flood-zones-and-flood-insurance-jersey-shore/">Flood zones &amp; flood insurance at the shore</a></li><li><a href="/guides/island-vs-mainland-where-to-buy-in-atlantic-county/">Island vs. mainland: where to buy</a></li><li><a href="/guides/how-to-choose-a-buyers-agent/">How to choose a buyer's agent</a></li></ul>
<h2 style="margin-top:40px">Buyer FAQ</h2>{faq_html(FAQ_BUY)}</div></section>'''
    return layout("Buy a Home in Atlantic County NJ — Buyer's Guide", "Everything you need to buy a home in Atlantic County, NJ: search, pre-approval, mortgage calculator, local guides and buyer's agents.", "/buy/", main,
                  hero=page_hero("Buy a home with confidence", "From first search to closing day, a local team beside you.", cr), schema=[crumb_schema(cr), faq_schema(FAQ_BUY)], active="Buy", prio="0.9")

def calculator():
    cr = [("Home", "/"), ("Buy", "/buy/"), ("Mortgage calculator", "/buy/mortgage-calculator/")]
    main = f'''<section class="sec"><div class="wrap"><div class="calc" data-calc>
<div class="panel form"><h2 style="font-size:1.5rem">Your numbers</h2>
<div><label for="c-price">Home price: <b id="o-price"></b></label><input type="range" id="c-price" min="100000" max="3000000" step="5000" value="450000"></div>
<div><label for="c-down">Down payment: <b id="o-down"></b></label><input type="range" id="c-down" min="0" max="50" step="1" value="10"></div>
<div class="row"><div><label for="c-rate">Interest rate (%)</label><input type="number" id="c-rate" step="0.125" value="6.5" min="0.5" max="15"></div><div><label for="c-term">Term</label><select id="c-term"><option value="30">30 years</option><option value="20">20 years</option><option value="15">15 years</option></select></div></div>
<div class="row"><div><label for="c-tax">Property tax / year ($)</label><input type="number" id="c-tax" value="8000" step="100"></div><div><label for="c-ins">Home insurance / year ($)</label><input type="number" id="c-ins" value="1800" step="50"></div></div>
<div class="row"><div><label for="c-flood">Flood insurance / year ($)</label><input type="number" id="c-flood" value="0" step="50"></div><div><label for="c-hoa">HOA / month ($)</label><input type="number" id="c-hoa" value="0" step="10"></div></div>
<p class="muted" style="font-size:.82rem;margin:0">Defaults are illustrative only. Rates, taxes and insurance vary by property and lender — NJ property taxes in particular differ widely by town.</p></div>
<div class="out" aria-live="polite"><p style="margin:0;text-transform:uppercase;letter-spacing:.12em;font-size:.78rem">Estimated monthly payment</p><div class="big" id="o-total">$0</div><div class="bar" id="o-bar"></div>
<div class="lg"><span><i><span class="dot" style="background:#f2b632"></span>Principal &amp; interest</i><b id="o-pi"></b></span><span><i><span class="dot" style="background:#c8202f"></span>Property tax</i><b id="o-t"></b></span><span><i><span class="dot" style="background:#7d1019"></span>Insurance (home + flood)</i><b id="o-i"></b></span><span><i><span class="dot" style="background:#d9c7a8"></span>HOA</i><b id="o-h"></b></span></div>
<hr style="border:0;border-top:1px solid #ffffff33;margin:20px 0"><p style="margin:0 0 4px">Loan amount: <b id="o-loan" style="color:var(--red-d)"></b></p><p style="margin:0 0 18px">Down payment: <b id="o-dp" style="color:var(--red-d)"></b></p><a class="btn gold block" href="/buy/pre-approval/">Get pre-approved</a></div></div>
<div class="prose" style="margin-top:50px"><h2>How to use this mortgage calculator</h2><p>Enter a home price, down payment and rate to see your estimated monthly payment, including property taxes, homeowners insurance and — for shore homes — flood insurance. Remember that closing costs are separate; read our <a href="/guides/new-jersey-closing-costs-and-transfer-fees/">New Jersey closing cost guide</a>.</p></div></div></section>'''
    return layout("Mortgage Calculator — NJ Monthly Payment Estimator", "Estimate your monthly mortgage payment including New Jersey property taxes, homeowners insurance and flood insurance with this free calculator.", "/buy/mortgage-calculator/", main,
                  hero=page_hero("Mortgage calculator", "Estimate your monthly payment, taxes and insurance.", cr), schema=[crumb_schema(cr)], active="Buy", prio="0.8")

def preapproval():
    cr = [("Home", "/"), ("Buy", "/buy/"), ("Get pre-approved", "/buy/pre-approval/")]
    faqs = [("What's the difference between pre-qualification and pre-approval?", "Pre-qualification is a quick estimate based on information you provide. Pre-approval involves a lender verifying your income, assets and credit, and gives you a letter sellers take seriously."),
            ("Does pre-approval affect my credit score?", "A lender will typically check your credit, which can cause a small, temporary dip. Multiple mortgage inquiries within a short window are generally treated as a single inquiry."),
            ("How long is a pre-approval valid?", "Letters commonly last 60 to 90 days. If you're still shopping after that, your lender can update it."),
            ("What documents will I need?", "Typically recent pay stubs, W-2s or tax returns, bank and asset statements, and identification.")]
    main = f'''<section class="sec"><div class="wrap"><div class="cols2"><div class="prose"><span class="eyebrow">Know your budget</span><h2>Get pre-approved with a trusted local lender</h2><p>Our partner lenders offer low rates, low fees and local underwriting so loans close quickly. They use modern technology and years of experience to simplify the process and keep you in the loop from application to closing.</p>
<ul class="checks"><li>Know exactly what you can afford</li><li>Make stronger offers sellers take seriously</li><li>Compare loan types: conventional, FHA, VA, USDA and first-time buyer programs</li><li>Local underwriting for smoother closings</li></ul><p><a href="/guides/first-time-home-buyer-programs-new-jersey/">First-time buyer? See New Jersey programs →</a></p></div>
<div class="panel"><h3>Request a lender introduction</h3>{form("preapproval", field("Name", "name", "text", True, "", "name") + field("Email", "email", "email", True, "", "email") + field("Phone", "phone", "tel", True, "", "tel") + '<div><label for="pp">Target price range</label><select id="pp" name="range"><option>Under $300,000</option><option>$300,000 – $500,000</option><option>$500,000 – $750,000</option><option>$750,000 – $1,000,000</option><option>Over $1,000,000</option></select></div>', "Connect me with a lender", hidden={"topic": "pre-approval"})}</div></div>
<div class="narrow" style="margin:50px auto 0"><h2>Pre-approval FAQ</h2>{faq_html(faqs)}</div></div></section>'''
    return layout("Get Pre-Approved for a Mortgage in New Jersey", "Get pre-approved with trusted local lenders: low rates, local underwriting and a faster path to closing for Atlantic County home buyers.", "/buy/pre-approval/", main,
                  hero=page_hero("Get pre-approved", "The first step to making a winning offer.", cr), schema=[crumb_schema(cr), faq_schema(faqs)], active="Buy", prio="0.7")

def sell_hub():
    cr = [("Home", "/"), ("Sell", "/sell/")]
    faqs = [("How much does it cost to sell a home in New Jersey?", "Sellers typically pay the agent commission, a realty transfer fee, any mortgage payoff and agreed-upon repairs. Your agent will give you a net-proceeds estimate before you list."),
            ("How long will it take to sell my home?", "It depends on price, condition, location and the market. Your agent will review how long comparable homes have taken to sell and recommend a strategy."),
            ("Do I need to make repairs before selling?", "Not always, but small fixes, a deep clean and decluttering often pay off. Your agent can recommend the updates with the best return."),
            ("What does a free home valuation include?", "A local agent reviews recent comparable sales, your home's condition and current market conditions, then gives you a price range with no obligation.")]
    main = f'''<section class="sec"><div class="wrap"><div class="grid g4"><div class="card pcard body"><div class="num">1</div><h3>Home valuation</h3><p>A local agent reviews your home and recent sales to recommend a price.</p></div><div class="card pcard body"><div class="num">2</div><h3>Prep &amp; price</h3><p>Simple prep steps and a pricing strategy that attracts buyers fast.</p></div><div class="card pcard body"><div class="num">3</div><h3>Market &amp; show</h3><p>Maximum exposure across the MLS and major listing sites.</p></div><div class="card pcard body"><div class="num">4</div><h3>Negotiate &amp; close</h3><p>Expert negotiation and guidance through attorney review and closing.</p></div></div></div></section>
<section class="sec tint"><div class="wrap"><div class="cols2"><div class="prose"><span class="eyebrow">Sell with confidence</span><h2>A quick sale at the best price, terms and conditions</h2><p>You can count on Balsley Losco to price your home right and get it in front of as many qualified buyers as possible. We're locally owned, full-time and experienced — so you get personal service from people who live here.</p>
<ul class="checks"><li>Free, no-obligation home valuation</li><li>Maximum listing exposure across multiple sources</li><li>Local agents who know your neighborhood</li><li>Guidance on NJ certificates and closing requirements</li></ul><p><a class="btn" href="/sell/home-value/">Get my free home value</a> <a class="btn ghost" href="/guides/what-is-my-home-worth/">How pricing works</a></p></div>
<div class="panel"><h3>Talk to a listing agent</h3>{form("seller-contact", field("Name", "name", "text", True, "", "name") + field("Email", "email", "email", True, "", "email") + field("Phone", "phone", "tel", False, "", "tel") + field("Property address", "address", "text", False, "", "street-address"), "Request a call", hidden={"topic": "selling"})}</div></div></div></section>
<section class="sec"><div class="wrap narrow"><span class="eyebrow">Seller FAQ</span><h2>Selling your home</h2>{faq_html(faqs)}</div></section>'''
    return layout("Sell Your Home in Atlantic County NJ", "Sell your Atlantic County home with Balsley Losco: free valuation, expert pricing, maximum exposure and local negotiation since 1954.", "/sell/", main,
                  hero=page_hero("Sell your home for the best price", "Local expertise, serious marketing and personal service.", cr), schema=[crumb_schema(cr), faq_schema(faqs)], active="Sell", prio="0.9")

def valuation():
    cr = [("Home", "/"), ("Sell", "/sell/"), ("Home value", "/sell/home-value/")]
    main = f'''<section class="sec"><div class="wrap"><div class="cols2"><div class="prose"><span class="eyebrow">Free &amp; no obligation</span><h2>What's my home worth?</h2><p>Tell us about your home and a Balsley Losco agent will prepare a custom valuation based on recent nearby sales, your home's condition and current market conditions.</p>
<ul class="checks"><li>Reviewed by a local agent — not just an algorithm</li><li>Covers Atlantic and Cape May Counties</li><li>Your information is never sold</li></ul></div>
<div class="panel"><h3>Request your home valuation</h3>{form("home-valuation", field("Property address", "address", "text", True, "123 Main St, Northfield NJ", "street-address") + '<div class="row">' + field("Name", "name", "text", True, "", "name") + field("Phone", "phone", "tel", False, "", "tel") + '</div>' + field("Email", "email", "email", True, "", "email") + '<div class="row"><div><label for="hv-b">Bedrooms</label><select id="hv-b" name="beds"><option>1–2</option><option selected>3</option><option>4</option><option>5+</option></select></div><div><label for="hv-t">Planning to sell</label><select id="hv-t" name="timeline"><option>ASAP</option><option>1–3 months</option><option>3–6 months</option><option>Just curious</option></select></div></div>', "Get my home value", hidden={"topic": "valuation"})}</div></div></div></section>'''
    return layout("Free Home Value Estimate — Atlantic County NJ", "Get a free, no-obligation home valuation from a local Balsley Losco agent. Accurate pricing based on recent nearby sales.", "/sell/home-value/", main,
                  hero=page_hero("What's my home worth?", "Request a free valuation from a local expert.", cr), schema=[crumb_schema(cr)], active="Sell", prio="0.8")

def rentals():
    faqs = [("How do I apply for a rental?", "Browse available rentals, then submit the online rental application through our secure leasing portal. A Balsley Losco agent will follow up on next steps."),
            ("Do you manage rental properties?", "Contact our office to discuss rental listings and property owner services in Atlantic and Cape May Counties.")]
    extra = f'''<section class="sec"><div class="wrap"><div class="band"><div><h2>Ready to apply?</h2><p>Complete your rental application securely online through our leasing partner.</p><a class="btn gold" href="https://secure2.ntnonline.com/securelease/default.cfm?propcode=BL1630&amp;unit=9498" rel="noopener" target="_blank">Start rental application</a></div><div><p style="margin:0">Property owner? <a style="color:var(--red-d)" href="/contact/?topic=landlord"><b>Ask about listing your rental →</b></a></p></div></div></div></section>'''
    return category("/rentals/", "Rentals in Atlantic & Cape May County NJ", "Rentals", "Apartments, condos and homes for rent from Northfield to Ocean City.", "Search apartments, condos and houses for rent in Atlantic and Cape May Counties, NJ. Apply online with Balsley Losco Real Estate.", lambda l: l["type"] == "Rental",
                    "<h2>Renting in Atlantic County</h2><p>Whether you want a year-round apartment near Bay Avenue or a seasonal shore rental, our agents can match you with available rentals and walk you through the application and lease process. Browse the available rentals above, or <a href=\"/search/?type=Rental\">search all rentals</a>.</p>", faqs, "Rent", extra)

def about():
    cr = [("Home", "/"), ("About", "/about/")]
    main = f'''<section class="sec"><div class="wrap"><div class="split"><div class="prose"><span class="eyebrow">Our story</span><h2>Trust the name you know</h2><p>Since {FOUNDED}, Balsley Losco has been an important part of the growth of Atlantic County. We are solely owned and operated by individuals who have been local residents for generations.</p><p>Our goal is to provide service through our full-time, experienced real estate sales staff, ensuring quality and personalized service to every client.</p><p>Balsley Losco has been recognized among the top 10 independent real estate companies for sales in New Jersey and among the top 500 real estate companies in America — but our focus remains on you.</p><p><a class="btn" href="/agents/">Meet our agents</a> <a class="btn ghost" href="/offices/">Visit an office</a></p></div>
<div class="art">{scene(7, 205, "gable", True, label="Illustration of a shore home")}</div></div></div></section>
<section class="sec tint"><div class="wrap"><div class="grid g3"><div class="card body"><h3>Locally owned</h3><p>Owned and operated by families who have lived here for generations.</p></div><div class="card body"><h3>Full-time professionals</h3><p>A full-time, experienced staff dedicated to personal service.</p></div><div class="card body"><h3>Proven results</h3><p>Recognized for selling more real estate than any other office in our area.</p></div></div></div></section>
<section class="sec"><div class="wrap narrow"><span class="eyebrow">By the numbers</span><h2>Balsley Losco today</h2><ul class="checks"><li>Founded in {FOUNDED} in Atlantic County</li><li>{len(AGENTS)}+ agents on our roster</li><li>Two offices: Northfield and Somers Point</li><li>Residential, rental, commercial and investment services</li></ul></div></section>'''
    return layout("About Balsley Losco Real Estate — Since 1954", "Balsley Losco Real Estate has served Atlantic County since 1954. Locally owned, full-time agents and personal service. Trust the name you know.", "/about/", main,
                  hero=page_hero("About Balsley Losco", "Atlantic County's trusted name in real estate since 1954.", cr), schema=[crumb_schema(cr)], active="About", prio="0.7")

def offices():
    cr = [("Home", "/"), ("Offices", "/offices/")]
    cards = "".join(f'<div class="card body"><h3>{E(o["name"])}</h3><p>{E(o["street"])}<br>{E(o["city"])}, NJ {o["zip"]}<br><a href="tel:{o["tel"]}">{o["phone"]}</a></p><p class="muted">{E(o["blurb"])}</p><a class="btn sm" href="/offices/{o["slug"]}/">Office details</a></div>' for o in OFFICES)
    main = f'<section class="sec"><div class="wrap"><div class="grid g2">{cards}</div></div></section>'
    return layout("Office Locations — Northfield & Somers Point NJ", "Visit Balsley Losco Real Estate in Northfield (1630 New Road) or Somers Point (644 Bay Avenue), NJ. Directions, phone numbers and local agents.", "/offices/", main,
                  hero=page_hero("Our offices", "Two convenient locations in Atlantic County.", cr), schema=[crumb_schema(cr)], active="About", prio="0.7")

def office_page(o):
    cr = [("Home", "/"), ("Offices", "/offices/"), (o["city"], f"/offices/{o['slug']}/")]
    q = E(f"{o['street']}, {o['city']}, NJ {o['zip']}").replace(" ", "+")
    nearby = [t for t in TOWNS if (t["slug"] in SP_OFFICE) == (o["slug"] == "somers-point")]
    main = f'''<section class="sec"><div class="wrap"><div class="cols2"><div><h2>{E(o["name"])}</h2><address style="font-style:normal;font-size:1.15rem;line-height:1.7">{E(o["street"])}<br>{E(o["city"])}, NJ {o["zip"]}<br><a href="tel:{o["tel"]}"><b>{o["phone"]}</b></a></address><p>{E(o["blurb"])}</p>
<p><a class="btn" href="https://www.google.com/maps/dir/?api=1&amp;destination={q}" rel="noopener" target="_blank">Get directions</a> <a class="btn ghost" href="/agents/">Our agents</a></p><h3 style="margin-top:30px">Communities served from this office</h3><p>{"".join(f'<a class="chip dk" href="/homes-for-sale/{t["slug"]}/">{E(t["name"])}</a> ' for t in nearby)}</p></div>
<div class="panel"><h3>Contact the {E(o["city"])} office</h3>{form("office-contact", field("Name", "name", "text", True, "", "name") + field("Email", "email", "email", True, "", "email") + field("Phone", "phone", "tel", False, "", "tel") + '<div><label for="om">Message</label><textarea id="om" name="message"></textarea></div>', "Send message", hidden={"office": o["name"]})}</div></div></div></section>'''
    return layout(f"{o['city']} Real Estate Office — {o['street']}", f"Balsley Losco Real Estate in {o['city']}, NJ: {o['street']}, {o['city']}, NJ {o['zip']}. Call {o['phone']}. Local agents and homes for sale.", f"/offices/{o['slug']}/", main,
                  hero=page_hero(f"{E(o['city'])} office", E(o["blurb"]), cr), schema=[crumb_schema(cr)], active="About", prio="0.7")

def careers():
    cr = [("Home", "/"), ("Careers", "/careers/")]
    main = f'''<section class="sec"><div class="wrap"><div class="cols2"><div class="prose"><span class="eyebrow">Join our team</span><h2>Grow your real estate career with the area's most established independent brokerage</h2><p>We give our agents the tools and one-on-one support to succeed — in an environment that puts agents first to help accelerate careers in real estate.</p>
<ul class="checks"><li>Buyer and seller leads, with follow-up systems to help you convert them</li><li>A modern IDX website and CRM to save time and close more deals</li><li>One-on-one mentoring and an experienced broker team</li><li>Training through our <a href="https://elite-advantage-real-estate-academy.coursestorm.com/" rel="noopener" target="_blank">Real Estate School</a></li><li>Two offices: Northfield and Somers Point</li></ul></div>
<div class="panel"><h3>Set up a confidential meeting</h3>{form("careers", field("Name", "name", "text", True, "", "name") + field("Email", "email", "email", True, "", "email") + field("Cell phone", "phone", "tel", True, "", "tel") + '<div><label for="cx">Experience</label><select id="cx" name="experience"><option>Newly licensed</option><option>1–3 years</option><option>4+ years</option><option>Considering licensing</option></select></div>', "Request a meeting", hidden={"topic": "recruiting"})}</div></div></div></section>'''
    return layout("Real Estate Careers in Atlantic County NJ", "Join Balsley Losco Real Estate in Northfield and Somers Point, NJ. Leads, CRM, mentoring and training for real estate agents.", "/careers/", main,
                  hero=page_hero("Careers at Balsley Losco", "Come build your business with us.", cr), schema=[crumb_schema(cr)], active="Agents", prio="0.6")

def commercial():
    cr = [("Home", "/"), ("Commercial", "/commercial/")]
    main = f'''<section class="sec"><div class="wrap"><div class="split"><div class="prose"><span class="eyebrow">Commercial &amp; investment</span><h2>Commercial real estate in Atlantic County</h2><p>From retail and office space to multi-family and development opportunities, our commercial and investment team helps owners, investors and business operators find and sell commercial property across the region.</p><p><a class="btn" href="https://commercial.blhomes.com/" rel="noopener">Visit our commercial site</a> <a class="btn ghost" href="/contact/?topic=commercial">Contact the team</a></p></div>
<div class="art">{scene(21, 215, "tall", False, label="Illustration of a commercial building")}</div></div></div></section>'''
    return layout("Commercial Real Estate — Atlantic County NJ", "Commercial and investment real estate in Atlantic and Cape May Counties from the Balsley Losco commercial team.", "/commercial/", main,
                  hero=page_hero("Commercial &amp; investment", "Retail, office, multi-family and investment properties.", cr), schema=[crumb_schema(cr)], active="About", prio="0.5")

def contact():
    cr = [("Home", "/"), ("Contact", "/contact/")]
    offs = "".join(f'<div class="card body"><h3>{E(o["city"])}</h3><p>{E(o["street"])}<br>{E(o["city"])}, NJ {o["zip"]}<br><a href="tel:{o["tel"]}">{o["phone"]}</a></p></div>' for o in OFFICES)
    main = f'''<section class="sec"><div class="wrap"><div class="cols2"><div><h2>Send us a message</h2><div class="panel">{form("contact", field("Name", "name", "text", True, "", "name") + field("Email", "email", "email", True, "", "email") + field("Phone", "phone", "tel", False, "", "tel") + '<div><label for="ct">I&#39;m interested in</label><select id="ct" name="topic"><option value="buying">Buying a home</option><option value="selling">Selling a home</option><option value="renting">Renting</option><option value="commercial">Commercial</option><option value="landlord">Listing a rental</option><option value="match">Being matched with an agent</option><option value="other">Something else</option></select></div><div><label for="cm">Message</label><textarea id="cm" name="message"></textarea></div>', "Send message")}</div></div>
<div><h2>Visit or call</h2><div class="grid">{offs}</div><p style="margin-top:20px">Need help navigating the site or searching for real estate? Call our offices at <a href="tel:{OFFICES[0]["tel"]}"><b>{PHONE}</b></a>.</p></div></div></div></section>'''
    return layout("Contact Balsley Losco Real Estate — Northfield & Somers Point", f"Contact Balsley Losco Real Estate. Northfield: {PHONE}. Somers Point: {OFFICES[1]['phone']}. Send a message or visit an office.", "/contact/", main,
                  hero=page_hero("Contact us", "We'd love to hear from you.", cr), schema=[crumb_schema(cr), {"@context": "https://schema.org", "@type": "ContactPage", "url": SITE_URL + "/contact/", "name": "Contact Balsley Losco Real Estate"}], prio="0.7")

def guides():
    cr = [("Home", "/"), ("Guides", "/guides/")]
    cards = "".join(f'<a class="card arcard" href="/guides/{a["slug"]}/" style="text-decoration:none;color:inherit"><div class="img"><img src="/assets/img/a-{a["slug"]}.svg" alt="" width="800" height="500" loading="lazy"></div><div class="body"><div class="meta">{a["date"]} · {a["read"]} min read</div><h3>{E(a["title"])}</h3><p class="muted">{E(a["desc"])}</p></div></a>' for a in ARTICLES)
    main = f'<section class="sec"><div class="wrap"><div class="grid g3">{cards}</div></div></section>'
    return layout("Home Buying & Selling Guides — Atlantic County NJ", "Free guides for Atlantic County buyers and sellers: closing costs, flood zones, first-time buyer programs, pricing and more.", "/guides/", main,
                  hero=page_hero("Buyer &amp; seller guides", "Practical advice from local real estate pros.", cr), schema=[crumb_schema(cr)], prio="0.8", freq="weekly", active="About")

def article(a):
    cr = [("Home", "/"), ("Guides", "/guides/"), (a["title"], f"/guides/{a['slug']}/")]
    rel = "".join(f'<li><a href="/guides/{x["slug"]}/">{E(x["title"])}</a></li>' for x in ARTICLES if x is not a)[:2000]
    main = f'''<article class="sec"><div class="wrap"><div class="prose" style="margin:0 auto"><p class="muted">By {BRAND} · Published {a["date"]} · {a["read"]} min read</p>{a["body"]}
<hr style="margin:40px 0;border:0;border-top:1px solid var(--line)"><h3>More guides</h3><ul>{rel}</ul></div></div></article>'''
    sch = [crumb_schema(cr), {"@context": "https://schema.org", "@type": "Article", "headline": a["title"], "description": a["desc"], "datePublished": a["date"], "dateModified": a["date"],
           "author": {"@type": "Organization", "name": BRAND, "url": SITE_URL + "/"}, "publisher": {"@id": SITE_URL + "/#org"}, "mainEntityOfPage": f"{SITE_URL}/guides/{a['slug']}/", "image": f"{SITE_URL}/assets/img/og-default.png"}]
    return layout(a["title"], a["desc"], f"/guides/{a['slug']}/", main, hero=page_hero(E(a["title"]), "", cr), schema=sch, prio="0.7", og_type="article", active="About")

def account():
    cr = [("Home", "/"), ("Sign in", "/account/")]
    main = f'''<section class="sec"><div class="wrap">
<div id="auth" class="login-box panel"><h2>Your Balsley Losco account</h2><p class="muted">Save homes, save searches and get instant alerts — free.</p>
<form class="form" id="auth-form"><div><label for="au-n">Name</label><input id="au-n" required autocomplete="name"></div><div><label for="au-e">Email</label><input id="au-e" type="email" required autocomplete="email"></div><button class="btn" type="submit">Create free account / Sign in</button></form>
<p class="note" style="margin-top:16px">Demo: your account is stored in this browser. At launch this connects to the IDX/CRM provider for secure sign-in and email alerts across devices.</p></div>
<div id="dash" style="display:none"><div class="sec-head"><div><span class="eyebrow">Welcome back</span><h1 id="hello" style="font-size:2.2rem;margin:0"></h1></div><button class="btn ghost sm" id="signout">Sign out</button></div>
<div class="seg" role="tablist" style="margin-bottom:24px"><button type="button" aria-pressed="true" data-tab="saved">Saved homes</button><button type="button" aria-pressed="false" data-tab="searches">Saved searches</button><button type="button" aria-pressed="false" data-tab="alerts">Alerts</button></div>
<div class="tab on" id="tab-saved"><div class="grid g3" id="saved-grid"></div><p class="empty" id="saved-empty" style="display:block">You haven't saved any homes yet. Tap the heart on any listing. <a href="/search/">Start searching</a></p></div>
<div class="tab" id="tab-searches"><div id="searches"></div><p class="empty" id="searches-empty" style="display:block">No saved searches. Use “Save search” on the <a href="/search/">search page</a>.</p></div>
<div class="tab" id="tab-alerts"><div class="panel" style="max-width:560px"><h3>Email alert preferences</h3><div class="form"><div class="consent"><label><input type="checkbox" id="al-new" checked> New listings that match my saved searches</label><label><input type="checkbox" id="al-price" checked> Price reductions on saved homes</label><label><input type="checkbox" id="al-open"> Open house announcements</label><label><input type="checkbox" id="al-mkt"> Monthly market reports</label></div><button class="btn" type="button" id="al-save">Save preferences</button></div></div></div></div></div></section>'''
    data = json.dumps({l["slug"]: {"addr": l["addr"], "town": town_of(l)["name"], "price": lprice(l), "beds": l["beds"], "baths": l["baths"], "sqft": l["sqft"], "img": l["img"]} for l in LISTINGS})
    return layout("Sign In — Saved Homes & Searches", "Sign in to Balsley Losco to view your saved homes, saved searches and listing alerts.", "/account/", main + f'<script>window.BL_LISTINGS={data};</script>',
                  hero=page_hero("My account", "Saved homes, searches and alerts.", cr), noindex=True, in_sitemap=False)

def agent_portal():
    cr = [("Home", "/"), ("Agent portal", "/agent-portal/")]
    leads = [("Maria S.", "Linwood · Buyer", "$600–750K", "Hot", "Today"), ("James & Dana P.", "Margate · Buyer", "$1.1M", "Hot", "Today"), ("R. Alvarez", "Northfield · Seller", "Valuation", "Warm", "Yesterday"),
             ("T. Nguyen", "EHT · Buyer", "$450K", "Warm", "2 days"), ("K. Brooks", "Ventnor · Investor", "$500K+", "New", "3 days"), ("L. Greene", "Somers Point · Rental", "$2,200/mo", "New", "4 days")]
    lrows = "".join(f'<tr><td><b>{n}</b></td><td>{a}</td><td>{b}</td><td><span class="pill {"hot" if s=="Hot" else "warm" if s=="Warm" else ""}">{s}</span></td><td>{d}</td><td><button class="btn sm ghost" type="button">Follow up</button></td></tr>' for n, a, b, s, d in leads)
    lst = "".join(f'<tr><td><b>{E(l["addr"])}</b><br><span class="muted">{E(town_of(l)["name"])}</span></td><td>{lprice(l)}</td><td><span class="pill ok">{"Open house" if l.get("open") else l["status"]}</span></td><td>{12 + i*7} views</td><td><a href="/listing/{l["slug"]}/">View</a></td></tr>' for i, l in enumerate(LISTINGS[:6]))
    main = f'''<div id="plogin" class="wrap"><div class="login-box panel"><h2>Agent portal</h2><p class="muted">Sign in to manage leads, listings and marketing.</p><form class="form" id="plogin-form"><div><label for="pl-e">Email</label><input id="pl-e" type="email" autocomplete="username"></div><div><label for="pl-p">Password</label><input id="pl-p" type="password" autocomplete="current-password"></div><button class="btn" type="submit">Sign in (demo)</button></form>
<p class="note" style="margin-top:16px">Design preview with sample data. At launch this signs in through your brokerage CRM / SSO.</p></div></div>
<div id="pdash" class="portal" style="display:none"><div class="pnav"><p style="padding:0 14px;font-weight:700;color:#fff;margin:0 0 12px">Demo Agent</p><button data-t="ov" aria-current="true">Overview</button><button data-t="leads">Leads</button><button data-t="lst">My listings</button><button data-t="oh">Open houses</button><button data-t="tools">Marketing tools</button><button data-t="res">Resources</button><button id="pout">Sign out</button></div>
<div class="pmain"><div class="tab on" id="t-ov"><h2>Good morning</h2><div class="grid g4"><div class="stat"><b>14</b><span>New leads this week</span></div><div class="stat"><b>6</b><span>Active listings</span></div><div class="stat"><b>3</b><span>Open houses scheduled</span></div><div class="stat"><b>2</b><span>Pending closings</span></div></div><h3 style="margin-top:30px">Leads to follow up today</h3><table class="tbl"><thead><tr><th>Name</th><th>Interest</th><th>Budget</th><th>Heat</th><th>Last</th><th></th></tr></thead><tbody>{lrows[:900]}</tbody></table></div>
<div class="tab" id="t-leads"><h2>Leads</h2><table class="tbl"><thead><tr><th>Name</th><th>Interest</th><th>Budget</th><th>Heat</th><th>Last</th><th></th></tr></thead><tbody>{lrows}</tbody></table></div>
<div class="tab" id="t-lst"><h2>My listings</h2><table class="tbl"><thead><tr><th>Property</th><th>Price</th><th>Status</th><th>Traffic</th><th></th></tr></thead><tbody>{lst}</tbody></table></div>
<div class="tab" id="t-oh"><h2>Open houses</h2><table class="tbl"><thead><tr><th>Property</th><th>When</th><th>Sign-ins</th></tr></thead><tbody>{"".join(f'<tr><td>{E(l["addr"])}, {E(town_of(l)["name"])}</td><td>{E(l["open"])}</td><td>—</td></tr>' for l in LISTINGS if l.get("open"))}</tbody></table></div>
<div class="tab" id="t-tools"><h2>Marketing tools</h2><div class="grid g3"><div class="card body"><h3>Flyer builder</h3><p>Create a branded listing flyer in minutes.</p><button class="btn sm ghost" type="button">Open</button></div><div class="card body"><h3>Social posts</h3><p>Ready-to-share posts for new listings and sold homes.</p><button class="btn sm ghost" type="button">Open</button></div><div class="card body"><h3>CMA request</h3><p>Request a comparative market analysis for a client.</p><button class="btn sm ghost" type="button">Open</button></div></div></div>
<div class="tab" id="t-res"><h2>Resources</h2><ul class="checks"><li><a href="https://elite-advantage-real-estate-academy.coursestorm.com/" rel="noopener" target="_blank">Real Estate School schedule</a></li><li>Forms library</li><li>MLS &amp; showing system sign-in</li><li>Brokerage policies and training calendar</li><li><a href="/contact/">Contact the broker</a></li></ul></div></div></div>'''
    return layout("Agent Portal", "Balsley Losco agent portal: leads, listings and marketing tools.", "/agent-portal/", main, hero=page_hero("Agent portal", "Leads, listings and marketing tools.", cr), noindex=True, in_sitemap=False)

def simple(path, title, desc, h1, body, noindex=False, prio="0.3"):
    cr = [("Home", "/"), (h1, path)]
    return layout(title, desc, path, f'<section class="sec"><div class="wrap"><div class="prose" style="margin:0 auto">{body}</div></div></section>', hero=page_hero(h1, "", cr), schema=[crumb_schema(cr)], noindex=noindex, prio=prio, in_sitemap=not noindex)

def legal_pages():
    note = '<div class="note">Draft for design review — replace with the brokerage\'s approved policy text before launch.</div>'
    yield simple("/privacy/", "Privacy Policy", "How Balsley Losco Real Estate collects, uses and protects your information.", "Privacy policy", note + f'''<h2>Information we collect</h2><p>We collect information you provide through forms (such as your name, email, phone number and property interests) and information collected automatically, such as pages visited and device details.</p><h2>How we use it</h2><p>We use your information to respond to inquiries, provide listing alerts and valuations, improve our services and, where you've agreed, contact you by phone, text or email. Message and data rates may apply; reply STOP to opt out of texts.</p><h2>Sharing</h2><p>We share information with service providers and affiliated lenders or agents only as needed to serve your request. We do not sell your personal information.</p><h2>Your choices</h2><p>You can unsubscribe from emails at any time, opt out of texts by replying STOP, and ask us to update or delete your information by contacting us at {PHONE}.</p>''')
    yield simple("/terms/", "Terms of Use", "Terms of use for the Balsley Losco Real Estate website.", "Terms of use", note + f'''<h2>Use of this site</h2><p>This site is provided for your personal, non-commercial use to search for real estate and contact our team. Listing information is deemed reliable but not guaranteed.</p><h2>MLS data</h2><p>{LEGAL}</p><h2>Contact</h2><p>Questions? Call {PHONE}.</p>''')
    yield simple("/fair-housing/", "Fair Housing Statement", "Balsley Losco Real Estate is committed to fair housing and equal opportunity for all.", "Fair housing", f'''<p>Balsley Losco Real Estate is committed to the letter and spirit of U.S. policy for the achievement of equal housing opportunity throughout the nation. We encourage and support an affirmative advertising and marketing program in which there are no barriers to obtaining housing because of race, color, religion, sex, handicap, familial status, national origin and other protected classes under federal, state and local law.</p><p>If you believe you have experienced housing discrimination, you may contact the U.S. Department of Housing and Urban Development or the New Jersey Division on Civil Rights.</p>''')
    yield simple("/accessibility/", "Accessibility Statement", "Our commitment to an accessible website for everyone.", "Accessibility", f'''<p>We want everyone to be able to search for a home on our site. We design to WCAG 2.1 AA guidelines, including keyboard navigation, sufficient color contrast, descriptive alt text and responsive layouts.</p><p>If you have trouble using any part of this site, please call our offices at <a href="tel:{OFFICES[0]["tel"]}">{PHONE}</a> and we'll help you search for real estate by phone.</p>''')

def thanks():
    return layout("Thank You", "Thanks for contacting Balsley Losco Real Estate.", "/thanks/", f'<section class="sec"><div class="wrap narrow" style="text-align:center"><h1>Thank you!</h1><p class="lead" style="margin:0 auto 24px">A Balsley Losco agent will be in touch shortly.</p><a class="btn" href="/search/">Keep searching homes</a></div></section>', noindex=True, in_sitemap=False)

def not_found():
    return layout("Page Not Found", "That page can't be found. Search homes for sale in Atlantic County, NJ.", "/404.html", '<section class="sec"><div class="wrap narrow" style="text-align:center"><h1>We couldn\'t find that page</h1><p class="lead" style="margin:0 auto 24px">It may have moved. Try searching homes or head back home.</p><a class="btn" href="/search/">Search homes</a> <a class="btn ghost" href="/">Home</a></div></section>', noindex=True, in_sitemap=False)

def sitemap_html():
    cr = [("Home", "/"), ("Site map", "/sitemap/")]
    sec = lambda t, items: f'<h2>{t}</h2><ul class="cols-list">' + "".join(f'<li><a href="{u}">{E(n)}</a></li>' for n, u in items) + "</ul>"
    body = (sec("Main", [("Home", "/"), ("Search homes", "/search/"), ("Buy", "/buy/"), ("Sell", "/sell/"), ("Free home value", "/sell/home-value/"), ("Rentals", "/rentals/"), ("Commercial", "/commercial/"), ("About", "/about/"), ("Offices", "/offices/"), ("Careers", "/careers/"), ("Contact", "/contact/"), ("Open houses", "/open-houses/"), ("Condos for sale", "/condos-for-sale/"), ("Waterfront homes", "/waterfront-homes/")])
            + sec("Areas", [(f"Homes for sale in {t['name']}", f"/homes-for-sale/{t['slug']}/") for t in TOWNS])
            + sec("Guides", [(a["title"], f"/guides/{a['slug']}/") for a in ARTICLES])
            + sec("Agents", [(a["name"], f"/agents/{a['slug']}/") for a in AGENTS]))
    return layout("Site Map", "Site map for Balsley Losco Real Estate: all areas, guides, agents and tools.", "/sitemap/", f'<section class="sec"><div class="wrap prose" style="max-width:none">{body}</div></section>', hero=page_hero("Site map", "", cr), schema=[crumb_schema(cr)], prio="0.2")

# ------------------------------------------------------------------ run
def main():
    os.makedirs(OUT, exist_ok=True)
    clean(); build_art()
    write("/", home()); write("/search/", search_page()); write("/homes-for-sale/", towns_index())
    for t in TOWNS: write(f"/homes-for-sale/{t['slug']}/", town_page(t))
    write("/condos-for-sale/", category("/condos-for-sale/", "Condos & Townhomes for Sale in Atlantic County NJ", "Condos & townhomes for sale", "Low-maintenance living near the beach, bay and Parkway.", "Browse condos and townhomes for sale in Atlantic and Cape May Counties, NJ, from beach-block condos to mainland townhomes.", lambda l: l["type"] in ("Condo", "Townhouse"),
        "<h2>Condo and townhome living near the Jersey Shore</h2><p>Condos and townhomes offer low-maintenance ownership with amenities like parking, elevators and association-maintained grounds. Be sure to review association fees, rules, flood-zone status and insurance requirements before you buy.</p>", [("Are condos in Atlantic County a good investment?", "Condos can be a strong fit for second homes and rentals, but costs vary. Review association fees, rental rules and reserves with your agent and attorney."), ("What are HOA fees?", "Association fees cover shared expenses such as exterior maintenance, insurance on common areas, landscaping and amenities. Ask for the fee schedule and budget before you make an offer.")]))
    write("/waterfront-homes/", category("/waterfront-homes/", "Waterfront Homes for Sale — Jersey Shore & Bayfront NJ", "Waterfront homes for sale", "Bayfront, oceanside and water-access homes in Atlantic and Cape May Counties.", "Browse waterfront and water-access homes for sale in Somers Point, Margate, Brigantine, Ocean City and more. Local guidance on flood zones and insurance.", lambda l: l["wf"],
        '<h2>Buying a waterfront home in New Jersey</h2><p>Waterfront homes offer views, docks and beach access — and a few extra things to check. Review the property\'s flood zone, elevation certificate, bulkhead condition and insurance costs early. Read our guide to <a href="/guides/flood-zones-and-flood-insurance-jersey-shore/">flood zones and flood insurance at the Jersey Shore</a>.</p>', [("Do waterfront homes require flood insurance?", "Many do. If the property is in a FEMA Special Flood Hazard Area and has a federally backed loan, flood insurance is required. Get a quote before you make an offer."), ("What is an elevation certificate?", "It documents a building's elevation relative to the base flood elevation and is used by insurers to price flood policies.")]))
    write("/open-houses/", category("/open-houses/", "Open Houses This Weekend — Atlantic County NJ", "Open houses this weekend", "Tour homes in person with a local agent.", "Find open houses this weekend in Atlantic and Cape May Counties, NJ. Tour homes in Linwood, Northfield, Brigantine, Hamilton Township and more.", lambda l: bool(l.get("open")),
        "<h2>How to make the most of an open house</h2><ul><li>Arrive with your pre-approval letter and a list of must-haves.</li><li>Ask about recent updates, taxes, flood zone and utility costs.</li><li>Take notes and photos, and note anything that needs inspection.</li><li>Ask the agent how long the home has been on the market.</li></ul>", [("Do I need an appointment for an open house?", "No — open houses are drop-in. For a private showing, contact an agent."), ("Can I make an offer at an open house?", "Yes. Your agent can help you prepare an offer after you've toured.")]))
    write("/rentals/", rentals())
    for l in LISTINGS: write(f"/listing/{l['slug']}/", listing_page(l))
    write("/agents/", agents_index())
    for a in AGENTS: write(f"/agents/{a['slug']}/", agent_page(a))
    write("/buy/", buy_hub()); write("/buy/mortgage-calculator/", calculator()); write("/buy/pre-approval/", preapproval())
    write("/sell/", sell_hub()); write("/sell/home-value/", valuation())
    write("/about/", about()); write("/offices/", offices())
    for o in OFFICES: write(f"/offices/{o['slug']}/", office_page(o))
    write("/careers/", careers()); write("/commercial/", commercial()); write("/contact/", contact())
    write("/guides/", guides())
    for a in ARTICLES: write(f"/guides/{a['slug']}/", article(a))
    write("/account/", account()); write("/agent-portal/", agent_portal())
    for path, pg in zip(["/privacy/", "/terms/", "/fair-housing/", "/accessibility/"], legal_pages()): write(path, pg)
    write("/thanks/", thanks()); write("/404.html", not_found()); write("/sitemap/", sitemap_html())
    # sitemap.xml, robots.txt, headers
    urls = {}
    for p, pr, fq in PAGES: urls[p] = (pr, fq)
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p, (pr, fq) in sorted(urls.items()):
        xml.append(f"<url><loc>{SITE_URL}{p}</loc><lastmod>{TODAY}</lastmod><changefreq>{fq}</changefreq><priority>{pr}</priority></url>")
    xml.append("</urlset>")
    write("/sitemap.xml", "\n".join(xml))
    write("/robots.txt", f"User-agent: *\nAllow: /\nDisallow: /account/\nDisallow: /agent-portal/\nDisallow: /thanks/\nDisallow: /search/?*\n\nSitemap: {SITE_URL}/sitemap.xml\n")
    write("/_headers", "/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: SAMEORIGIN\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: geolocation=(), camera=(), microphone=()\n/assets/*\n  Cache-Control: public, max-age=3600\n")
    print("built", len(urls), "indexable pages ->", OUT)

if __name__ == "__main__":
    main()
