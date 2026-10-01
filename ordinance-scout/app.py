"""Outdoor Impact Ordinance Scout. Run:  python app.py  then open http://127.0.0.1:5057"""
import csv
import io
import json
import os
import re
import threading
import time

from flask import Flask, Response, jsonify, render_template, request

from scout import analyzer
from scout.crawler import Crawler, classify, extract_pdf, save_findings, store_document
from scout.db import DB, data_dir
from scout.municipalities import COUNTIES

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024
db = DB()
crawler = Crawler(db)


def _seed_once():
    from scout.seeds import SEEDS
    marker = data_dir() / ".seeded"
    done = set(marker.read_text().splitlines()) if marker.exists() else set()
    for scope, label, url, kind, mp in SEEDS:
        if url in done:
            continue
        done.add(url)
        muni_id = county = None
        if ":" in scope:
            c, name = scope.split(":")
            m = db.one("SELECT id FROM municipalities WHERE county=? AND name=?", (c, name))
            muni_id = m["id"] if m else None
        else:
            county = scope
        db.run("INSERT INTO sources(muni_id,county,label,url,kind,max_pages) VALUES(?,?,?,?,?,?)",
               (muni_id, county, label, url, kind, mp))
    marker.write_text(chr(10).join(sorted(done)))


_seed_once()

SCOPES = COUNTIES
REFRESH_DAYS = float(os.environ.get("OI_REFRESH_DAYS", 7))


def _scheduler():
    """Re-crawl any source never crawled, or not crawled within REFRESH_DAYS, while the app is open."""
    while True:
        try:
            if not crawler.state["running"]:
                due = db.q("SELECT id FROM sources WHERE last_crawled IS NULL OR "
                           "julianday('now') - julianday(last_crawled) >= ?", (REFRESH_DAYS,))
                if due:
                    crawler.start([r["id"] for r in due])
        except Exception as e:  # never let the scheduler die
            crawler.log(f"scheduler error: {e}")
        time.sleep(600)


def start_scheduler():
    if REFRESH_DAYS > 0:
        threading.Thread(target=_scheduler, daemon=True).start()

STATUS_ORDER = ["prohibited", "mixed", "restricted", "scenic", "permitted", "no_signal", "no_data"]


def _err(msg, code=400):
    return jsonify(error=msg), code


@app.route("/")
def index():
    return render_template("index.html", counties=COUNTIES, categories=analyzer.CATEGORY_LABELS,
                           refresh_days=int(REFRESH_DAYS) if REFRESH_DAYS == int(REFRESH_DAYS) else REFRESH_DAYS)


# ---------- overview ----------
@app.get("/api/overview")
def overview():
    county = request.args.get("county")
    munis = db.q("SELECT * FROM municipalities" + (" WHERE county=?" if county else "") + " ORDER BY county, name",
                 (county,) if county else ())
    docs, finds = {}, {}
    for d in db.q("SELECT muni_id, doc_type, status FROM documents WHERE muni_id IS NOT NULL"):
        docs.setdefault(d["muni_id"], []).append(d)
    for f in db.q("SELECT muni_id, category, strong, near_billboard FROM findings WHERE muni_id IS NOT NULL"):
        finds.setdefault(f["muni_id"], []).append(f)
    srcs = {r["muni_id"]: r["n"] for r in db.q("SELECT muni_id, COUNT(*) n FROM sources WHERE muni_id IS NOT NULL GROUP BY muni_id")}
    rows = []
    for m in munis:
        d = docs.get(m["id"], [])
        usable = [x for x in d if x["status"] == "ok"]
        status, reason = analyzer.rollup(finds.get(m["id"], []), doc_types=[x["doc_type"] for x in usable])
        rows.append({
            **m, "status": status, "reason": reason,
            "sources": srcs.get(m["id"], 0),
            "ordinances": sum(1 for x in usable if x["doc_type"] == "ordinance"),
            "master_plans": sum(1 for x in usable if x["doc_type"] == "master_plan"),
            "blocked": sum(1 for x in d if x["status"] != "ok"),
            "counts": {c: sum(1 for f in finds.get(m["id"], []) if f["category"] == c) for c in analyzer.CATEGORY_LABELS},
        })
    rows.sort(key=lambda r: (STATUS_ORDER.index(r["status"]), r["county"], r["name"]))
    county_level = []
    for c in SCOPES:
        f = db.q("SELECT category, strong, near_billboard FROM findings WHERE muni_id IS NULL AND county=?", (c,))
        ndocs = db.one("SELECT COUNT(*) n FROM documents WHERE muni_id IS NULL AND county=? AND status='ok'", (c,))["n"]
        st, why = analyzer.rollup(f, doc_types=["x"] * ndocs)
        county_level.append({"county": c, "docs": ndocs, "status": st, "reason": why})
    summary = {s: sum(1 for r in rows if r["status"] == s) for s in STATUS_ORDER}
    return jsonify(rows=rows, county_level=county_level, summary=summary)


