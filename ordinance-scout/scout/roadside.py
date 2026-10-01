"""Roadside parcels: every commercial / industrial / vacant parcel within N feet of a state highway edge.

Data (all public, no scraping of private sites):
  * Highway centerlines ........ OpenStreetMap via Overpass (NJ / US / I routes). Garden State Parkway is excluded.
  * Parcels + tax mailing address NJ Office of GIS "Parcels and MOD-IV Composite of NJ" (ArcGIS FeatureServer).
    Owner names are blank in this public layer; the tax/mailing address is present.
  * Businesses + emails ........ OpenStreetMap POI tags (name, phone, website, email). Sparse: only what mappers entered.
Distances are measured from the estimated pavement edge (OSM lane count x 6 ft either side of the centerline)
in NJ State Plane feet (EPSG:3424).
"""
import json
import re
import threading
import time
from datetime import datetime, timedelta

import requests
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, mapping, shape
from shapely.ops import transform
from shapely.strtree import STRtree

from .db import data_dir

UA = {"User-Agent": "OutdoorImpactScout/1.0 (land-use research; contact ben@shoreworksnj.com)"}
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
PARCELS = "https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0/query"

# south, west, north, east (generous; parcels are filtered by their COUNTY field)
BBOX = {
    "Monmouth": (40.05, -74.45, 40.50, -73.98),
    "Ocean": (39.53, -74.45, 40.16, -73.90),
    "Bergen": (40.70, -74.22, 41.13, -73.88),
    "Morris": (40.63, -74.72, 41.08, -74.20),
}
REF_RE = re.compile(r"^(NJ|US|I) ?\d+[A-Z]?$")
CLASSES = {"1": "Vacant land", "4A": "Commercial", "4B": "Industrial"}   # residential, farm, apartment, exempt: never loaded
DEFAULT_CLASSES = ["1", "4A", "4B"]
TO_FT = Transformer.from_crs(4326, 3424, always_xy=True).transform
TO_LL = Transformer.from_crs(3424, 4326, always_xy=True).transform


def _post(url_list, data, timeout=120):
    last = None
    for url in url_list:
        for attempt in range(2):
            try:
                r = requests.post(url, data=data, headers=UA, timeout=timeout)
                if r.status_code == 200:
                    return r.json()
                last = f"HTTP {r.status_code}"
            except (requests.RequestException, ValueError) as e:
                last = type(e).__name__
            time.sleep(2)
    raise RuntimeError(f"Overpass unavailable ({last})")


# ------------------------------------------------------------------ roads
def _is_gsp(tags):
    """Garden State Parkway is excluded (tagged GSP, or signed as Route 444, or named as the Parkway)."""
    ref = tags.get("ref", "").upper().replace("  ", " ")
    return ("GSP" in ref or "NJ 444" in ref or "NJ444" in ref
            or "garden state parkway" in tags.get("name", "").lower())


def load_roads(county, max_age_days=30):
    """State-highway centerlines for a county as [{ref, coords:[(lon,lat)..], lanes, oneway, name}], cached on disk."""
    path = data_dir() / f"roads2_{county}.json"
    if path.exists():
        blob = json.loads(path.read_text(encoding="utf-8"))
        if datetime.fromisoformat(blob["fetched"]) > datetime.now() - timedelta(days=max_age_days):
            return blob["ways"]
    s, w, n, e = BBOX[county]
    # ways inside the county's own boundary (OSM area) and inside NJ's box, so same-named counties elsewhere are ignored
    q = (f'[out:json][timeout:180];area["ISO3166-2"="US-NJ"]->.nj;area["name"="{county} County"]["admin_level"="6"]->.c;'
         f'way["highway"~"^(motorway|trunk|primary|secondary)$"]["ref"~"^(NJ|US|I) ?[0-9]"]({s},{w},{n},{e})(area.c);out geom tags;')
    got = {el["id"]: el for el in _post(OVERPASS, {"data": q}, timeout=200)["elements"]}
    ways = []
    for el in got.values():
        tags = el.get("tags", {})
        if _is_gsp(tags) or len(el.get("geometry", [])) < 2:
            continue
        refs = [re.sub(r"^(NJ|US|I)\s*(\d)", lambda m: m.group(1) + " " + m.group(2), r.strip())
                for r in tags.get("ref", "").split(";")]
        refs = [r for r in refs if re.match(r"^(NJ|US|I) \d+[A-Z]?$", r)]
        if not refs:
            continue
        lanes = tags.get("lanes", "")
        ways.append({"id": el["id"], "refs": refs, "name": tags.get("name", ""),
                     "lanes": int(lanes) if lanes.isdigit() else 2, "oneway": tags.get("oneway") == "yes",
                     "coords": [(p["lon"], p["lat"]) for p in el["geometry"]]})
    path.write_text(json.dumps({"fetched": datetime.now().isoformat(), "ways": ways}), encoding="utf-8")
    return ways


