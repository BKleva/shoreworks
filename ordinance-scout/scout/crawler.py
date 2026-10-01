"""Polite, bounded crawler for municipal code / master plan pages and PDFs.

Rules of the road: identifies itself, honours robots.txt, waits between requests to a
host, stays on the source's site (PDFs elsewhere are followed only if the link looks
relevant), and caps pages per source. Sites that refuse bots (HTTP 403, JS-only viewers)
are recorded as such rather than worked around; use the Import tab for those.
"""
import hashlib
import io
import json
import re
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from urllib import robotparser
from urllib.parse import urljoin, urldefrag, urlparse

import requests
from bs4 import BeautifulSoup

from . import analyzer
from .municipalities import town_for, town_index

UA = "OutdoorImpactScout/1.0 (land-use research; contact ben@shoreworksnj.com)"
DELAY = 1.0
MAX_BYTES = 60 * 1024 * 1024
MAX_PDF_PAGES = 600
FRESH_HOURS = 20   # a page fetched this recently is not re-requested (unless forced)
WORKERS = 4   # sources crawled at once; each host is still hit one request per DELAY

KEYWORDS = ["ordinance", "code", "sign", "zoning", "land-use", "landuse", "land_use", "master-plan",
            "masterplan", "master_plan", "planning", "reexam", "re-exam", "element", "circulation",
            "conservation", "chapter", "article", "development-reg", "regulations", "highway",
            "corridor", "billboard", "advertis", "scenic", "land use", "master plan"]
SKIP_EXT = re.compile(r"\.(jpe?g|png|gif|svg|webp|ico|css|js|zip|mp[34]|mov|avi|xlsx?|pptx?|docx?|dwg|kmz?)($|\?)", re.I)
BAD_HOST_HINT = re.compile(r"(facebook|twitter|instagram|youtube|linkedin|google)\.", re.I)


def score_link(url, text):
    s = (url + " " + (text or "")).lower()
    sc = sum(1 for k in KEYWORDS if k in s)
    if url.lower().split("?")[0].endswith(".pdf"):
        sc += 1
    return sc


def classify(url, title, text, forced="auto"):
    if forced and forced != "auto":
        return forced
    mp = r"master\s*-?plan|land\s+use\s+plan|circulation\s+(?:plan|element)|re-?examination|comprehensive\s+plan"
    od = r"ordinance|chapter\s+\d|article\s+[ivx\d]+|§|code\s+of|zoning|development\s+regulations|land\s+use\s+and\s+development"
    # URL + title first; body text only counts for real documents, not short link-hub pages
    for blob in (f"{url} {title}".lower(), text[:1500].lower() if len(text) >= 1500 else ""):
        if re.search(mp, blob):
            return "master_plan"
        if re.search(od, blob):
            return "ordinance"
    return "other"


class Stopped(Exception):
    pass