# ---------- findings / drill-down ----------
def _finding_filters(args):
    where, params = ["1=1"], []
    for key, col in (("county", "f.county"), ("muni", "f.muni_id"), ("category", "f.category"), ("doc_type", "d.doc_type")):
        if args.get(key):
            where.append(f"{col}=?")
            params.append(args[key])
    if args.get("town"):
        where.append("f.township=?")
        params.append(args["town"])
    if args.get("near") == "1":
        where.append("f.near_billboard=1")
    if args.get("strong") == "1":
        where.append("f.strong=1")
    if args.get("q"):
        where.append("f.snippet LIKE ?")
        params.append(f"%{args['q']}%")
    return " AND ".join(where), params


FIND_SQL = ("SELECT f.township, f.id, f.category, f.rule, f.strong, f.near_billboard, f.snippet, f.county, f.muni_id,"
            " m.name muni_name, m.kind muni_kind, d.id doc_id, d.url, d.title, d.doc_type"
            " FROM findings f JOIN documents d ON d.id=f.doc_id LEFT JOIN municipalities m ON m.id=f.muni_id WHERE ")


@app.get("/api/findings")
def findings():
    where, params = _finding_filters(request.args)
    limit = min(int(request.args.get("limit", 100)), 500)
    offset = int(request.args.get("offset", 0))
    order = (" ORDER BY CASE f.category WHEN 'prohibited' THEN 0 WHEN 'scenic' THEN 1 WHEN 'regulated' THEN 2"
             " WHEN 'permitted' THEN 3 ELSE 4 END, f.strong DESC, f.near_billboard DESC, m.name")
    rows = db.q(FIND_SQL + where + order + " LIMIT ? OFFSET ?", params + [limit, offset])
    total = db.one("SELECT COUNT(*) n FROM findings f JOIN documents d ON d.id=f.doc_id WHERE " + where, params)["n"]
    return jsonify(rows=rows, total=total)


@app.get("/api/townships")
def townships():
    where, params = ["township IS NOT NULL"], []
    if request.args.get("county"):
        where.append("county=?")
        params.append(request.args["county"])
    return jsonify(rows=db.q("SELECT township, county, COUNT(*) n, SUM(category='prohibited') prohibited,"
                             " SUM(category='permitted') permitted FROM findings WHERE " + " AND ".join(where) +
                             " GROUP BY township, county ORDER BY county, township", params))


@app.get("/api/muni/<int:mid>")
def muni_detail(mid):
    m = db.one("SELECT * FROM municipalities WHERE id=?", (mid,))
    if not m:
        return _err("not found", 404)
    docs = db.q("SELECT id, url, title, doc_type, status, error, chars, fetched_at,"
                " (SELECT COUNT(*) FROM findings WHERE doc_id=documents.id) findings"
                " FROM documents WHERE muni_id=? ORDER BY doc_type, title", (mid,))
    f = db.q(FIND_SQL + "f.muni_id=? ORDER BY f.category, f.strong DESC", (mid,))
    status, reason = analyzer.rollup(f, doc_types=[d["doc_type"] for d in docs if d["status"] == "ok"])
    sources = db.q("SELECT * FROM sources WHERE muni_id=?", (mid,))
    return jsonify(muni=m, docs=docs, findings=f, status=status, reason=reason, sources=sources)


