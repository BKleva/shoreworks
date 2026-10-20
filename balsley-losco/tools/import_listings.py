# -*- coding: utf-8 -*-
"""Normalize the raw blhomes.com listing scrape (raw_listings.json) into tools/listings.json.
Usage: python tools/import_listings.py <raw.json>"""
import json, re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
TOWN_MAP = {
    "egg harbor township": "egg-harbor-township", "egg harbor twp": "egg-harbor-township", "somers point": "somers-point", "margate": "margate",
    "linwood": "linwood", "northfield": "northfield", "ventnor": "ventnor", "ventnor heights": "ventnor", "ocean city": "ocean-city",
    "mays landing": "hamilton-township", "hamilton": "hamilton-township", "hamilton township": "hamilton-township", "hammonton": "hammonton",
    "galloway": "galloway", "galloway township": "galloway", "galloway twp": "galloway", "smithville": "galloway", "absecon": "absecon", "brigantine": "brigantine",
}
TYPE_MAP = {"Single Family": "Single Family", "Condos": "Condo", "Townhouse": "Townhouse", "Multi-Family": "Multi-Family", "Rentals": "Rental"}
CENTERS = {"atlantic city": (39.364, -74.423), "wildwood": (38.991, -74.815), "north wildwood": (39.002, -74.795), "pleasantville": (39.389, -74.524),
           "west creek": (39.66, -74.27), "egg harbor city": (39.532, -74.649), "marmora": (39.271, -74.646), "smithville": (39.451, -74.447),
           "ventnor heights": (39.351, -74.486), "brigantine": (39.410, -74.364), "mays landing": (39.452, -74.727)}
sys.path.insert(0, HERE)
from data import TOWNS as _T
for _t in _T: CENTERS.setdefault(_t["name"].lower().replace(" city", ""), (_t["lat"], _t["lng"]))
CENTERS.update({"egg harbor township": (39.385, -74.614), "hamilton township": (39.452, -74.727), "galloway township": (39.489, -74.477), "ventnor": (39.340, -74.478), "margate": (39.327, -74.512), "ocean city": (39.278, -74.575)})
WF = re.compile(r"waterfront|bayfront|oceanfront|ocean front|water ?view|bay view|bay-view|dock|bulkhead|lagoon|marina|canal|riverfront|lakefront|beach block|ocean view|water access", re.I)

def num(s, d=0.0):
    m = re.search(r"[\d.]+", str(s or "").replace(",", ""))
    return float(m.group()) if m else d

def clean_city(c):
    c = re.sub(r",?\s*NJ$", "", c.strip())
    c = c.replace("Twp", "Township")
    return c

def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def main(raw):
    rows = json.load(open(raw, encoding="utf-8"))
    out, seen, moved = [], set(), []
    for r in rows:
        if r.get("err") or not r.get("u"): continue
        city = clean_city(r["city"]); town = TOWN_MAP.get(city.lower(), "")
        typ = TYPE_MAP.get(r["type"], r["type"])
        beds = int(num(r["beds"])); full = num(r["baths"]); half = num(r["half"]); baths = full + half * 0.5
        sqft = int(num(r["sqft"])); lot = round(num(r["acres"]), 2); price = int(num(r["price"]))
        ym = re.match(r"(\d{4})", r.get("year") or ""); year = int(ym.group(1)) if ym else 0
        lab = (r.get("lab") or "").strip().lower()
        status = "Reduced" if "reduc" in lab else "New" if "just listed" in lab else "Active"
        openh = "Open house" if "open house" in lab else ""
        label = (r.get("lab") or "").strip() if lab not in ("", "undefined", "reduced", "just listed", "open house") else ""
        hood = (r.get("hood") or "").strip(); style = (re.sub(r"Taxes.*", "", r.get("style") or "")).strip()
        desc = (r.get("desc") or "").strip()
        desc = re.sub(r"\s+", " ", desc)
        if len(desc) > 1000: desc = desc[:1000].rsplit(" ", 1)[0] + "…"
        slug = slugify(f"{r['addr']} {city} {(r.get('mls') or '')[-5:]}")
        if slug in seen: continue
        seen.add(slug)
        title = f"{beds}-bedroom {typ.lower()}" if beds else typ
        title += f" in {hood}" if hood and hood.lower() not in ("other", "none") else f" in {city}"
        feats = [f for f in [f"Neighborhood: {hood}" if hood else "", f"Style: {style}" if style else "", f"Built in {year}" if year else "", f"{lot} acre lot" if lot else ""] if f]
        img = re.sub(r"\?v=.*$", "", r.get("img") or r.get("img0") or "")
        lat, lng = r.get("lat"), r.get("lng")
        cen = CENTERS.get(city.lower()) or CENTERS.get(city.lower().replace(" township", "")) or CENTERS.get(city.lower().replace(" twp", ""))
        approx = False
        if cen and (lat is None or abs(lat - cen[0]) > 0.09 or abs(lng - cen[1]) > 0.11):
            h = (abs(hash(slug)) % 1000) / 1000.0
            lat, lng = round(cen[0] + (h - .5) * .012, 5), round(cen[1] + (((h * 7) % 1) - .5) * .014, 5); approx = True
            moved.append(r["addr"] + ", " + city)
        if lat is not None and lat > 39.8:  # outside the Atlantic / Cape May service area (e.g. Mercer County)
            continue
        out.append(dict(slug=slug, mls=r.get("mls", ""), addr=r["addr"].strip(), city=city, zip=r.get("zip", ""), town=town, price=price, beds=beds, baths=baths, sqft=sqft, lot=lot, year=year,
                        type=typ, status=status, wf=bool(WF.search(desc + " " + hood) or lab in ("waterfront", "water views")), open=openh, label=label, title=title, desc=desc, feats=feats, img=img, agent=(r.get("agent") or "").strip(),
                        lat=lat, lng=lng, approx=approx, old=r["u"]))
    json.dump(out, open(os.path.join(HERE, "listings.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("re-centered", len(moved), moved[:8])
    print(len(out), "listings;", sum(1 for o in out if o["lat"]), "geocoded;", sum(1 for o in out if o["town"]), "in town pages")

if __name__ == "__main__":
    main(sys.argv[1])