class Crawler:
    def __init__(self, db):
        self.db = db
        self.stop_event = threading.Event()
        self.state = {"running": False, "log": [], "pages": 0, "current": "", "sources_total": 0, "sources_done": 0}
        self._lock = threading.Lock()
        self._robots = {}
        self._last_hit = {}
        self._host_locks = {}
        self.force = False
        self._tls = threading.local()

    @property
    def sess(self):
        s = getattr(self._tls, "s", None)
        if s is None:
            s = self._tls.s = requests.Session()
            s.headers.update({"User-Agent": UA, "Accept": "text/html,application/pdf;q=0.9,*/*;q=0.5"})
        return s

    # ---- job control ----
    def log(self, msg):
        with self._lock:
            self.state["log"] = (self.state["log"] + [f"{time.strftime('%H:%M:%S')}  {msg}"])[-200:]

    def start(self, source_ids, force=False):
        with self._lock:
            if self.state["running"]:
                return False
            self.stop_event.clear()
            self.force = force
            self.state.update(running=True, log=[], pages=0, skipped=0, current="", sources_total=len(source_ids), sources_done=0)
        threading.Thread(target=self._run, args=(list(source_ids),), daemon=True).start()
        return True

    def stop(self):
        self.stop_event.set()

    def _run(self, source_ids):
        def work(sid):
            if self.stop_event.is_set():
                return
            src = self.db.one("SELECT * FROM sources WHERE id=?", (sid,))
            try:
                if src:
                    self.crawl_source(src)
            except Stopped:
                pass
            except Exception as e:  # keep the batch going
                self.log(f"ERROR on {src['label']}: {e}")
            finally:
                with self._lock:
                    self.state["sources_done"] += 1
        try:
            with ThreadPoolExecutor(max_workers=WORKERS) as pool:
                list(pool.map(work, source_ids))
        finally:
            self.state.update(running=False, current="")
            self.log("Stopped." if self.stop_event.is_set() else "Finished.")

    # ---- fetching ----
    def _allowed(self, url):
        host = urlparse(url).netloc
        rp = self._robots.get(host)
        if rp is None:
            rp = robotparser.RobotFileParser()
            try:
                r = self.sess.get(f"{urlparse(url).scheme}://{host}/robots.txt", timeout=10)
                rp.parse(r.text.splitlines() if r.status_code == 200 else [])
            except requests.RequestException:
                rp.parse([])
            self._robots[host] = rp
        return rp.can_fetch(UA, url)

    def _wait(self, url):
        host = urlparse(url).netloc
        with self._lock:
            lock = self._host_locks.setdefault(host, threading.Lock())
        with lock:  # one request per DELAY per host, even across parallel sources
            gap = time.time() - self._last_hit.get(host, 0)
            if gap < DELAY:
                time.sleep(DELAY - gap)
            self._last_hit[host] = time.time()

    def fetch(self, url, prior=None):
        """Return (kind, text, title, links, error, meta). kind: html|pdf|unchanged|None."""
        if self.stop_event.is_set():
            raise Stopped
        cached = None
        if prior and prior.get("links") is not None:
            cached = json.loads(prior["links"])
            if not self.force and prior.get("age_h") is not None and prior["age_h"] < FRESH_HOURS:
                return "unchanged", None, None, cached, None, {"fresh": True}   # no network at all
        if (prior and prior.get("status") != "ok" and not self.force
                and prior.get("age_h") is not None and prior["age_h"] < 72):
            return "unchanged", None, None, [], None, {"fresh": True}   # recent failure/block: don't hammer it
        if not self._allowed(url):
            return None, None, None, [], "robots.txt disallows this URL", {}
        self._wait(url)
        try:
            hdrs = {}
            if cached is not None and not self.force:
                if prior.get("etag"):
                    hdrs["If-None-Match"] = prior["etag"]
                if prior.get("last_modified"):
                    hdrs["If-Modified-Since"] = prior["last_modified"]
            r = self.sess.get(url, timeout=(10, 40), stream=True, allow_redirects=True, headers=hdrs)
        except requests.RequestException as e:
            return None, None, None, [], f"network error: {type(e).__name__}", {}
        if r.status_code == 304 and cached is not None:
            r.close()
            return "unchanged", None, None, cached, None, {}
        if r.status_code in (401, 403, 429):
            return None, None, None, [], f"HTTP {r.status_code}: site blocks automated access; use Import instead", {}
        if r.status_code >= 400:
            return None, None, None, [], f"HTTP {r.status_code}", {}
        ctype = r.headers.get("Content-Type", "").lower()
        meta = {"etag": r.headers.get("ETag"), "last_modified": r.headers.get("Last-Modified"),
                "size": int(r.headers["Content-Length"]) if r.headers.get("Content-Length", "").isdigit() else None}
        if meta["size"] and meta["size"] > MAX_BYTES:   # refuse from the header, before downloading anything
            r.close()
            return None, None, None, [], f"file too large (>{MAX_BYTES // 1024 // 1024}MB)", meta
        if prior and prior.get("status") == "ok" and not self.force and ("pdf" in ctype or url.lower().split("?")[0].endswith(".pdf")):
            same = ((meta["etag"] and meta["etag"] == prior.get("etag"))
                    or (meta["last_modified"] and meta["last_modified"] == prior.get("last_modified"))
                    or (not meta["etag"] and not meta["last_modified"] and meta["size"] and meta["size"] == prior.get("size")))
            if same:  # unchanged since last crawl: don't download or re-read the PDF
                r.close()
                return "unchanged", None, None, [], None, meta
        body = b""
        for chunk in r.iter_content(65536):
            body += chunk
            if len(body) > MAX_BYTES:
                return None, None, None, [], "file too large (>60MB)", meta
        if "pdf" in ctype or body[:5] == b"%PDF-":
            meta["size"] = meta["size"] or len(body)
            meta["bytes_hash"] = hashlib.sha1(body).hexdigest()
            if prior and not self.force and prior.get("bytes_hash") == meta["bytes_hash"]:
                return "unchanged", None, None, [], None, meta   # same bytes: skip the slow text extraction
            return "pdf", extract_pdf(body), url.rsplit("/", 1)[-1], [], None, meta
        if "html" in ctype or "xml" in ctype or not ctype:
            soup = BeautifulSoup(body.decode(r.encoding or "utf-8", errors="replace"), "lxml")
            title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
            links = [(urljoin(r.url, a["href"]), a.get_text(" ", strip=True)) for a in soup.find_all("a", href=True)]
            for t in soup(["script", "style", "noscript", "nav", "footer", "header"]):
                t.decompose()
            return "html", soup.get_text(" ", strip=True), title, links, None, meta
        if "text/plain" in ctype:
            return "html", body.decode("utf-8", errors="replace"), url, [], None, {}
        return None, None, None, [], f"unsupported type {ctype}", {}

    # ---- crawl one source ----
    def crawl_source(self, src):
        base = src["url"]
        host = urlparse(base).netloc.lower().removeprefix("www.")
        cap = int(src.get("max_pages") or 40)
        self.log(f"> {src['label']}  ({base})")
        queue = deque([(base, 0, 99)])
        seen, fetched = {urldefrag(base)[0]}, 0
        while queue and fetched < cap:
            queue = deque(sorted(queue, key=lambda x: (-x[2], x[1])))
            url, depth, _ = queue.popleft()
            self.state["current"] = url
            prior = self.db.one("SELECT status, etag, last_modified, size, links, bytes_hash,"
                                " (julianday('now') - julianday(fetched_at)) * 24 AS age_h"
                                " FROM documents WHERE url=? AND source_id=?",
                                (url, src["id"]))
            kind, text, title, links, err, meta = self.fetch(url, prior)
            fetched += 1
            with self._lock:
                self.state["pages"] += 1
            if kind == "unchanged":
                if not (meta or {}).get("fresh"):  # only a real server check resets the freshness clock
                    self.db.run("UPDATE documents SET fetched_at=CURRENT_TIMESTAMP, links=COALESCE(links, '[]')"
                                " WHERE url=? AND source_id=?", (url, src["id"]))
                with self._lock:
                    self.state["skipped"] = self.state.get("skipped", 0) + 1
                kind = "html" if links else "pdf"   # cached links keep the crawl fanning out
            elif err:
                self.log(f"  x {err}: {url}")
                self._save(src, url, title or "", "", "blocked" if ("blocks" in err or "robots" in err) else "error", err, {})
                continue
            elif text is None:
                pass
            elif len(text) < 200 and kind == "html" and re.search(r"javascript", text, re.I):
                self._save(src, url, title, text, "js_required", "Page needs JavaScript; use Import for this document", meta)
                self.log(f"  ! JS-only page: {url}")
            else:
                meta = dict(meta or {})
                meta["links"] = json.dumps([[l, t] for l, t in links[:500]]) if kind == "html" else "[]"
                n = self._save(src, url, title, text, "ok", None, meta)
                self.log(f"  + {kind.upper()} {len(text):,} chars, {n} findings: {(title or url)[:70]}")
            if kind == "html" and depth < 3:
                for link, atext in links:
                    link = urldefrag(link)[0]
                    p = urlparse(link)
                    if p.scheme not in ("http", "https") or link in seen or SKIP_EXT.search(link) or BAD_HOST_HINT.search(p.netloc):
                        continue
                    sc = score_link(link, atext)
                    same = p.netloc.lower().removeprefix("www.") == host
                    is_pdf = p.path.lower().endswith(".pdf")
                    if (same and (sc >= 1 or depth == 0)) or (not same and is_pdf and sc >= 2):
                        seen.add(link)
                        queue.append((link, depth + 1, sc))
        self.db.run("UPDATE sources SET last_crawled=CURRENT_TIMESTAMP WHERE id=?", (src["id"],))
        self.log(f"= done: {fetched} page(s) fetched")

    def _save(self, src, url, title, text, status, error, meta=None):
        h = hashlib.sha1(text.encode("utf-8", "ignore")).hexdigest()
        doc_type = classify(url, title, text, src.get("kind", "auto"))
        muni = src.get("muni_id")
        county = src.get("county") or (self.db.one("SELECT county FROM municipalities WHERE id=?", (muni,)) or {}).get("county")
        old = self.db.one("SELECT id, content_hash FROM documents WHERE url=? AND source_id=?", (url, src["id"]))
        if old and old["content_hash"] == h and status == "ok":
            n = self.db.one("SELECT COUNT(*) n FROM findings WHERE doc_id=?", (old["id"],))["n"]
            m = meta or {}
            self.db.run("UPDATE documents SET fetched_at=CURRENT_TIMESTAMP, etag=?, last_modified=?, size=?, links=?,"
                        " bytes_hash=COALESCE(?, bytes_hash) WHERE id=?",
                        (m.get("etag"), m.get("last_modified"), m.get("size"), m.get("links"), m.get("bytes_hash"), old["id"]))
            return n
        if old:
            self.db.run("DELETE FROM documents WHERE id=?", (old["id"],))
        return store_document(self.db, src["id"], muni, county, url, title, doc_type, text, status, error, h, meta)