@app.get("/api/search")
def search():
    q = (request.args.get("q") or "").strip()
    if len(q) < 3:
        return _err("Enter at least 3 characters")
    where, params = ["d.status='ok'", "d.text LIKE ?"], [f"%{q}%"]
    for key, col in (("county", "d.county"), ("muni", "d.muni_id"), ("doc_type", "d.doc_type")):
        if request.args.get(key):
            where.append(f"{col}=?")
            params.append(request.args[key])
    docs = db.q("SELECT d.id, d.url, d.title, d.doc_type, d.county, d.text, m.name muni_name, m.kind muni_kind"
                " FROM documents d LEFT JOIN municipalities m ON m.id=d.muni_id WHERE " + " AND ".join(where) +
                " LIMIT 300", params)
    pat = re.compile(re.escape(q).replace(r"\ ", r"\s+"), re.I)
    out = []
    for d in docs:
        text = analyzer.normalize(d.pop("text"))
        hits = []
        for m in pat.finditer(text):
            hits.append(analyzer._snippet(text, m.start(), m.end()))
            if len(hits) >= 8:
                break
        if hits:
            out.append({**d, "hits": hits})
    return jsonify(rows=out, query=q)


# ---------- sources ----------
@app.get("/api/sources")
def list_sources():
    return jsonify(rows=db.q(
        "SELECT s.*, m.name muni_name, m.kind muni_kind, COALESCE(m.county, s.county) scope_county,"
        " (SELECT COUNT(*) FROM documents WHERE source_id=s.id) docs FROM sources s"
        " LEFT JOIN municipalities m ON m.id=s.muni_id ORDER BY scope_county, m.name, s.label"))


@app.get("/api/municipalities")
def municipalities():
    return jsonify(rows=db.q("SELECT * FROM municipalities ORDER BY county, name"))


@app.post("/api/sources")
def add_source():
    d = request.get_json(force=True)
    url = (d.get("url") or "").strip()
    if not re.match(r"^https?://[^\s]+$", url):
        return _err("Enter a full http(s) URL")
    muni_id = d.get("muni_id") or None
    county = d.get("county") or None
    if not muni_id and county not in SCOPES:
        return _err("Pick a municipality or a county")
    label = (d.get("label") or url)[:120]
    kind = d.get("kind") if d.get("kind") in ("auto", "ordinance", "master_plan") else "auto"
    cur = db.run("INSERT INTO sources(muni_id,county,label,url,kind,max_pages) VALUES(?,?,?,?,?,?)",
                 (muni_id, None if muni_id else county, label, url, kind, min(int(d.get("max_pages") or 40), 300)))
    return jsonify(id=cur.lastrowid)


@app.delete("/api/sources/<int:sid>")
def delete_source(sid):
    db.run("DELETE FROM sources WHERE id=?", (sid,))
    return jsonify(ok=True)


# ---------- crawl control ----------
@app.post("/api/crawl")
def crawl():
    d = request.get_json(force=True) or {}
    if d.get("source_ids"):
        ids = [int(i) for i in d["source_ids"]]
    elif d.get("muni_id"):
        ids = [r["id"] for r in db.q("SELECT id FROM sources WHERE muni_id=?", (d["muni_id"],))]
    elif d.get("county"):
        ids = [r["id"] for r in db.q(
            "SELECT s.id FROM sources s LEFT JOIN municipalities m ON m.id=s.muni_id"
            " WHERE COALESCE(m.county, s.county)=?", (d["county"],))]
    else:
        ids = [r["id"] for r in db.q("SELECT id FROM sources")]
    if not ids:
        return _err("No sources to crawl. Add source URLs first.")
    if not crawler.start(ids, force=bool(d.get("force"))):
        return _err("A crawl is already running", 409)
    return jsonify(started=len(ids))