def list_routes(county):
    out = {}
    for w in load_roads(county):
        for r in w["refs"]:
            d = out.setdefault(r, {"ref": r, "ways": 0, "names": set()})
            d["ways"] += 1
            if w["name"]:
                d["names"].add(w["name"])
    def key(r):
        kind, num = re.match(r"^(NJ|US|I) ?(\d+)", r["ref"]).groups()
        return ({"I": 0, "US": 1, "NJ": 2}[kind], int(num))
    return [{"ref": r["ref"], "ways": r["ways"], "names": sorted(r["names"])[:2]} for r in sorted(out.values(), key=key)]


def roads_geojson(county, refs=None):
    feats = []
    for w in load_roads(county):
        if refs and not set(refs) & set(w["refs"]):
            continue
        feats.append({"type": "Feature", "properties": {"ref": ", ".join(w["refs"]), "name": w["name"]},
                      "geometry": {"type": "LineString", "coordinates": w["coords"]}})
    return {"type": "FeatureCollection", "features": feats}


# ------------------------------------------------------------------ parcels
def _esri_to_polygon(rings):
    polys = [Polygon(r) for r in rings if len(r) >= 4]
    if not polys:
        return None
    polys.sort(key=lambda p: -p.area)
    outer = polys[0]
    holes = [p.exterior.coords for p in polys[1:] if outer.contains(p.representative_point())]
    return Polygon(outer.exterior.coords, holes)


def _parcel_chunk(county, part, reach_ft, classes):
    geom = {"paths": [[[round(x, 5), round(y, 5)] for x, y in w["coords"]] for w in part],
            "spatialReference": {"wkid": 4326}}
    where = f"COUNTY='{county.upper()}' AND PROP_CLASS IN (" + ",".join(f"'{c}'" for c in sorted(classes)) + ")"
    out, offset = [], 0
    while True:
        data = {"f": "json", "where": where, "geometry": json.dumps(geom), "geometryType": "esriGeometryPolyline",
                "inSR": "4326", "outSR": "4326", "spatialRel": "esriSpatialRelIntersects", "distance": str(reach_ft),
                "units": "esriSRUnit_Foot", "returnGeometry": "true", "maxAllowableOffset": "0.00001",
                "outFields": "PAMS_PIN,PROP_CLASS,MUN_NAME,PROP_LOC,OWNER_NAME,ST_ADDRESS,CITY_STATE,ZIP_CODE,FAC_NAME,PROP_USE,CALC_ACRE",
                "resultOffset": str(offset), "resultRecordCount": "2000"}
        for attempt in range(3):
            r = requests.post(PARCELS, data=data, headers=UA, timeout=120).json()
            if "error" not in r:
                break
            time.sleep(2)
        else:
            raise RuntimeError(f"Parcel service error: {r['error'].get('message')}")
        out += r.get("features", [])
        if not r.get("exceededTransferLimit"):
            return out
        offset += len(r.get("features", [])) or 2000


def _fetch_parcels(county, ways, reach_ft, classes, log):
    """Parcels of the wanted classes within reach_ft of the ways. Big chunks, four requests in flight."""
    from concurrent.futures import ThreadPoolExecutor
    chunks = [ways[i:i + 80] for i in range(0, len(ways), 80)]
    out, seen = [], set()
    with ThreadPoolExecutor(max_workers=4) as pool:
        for feats in pool.map(lambda c: _parcel_chunk(county, c, reach_ft, classes), chunks):
            for f in feats:
                pin = f["attributes"]["PAMS_PIN"]
                if pin in seen or not f.get("geometry"):
                    continue
                seen.add(pin)
                poly = _esri_to_polygon(f["geometry"]["rings"])
                if poly is not None and poly.is_valid:
                    out.append((f["attributes"], poly))
            log(f"  parcels fetched so far: {len(out):,}")
    return out