def store_document(db, source_id, muni_id, county, url, title, doc_type, text, status="ok", error=None, h=None, meta=None):
    meta = meta or {}
    h = h or hashlib.sha1(text.encode("utf-8", "ignore")).hexdigest()
    cur = db.run(
        "INSERT INTO documents(source_id,muni_id,county,url,title,doc_type,content_hash,text,status,error,chars,"
        "etag,last_modified,size,links,bytes_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (source_id, muni_id, county, url, title, doc_type, h, text, status, error, len(text),
         meta.get("etag"), meta.get("last_modified"), meta.get("size"), meta.get("links"), meta.get("bytes_hash")))
    if status != "ok":
        return 0
    return save_findings(db, cur.lastrowid, muni_id, county, text, title, url)


def save_findings(db, doc_id, muni_id, county, text, title="", url=""):
    found = analyzer.analyze(text)
    # positions are offsets into the normalized text, so index the same normalized text
    idx = town_index(analyzer.normalize(text), county, title or "", url or "") if county else (None, [], [])
    c = db.conn()
    c.execute("DELETE FROM findings WHERE doc_id=?", (doc_id,))
    c.executemany(
        "INSERT INTO findings(doc_id,muni_id,county,category,rule,strong,near_billboard,position,snippet,match,township)"
        " VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        [(doc_id, muni_id, county, f["category"], f["rule"], f["strong"], f["near_billboard"],
          f["position"], f["snippet"], f["match"], town_for(idx, f["position"])) for f in found])
    c.commit()
    return len(found)


_PDFIUM_LOCK = threading.Lock()


def extract_pdf(data: bytes) -> str:
    """pdfium is ~6-10x faster than pypdf; pypdf remains as a fallback for files pdfium rejects."""
    try:
        import pypdfium2 as pdfium
        with _PDFIUM_LOCK:  # pdfium is not thread-safe; parallel use crashes the process
            doc = pdfium.PdfDocument(data)
            try:
                parts = []
                for i in range(min(len(doc), MAX_PDF_PAGES)):
                    page = doc[i]
                    tp = page.get_textpage()
                    parts.append(tp.get_text_range())
                    tp.close()
                    page.close()
                return "\n".join(parts)
            finally:
                doc.close()
    except Exception:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        parts = []
        for i, page in enumerate(reader.pages):
            if i >= MAX_PDF_PAGES:
                break
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                continue
        return "\n".join(parts)