@app.get("/api/crawl/status")
def crawl_status():
    return jsonify(crawler.state)


@app.post("/api/crawl/stop")
def crawl_stop():
    crawler.stop()
    return jsonify(ok=True)


@app.post("/api/rescan")
def rescan():
    """Re-run the rules over stored text (after rule changes) without re-downloading."""
    n = 0
    for d in db.q("SELECT id, muni_id, county, title, url FROM documents WHERE status='ok'"):
        text = db.one("SELECT text FROM documents WHERE id=?", (d["id"],))["text"]
        save_findings(db, d["id"], d["muni_id"], d["county"], text, d["title"], d["url"])
        n += 1
    return jsonify(rescanned=n)


# ---------- manual import (for sites that block crawlers, e.g. eCode360 PDFs) ----------
@app.post("/api/import")
def import_docs():
    muni_id = request.form.get("muni_id") or None
    county = request.form.get("county") or None
    kind = request.form.get("kind", "auto")
    if not muni_id and county not in SCOPES:
        return _err("Pick a municipality or county")
    if muni_id:
        county = (db.one("SELECT county FROM municipalities WHERE id=?", (muni_id,)) or {}).get("county")
    added = []
    pasted = (request.form.get("text") or "").strip()
    files = request.files.getlist("files")
    if pasted:
        title = request.form.get("title") or "Pasted text"
        n = store_document(db, None, muni_id, county, f"pasted:{title}", title,
                           classify("", title, pasted, kind), pasted)
        added.append({"name": title, "findings": n})
    for f in files:
        raw = f.read()
        name = f.filename or "upload"
        try:
            if name.lower().endswith(".pdf") or raw[:5] == b"%PDF-":
                text = extract_pdf(raw)
            elif name.lower().endswith((".htm", ".html")):
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(raw.decode("utf-8", errors="replace"), "lxml")
                for t in soup(["script", "style"]):
                    t.decompose()
                text = soup.get_text(" ", strip=True)
            else:
                text = raw.decode("utf-8", errors="replace")
        except Exception as e:
            added.append({"name": name, "error": f"could not read: {e}"})
            continue
        if len(text.strip()) < 50:
            added.append({"name": name, "error": "no extractable text (scanned PDF?)"})
            continue
        n = store_document(db, None, muni_id, county, f"file:{name}", name, classify("", name, text, kind), text)
        added.append({"name": name, "findings": n})
    if not added:
        return _err("Attach a file or paste text")
    return jsonify(added=added)


@app.delete("/api/docs/<int:did>")
def delete_doc(did):
    db.run("DELETE FROM documents WHERE id=?", (did,))
    return jsonify(ok=True)