def _edge_distances(poly_ft, tree, lines, halves, reach_ft):
    """(nearest edge distance, farthest-vertex edge distance) in feet from the pavement edge, or None."""
    cand = tree.query(poly_ft.buffer(reach_ft + 60))
    if len(cand) == 0:
        return None
    near = min(max(poly_ft.distance(lines[j]) - halves[j], 0) for j in cand)
    verts = list(poly_ft.exterior.coords)[::max(1, len(poly_ft.exterior.coords) // 40)]
    far = 0
    for x, y in verts:
        p = Point(x, y)
        far = max(far, min(max(p.distance(lines[j]) - halves[j], 0) for j in cand))
    return near, far


# ------------------------------------------------------------------ businesses (OSM)
POI_KEYS = ("shop", "amenity", "office", "craft", "industrial", "healthcare", "tourism", "leisure")


def _poi_cell(cell_box):
    s_, w_, n_, e_ = cell_box
    keys = "|".join(POI_KEYS)
    q = (f'[out:json][timeout:60];nwr["name"][~"^({keys})$"~"."]({s_:.4f},{w_:.4f},{n_:.4f},{e_:.4f});out center tags;')
    return _post(OVERPASS, {"data": q}, timeout=90)["elements"]


def _fetch_pois(centroids_ll, log, stop=None, cell=0.04):
    """OSM named places in the map cells that contain kept parcels. Returns [(Point_in_feet, tags)]."""
    from concurrent.futures import ThreadPoolExecutor
    cells = sorted({(int(lat / cell), int(lon / cell)) for lat, lon in centroids_ll})
    boxes = [(ci * cell - 0.002, cj * cell - 0.002, (ci + 1) * cell + 0.002, (cj + 1) * cell + 0.002) for ci, cj in cells]
    pois, seen = [], set()

    def safe(box):
        if stop is not None and stop.is_set():
            return []
        try:
            return _poi_cell(box)
        except RuntimeError as e:
            log(f"  one business-lookup area was skipped: {e}")
            return []
    with ThreadPoolExecutor(max_workers=2) as pool:   # Overpass allows ~2 concurrent requests per client
        for k, els in enumerate(pool.map(safe, boxes)):
            for el in els:
                t = el.get("tags", {})
                key = (el["type"], el["id"])
                lat = el.get("lat") or el.get("center", {}).get("lat")
                lon = el.get("lon") or el.get("center", {}).get("lon")
                if key in seen or lat is None:
                    continue
                seen.add(key)
                pois.append((Point(*TO_FT(lon, lat)), {
                    "name": t.get("name", ""), "phone": t.get("phone") or t.get("contact:phone") or "",
                    "website": t.get("website") or t.get("contact:website") or "",
                    "email": t.get("email") or t.get("contact:email") or ""}))
            log(f"  business listings: {len(pois):,} (area {k + 1}/{len(boxes)})")
    return pois


# ------------------------------------------------------------------ job
class RoadsideJob:
    def __init__(self, db):
        self.db = db
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.state = {"running": False, "log": [], "done": 0, "total": 0, "saved": 0}
        db.conn().executescript("""
        CREATE TABLE IF NOT EXISTS roadside_hits(
          id INTEGER PRIMARY KEY, pin TEXT, route TEXT, county TEXT, muni TEXT, prop_loc TEXT, prop_class TEXT,
          prop_use TEXT, bldg_desc TEXT, fac_name TEXT, owner_name TEXT, mail_street TEXT, mail_city_state TEXT,
          mail_zip TEXT, acres REAL, edge_min_ft REAL, edge_max_ft REAL, businesses TEXT, emails TEXT, phones TEXT,
          websites TEXT, lat REAL, lon REAL, geojson TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(pin, route));
        CREATE INDEX IF NOT EXISTS ix_rs_county ON roadside_hits(county, route);""")
        db.conn().execute("CREATE TABLE IF NOT EXISTS roadside_meta(county TEXT PRIMARY KEY, refreshed_at TEXT)")
        try:
            db.conn().execute("ALTER TABLE roadside_hits ADD COLUMN biz_checked INTEGER DEFAULT 0")
        except Exception:
            pass   # already migrated

    def log(self, msg):
        with self.lock:
            self.state["log"] = (self.state["log"] + [f"{time.strftime('%H:%M:%S')}  {msg}"])[-150:]

    def start(self, county, refs, max_ft, classes, businesses=False):
        with self.lock:
            if self.state["running"]:
                return False
            self.stop_event.clear()
            self.state.update(running=True, log=[], done=0, total=len(refs), saved=0, county=county)
        threading.Thread(target=self._run, args=(county, refs, max_ft, classes, businesses), daemon=True).start()
        return True

    def stop(self):
        self.stop_event.set()

    def _run(self, county, refs, max_ft, classes, businesses=False):
        kept_all = []
        try:
            roads = load_roads(county)
            self.log(f"{county}: {len(roads)} highway segments loaded")
            for ref in refs:
                if self.stop_event.is_set():
                    break
                kept_all += self._route(county, ref, roads, max_ft, set(classes))
                self.state["done"] += 1
            if businesses and kept_all and not self.stop_event.is_set():
                self._enrich(kept_all)   # one lookup for the whole county, not one per highway
            if not self.stop_event.is_set():
                self.db.run("INSERT OR REPLACE INTO roadside_meta(county, refreshed_at) VALUES(?, datetime('now'))", (county,))
        except Exception as e:
            self.log(f"ERROR: {e}")
        finally:
            self.state["running"] = False
            self.log("Stopped." if self.stop_event.is_set() else "Finished.")

    def _route(self, county, ref, roads, max_ft, classes):
        """Fetch + save parcels for one highway. Returns [(pin, ref, poly, pf)] for the business step."""
        ways = [w for w in roads if ref in w["refs"]]
        if not ways:
            return []
        self.log(f"> {ref}: {len(ways)} segments, reach {max_ft} ft")
        reach = max_ft + 26   # half-width of the widest usual carriageway (4 lanes), so nothing within max_ft is missed
        parcels = _fetch_parcels(county, ways, reach, classes, self.log)
        parcels = [(a, p) for a, p in parcels if a["PROP_CLASS"] in classes]
        self.log(f"  {len(parcels):,} parcels in selected property classes")
        if not parcels:
            return []
        lines, halves = [], []
        for w in ways:
            lines.append(LineString([TO_FT(x, y) for x, y in w["coords"]]))
            halves.append(w["lanes"] * 6.0)
        tree = STRtree(lines)
        kept = []
        for attrs, poly in parcels:
            pf = transform(TO_FT, poly)
            if pf.is_empty:
                continue
            d = _edge_distances(pf, tree, lines, halves, max_ft)
            if d and d[0] <= max_ft:
                kept.append((attrs, poly, pf, d))
        rows = []
        for attrs, poly, pf, (near, far) in kept:
            c = poly.representative_point()
            rows.append((attrs["PAMS_PIN"], ref, county, attrs["MUN_NAME"], attrs["PROP_LOC"], attrs["PROP_CLASS"],
                         attrs.get("PROP_USE"), None, attrs.get("FAC_NAME"), attrs.get("OWNER_NAME") or "",
                         attrs.get("ST_ADDRESS") or "", attrs.get("CITY_STATE") or "", attrs.get("ZIP_CODE") or "",
                         attrs.get("CALC_ACRE"), round(near, 1), round(far, 1), "", "", "", "",
                         c.y, c.x, json.dumps(mapping(poly))))
        c = self.db.conn()
        old = {r[0]: r[1:] for r in c.execute(
            "SELECT pin, businesses, emails, phones, websites FROM roadside_hits WHERE county=? AND route=? AND biz_checked=1",
            (county, ref))}
        c.execute("DELETE FROM roadside_hits WHERE county=? AND route=?", (county, ref))
        c.executemany("INSERT OR REPLACE INTO roadside_hits(pin,route,county,muni,prop_loc,prop_class,prop_use,bldg_desc,"
                      "fac_name,owner_name,mail_street,mail_city_state,mail_zip,acres,edge_min_ft,edge_max_ft,businesses,"
                      "emails,phones,websites,lat,lon,geojson) VALUES(" + ",".join("?" * 23) + ")", rows)
        if old:   # a refresh must not throw away business lookups the user already loaded
            c.executemany("UPDATE roadside_hits SET businesses=?, emails=?, phones=?, websites=?, biz_checked=1 "
                          "WHERE county=? AND route=? AND pin=?",
                          [(*v, county, ref, pin) for pin, v in old.items()])
        c.commit()
        self.state["saved"] += len(rows)
        self.log(f"= {ref}: {len(rows):,} parcels within {max_ft} ft, saved (addresses + tax mailing addresses)")
        return [(a["PAMS_PIN"], ref, poly, pf) for a, poly, pf, _ in kept]

    def _enrich(self, kept):
        self.log(f"Looking up business names/emails for {len(kept):,} parcels (OpenStreetMap, one pass for the county)...")
        pois = _fetch_pois([(pf_poly.representative_point().y, pf_poly.representative_point().x) for _, _, pf_poly, _ in kept],
                           self.log, self.stop_event)
        if not pois or self.stop_event.is_set():
            return
        ptree = STRtree([p for p, _ in pois])
        updates, with_email = [], 0
        for pin, ref, poly, pf in kept:
            zone = pf.buffer(15)
            biz = [pois[j][1] for j in ptree.query(zone) if zone.contains(pois[j][0])]
            if not biz:
                continue
            names = "; ".join(dict.fromkeys(b["name"] for b in biz if b["name"]))
            emails = "; ".join(dict.fromkeys(b["email"] for b in biz if b["email"]))
            phones = "; ".join(dict.fromkeys(b["phone"] for b in biz if b["phone"]))
            sites = "; ".join(dict.fromkeys(b["website"] for b in biz if b["website"]))
            with_email += bool(emails)
            updates.append((names, emails, phones, sites, pin, ref))
        c = self.db.conn()
        c.executemany("UPDATE roadside_hits SET businesses=?, emails=?, phones=?, websites=? WHERE pin=? AND route=?", updates)
        c.commit()
        self.log(f"= {len(updates):,} parcels matched to a business listing, {with_email} with an email (OpenStreetMap)")


# ------------------------------------------------------------------ on-demand business info for one map area
def enrich_bbox(db, bbox):
    """Look up OSM business names/emails for parcels in a small map area (the user's view). Returns updated rows."""
    s, w, n, e = bbox
    if (n - s) > 0.035 or (e - w) > 0.05:
        raise ValueError("Zoom in to street level to look up businesses.")
    rows = db.q("SELECT id, pin, route, geojson FROM roadside_hits WHERE biz_checked=0 "
                "AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?", (s, n, w, e))
    if not rows:
        return []
    keys = "|".join(POI_KEYS)
    q = (f'[out:json][timeout:60];nwr["name"][~"^({keys})$"~"."]'
         f'({s - 0.001:.5f},{w - 0.001:.5f},{n + 0.001:.5f},{e + 0.001:.5f});out center tags;')
    els = _post(OVERPASS, {"data": q}, timeout=90)["elements"]
    pois = []
    for el in els:
        t = el.get("tags", {})
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None:
            continue
        pois.append((Point(*TO_FT(lon, lat)), {
            "name": t.get("name", ""), "phone": t.get("phone") or t.get("contact:phone") or "",
            "website": t.get("website") or t.get("contact:website") or "",
            "email": t.get("email") or t.get("contact:email") or ""}))
    ptree = STRtree([p for p, _ in pois]) if pois else None
    updates, out = [], []
    for r in rows:
        biz = []
        if ptree is not None:
            zone = transform(TO_FT, shape(json.loads(r["geojson"]))).buffer(15)
            biz = [pois[j][1] for j in ptree.query(zone) if zone.contains(pois[j][0])]
        names = "; ".join(dict.fromkeys(b["name"] for b in biz if b["name"]))
        emails = "; ".join(dict.fromkeys(b["email"] for b in biz if b["email"]))
        phones = "; ".join(dict.fromkeys(b["phone"] for b in biz if b["phone"]))
        sites = "; ".join(dict.fromkeys(b["website"] for b in biz if b["website"]))
        updates.append((names, emails, phones, sites, r["id"]))
        out.append({"pin": r["pin"], "route": r["route"], "businesses": names, "emails": emails, "phones": phones, "websites": sites})
    c = db.conn()
    c.executemany("UPDATE roadside_hits SET businesses=?, emails=?, phones=?, websites=?, biz_checked=1 WHERE id=?", updates)
    c.commit()
    return out