# ---------- export ----------
@app.get("/api/export.csv")
def export_csv():
    where, params = _finding_filters(request.args)
    rows = db.q(FIND_SQL + where + " ORDER BY f.county, m.name, f.category", params)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["County", "Township", "Category", "Rule", "Explicit wording", "Near billboard text", "Doc type",
                "Document", "URL", "Passage"])
    for r in rows:
        w.writerow([r["county"], r["township"] or f"{r['muni_name'] or ''} {r['muni_kind'] or ''}".strip() or "(county-level, no town named)",
                    analyzer.CATEGORY_LABELS[r["category"]], r["rule"], "yes" if r["strong"] else "",
                    "yes" if r["near_billboard"] else "", r["doc_type"], r["title"], r["url"], r["snippet"]])
    return Response(buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=outdoor-impact-ordinance-findings.csv"})


# ---------- roadside map: parcels along state highways ----------
from scout import roadside  # noqa: E402

roadside_job = roadside.RoadsideJob(db)


@app.get("/api/roadside/config")
def rs_config():
    return jsonify(counties=COUNTIES, classes=roadside.CLASSES, default_classes=roadside.DEFAULT_CLASSES, depth=RS_DEPTH_FT)


@app.get("/api/roadside/routes")
def rs_routes():
    county = request.args.get("county")
    if county not in COUNTIES:
        return _err("Pick one of the four counties")
    try:
        return jsonify(rows=roadside.list_routes(county))
    except Exception as e:
        return _err(f"Could not load highways: {e}", 502)


@app.get("/api/roadside/roads")
def rs_roads():
    county = request.args.get("county")
    if county not in COUNTIES:
        return _err("Pick one of the four counties")
    refs = [r for r in request.args.get("refs", "").split(",") if r]
    return jsonify(roadside.roads_geojson(county, refs))


@app.post("/api/roadside/search")
def rs_search():
    d = request.get_json(force=True)
    county = d.get("county")
    if county not in COUNTIES:
        return _err("Pick one of the four counties")
    refs = d.get("refs") or [r["ref"] for r in roadside.list_routes(county)]
    max_ft = RS_DEPTH_FT   # the distance box on the page is a display filter; a refresh always loads the full depth
    classes = [c for c in (d.get("classes") or roadside.DEFAULT_CLASSES) if c in roadside.CLASSES]
    if not roadside_job.start(county, refs, max_ft, classes, bool(d.get("businesses"))):
        return _err("A roadside search is already running", 409)
    return jsonify(started=len(refs))


RS_REFRESH_DAYS = float(os.environ.get("OI_RS_REFRESH_DAYS", 2))
RS_DEPTH_FT = int(os.environ.get("OI_RS_DEPTH_FT", 300))   # how far back from the road edge every refresh loads


def _rs_scheduler():
    """Keep the roadside parcels fresh: any county never loaded, or not refreshed in RS_REFRESH_DAYS, is reloaded."""
    time.sleep(5)
    marker = data_dir() / ".roadside_loaded"   # older builds recorded loaded counties here
    if marker.exists():
        for c in marker.read_text().split():
            db.run("INSERT OR IGNORE INTO roadside_meta(county, refreshed_at) VALUES(?, datetime('now'))", (c,))
        marker.unlink()
    while True:
        for county in COUNTIES:
            try:
                due = db.one("SELECT 1 FROM roadside_meta WHERE county=? AND julianday('now') - julianday(refreshed_at) < ?",
                             (county, RS_REFRESH_DAYS)) is None
                if not due:
                    continue
                while roadside_job.state["running"]:
                    time.sleep(5)
                refs = [r["ref"] for r in roadside.list_routes(county)]
                roadside_job.start(county, refs, RS_DEPTH_FT, roadside.DEFAULT_CLASSES, False)
                time.sleep(2)
                while roadside_job.state["running"]:
                    time.sleep(5)
            except Exception as e:
                roadside_job.log(f"auto-refresh of {county} failed: {e}")
        time.sleep(1800)


@app.get("/api/roadside/counts")
def rs_counts():
    return jsonify(refresh_days=RS_REFRESH_DAYS, rows=db.q(
        "SELECT h.county, COUNT(DISTINCT h.pin) n, m.refreshed_at FROM roadside_hits h "
        "LEFT JOIN roadside_meta m ON m.county = h.county GROUP BY h.county"))


@app.post("/api/roadside/stop")
def rs_stop():
    roadside_job.stop()
    return jsonify(ok=True)


def _dedupe(rows):
    """A parcel on two highways is one lead: keep the nearest edge distance and list every highway."""
    best = {}
    for r in rows:
        k = r["pin"]
        if k not in best:
            best[k] = dict(r, routes=[r["route"]])
            continue
        b = best[k]
        b["routes"].append(r["route"])
        if r["edge_min_ft"] < b["edge_min_ft"]:
            keep = b["routes"]
            b.update(r)
            b["routes"] = keep
        for f in ("businesses", "emails", "phones", "websites"):
            if not b[f] and r[f]:
                b[f] = r[f]
        b["biz_checked"] = max(b.get("biz_checked") or 0, r.get("biz_checked") or 0)
    for b in best.values():
        b["route"] = ", ".join(dict.fromkeys(b.pop("routes")))
    return list(best.values())


@app.get("/api/roadside/status")
def rs_status():
    return jsonify(roadside_job.state)


def _rs_query(args):
    where, params = ["edge_min_ft <= ?", "edge_min_ft >= ?"], [float(args.get("max_ft") or 300), float(args.get("min_ft") or 0)]
    if args.get("county"):
        where.append("county=?")
        params.append(args["county"])
    if args.get("refs"):
        rs = [r for r in args["refs"].split(",") if r]
        where.append("route IN (" + ",".join("?" * len(rs)) + ")")
        params += rs
    cls = [c for c in (args.get("classes") or "").split(",") if c in roadside.CLASSES]
    if cls:
        where.append("prop_class IN (" + ",".join("?" * len(cls)) + ")")
        params += cls
    if args.get("has_email") == "1":
        where.append("emails != ''")
    if args.get("q"):
        where.append("(prop_loc LIKE ? OR businesses LIKE ? OR mail_street LIKE ? OR muni LIKE ?)")
        params += [f"%{args['q']}%"] * 4
    return " AND ".join(where), params


@app.get("/api/roadside/results")
def rs_results():
    where, params = _rs_query(request.args)
    rows = _dedupe(db.q("SELECT * FROM roadside_hits WHERE " + where + " ORDER BY county, muni, route, edge_min_ft", params))
    total = len(rows)
    rows = rows[:6000]
    feats = []
    for r in rows:
        g = r.pop("geojson")
        feats.append({"type": "Feature", "geometry": json.loads(g), "properties": r})
    return jsonify(type="FeatureCollection", features=feats, total=total, shown=len(rows))


def _norm(x):
    return re.sub(r"[^A-Z0-9]", "", (x or "").upper())


@app.get("/api/roadside/export.csv")
def rs_export():
    where, params = _rs_query(request.args)
    rows = _dedupe(db.q("SELECT * FROM roadside_hits WHERE " + where + " ORDER BY county, muni, route, edge_min_ft", params))
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["County", "Town", "Highway", "Property address", "Class", "Class description", "Business name(s) on/near parcel",
                "Email(s)", "Phone(s)", "Website(s)", "Owner name (blank in public data)", "Tax bill mailing address: street", "Tax bill mailing address: city / state", "Tax bill mailing address: ZIP", "Tax bill address is the same as the property?", "Tax bill mailing address (one line)", "Acres",
                "Feet from road edge (nearest)", "Feet from road edge (farthest)", "Block/Lot (PAMS PIN)", "Latitude", "Longitude"])
    for r in rows:
        w.writerow([r["county"], r["muni"], r["route"], r["prop_loc"], r["prop_class"], roadside.CLASSES.get(r["prop_class"], ""),
                    r["businesses"] or r["fac_name"] or "", r["emails"], r["phones"], r["websites"], r["owner_name"],
                    r["mail_street"], r["mail_city_state"], r["mail_zip"],
                    "Yes" if _norm(r["mail_street"]) and _norm(r["mail_street"]) == _norm(r["prop_loc"]) else "No",
                    ", ".join(x for x in (r["mail_street"], r["mail_city_state"], r["mail_zip"]) if x),
                    r["acres"], r["edge_min_ft"], r["edge_max_ft"], r["pin"], round(r["lat"], 6), round(r["lon"], 6)])
    return Response(buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=roadside-parcels.csv"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5057))
    print(f"Outdoor Impact Ordinance Scout -> http://127.0.0.1:{port}   (data: {data_dir()})")
    start_scheduler()
    threading.Thread(target=_rs_scheduler, daemon=True).start()
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
