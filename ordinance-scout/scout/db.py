import os
import sqlite3
import threading
from pathlib import Path

from .municipalities import roster


def data_dir() -> Path:
    """Data lives outside the website folder so it is never deployed with the site."""
    env = os.environ.get("OI_SCOUT_DATA")
    if env:
        p = Path(env)
    else:
        # Home folder, not %LOCALAPPDATA%: Microsoft Store Python silently redirects AppData writes.
        p = Path.home() / "OutdoorImpactScoutData"
    p.mkdir(parents=True, exist_ok=True)
    return p


SCHEMA = """
CREATE TABLE IF NOT EXISTS municipalities(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, county TEXT NOT NULL, kind TEXT DEFAULT '',
  UNIQUE(name, county, kind));
CREATE TABLE IF NOT EXISTS sources(
  id INTEGER PRIMARY KEY, muni_id INTEGER REFERENCES municipalities(id) ON DELETE CASCADE,
  county TEXT, label TEXT NOT NULL, url TEXT NOT NULL, kind TEXT DEFAULT 'auto',
  max_pages INTEGER DEFAULT 40, created_at TEXT DEFAULT CURRENT_TIMESTAMP, last_crawled TEXT);
CREATE TABLE IF NOT EXISTS documents(
  id INTEGER PRIMARY KEY, source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
  muni_id INTEGER REFERENCES municipalities(id) ON DELETE CASCADE, county TEXT,
  url TEXT NOT NULL, title TEXT, doc_type TEXT DEFAULT 'other', content_hash TEXT, text TEXT,
  status TEXT DEFAULT 'ok', error TEXT, chars INTEGER DEFAULT 0,
  fetched_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS findings(
  id INTEGER PRIMARY KEY, doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  muni_id INTEGER, county TEXT, category TEXT NOT NULL, rule TEXT, strong INTEGER DEFAULT 0,
  near_billboard INTEGER DEFAULT 1, position INTEGER, snippet TEXT, match TEXT);
CREATE INDEX IF NOT EXISTS ix_find_muni ON findings(muni_id, category);
CREATE INDEX IF NOT EXISTS ix_doc_muni ON documents(muni_id);
CREATE INDEX IF NOT EXISTS ix_doc_url ON documents(url, source_id);
"""


class DB:
    def __init__(self, path=None):
        self.path = str(path or (data_dir() / "scout.db"))
        self._local = threading.local()
        c = self.conn()
        c.executescript(SCHEMA)
        for col, typ in (("etag", "TEXT"), ("last_modified", "TEXT"), ("size", "INTEGER"), ("links", "TEXT"), ("bytes_hash", "TEXT")):
            try:
                c.execute(f"ALTER TABLE documents ADD COLUMN {col} {typ}")
            except sqlite3.OperationalError:
                pass  # already migrated
        try:
            c.execute("ALTER TABLE findings ADD COLUMN township TEXT")
        except sqlite3.OperationalError:
            pass
        c.execute("CREATE INDEX IF NOT EXISTS ix_find_town ON findings(township)")
        if not c.execute("SELECT 1 FROM municipalities LIMIT 1").fetchone():
            c.executemany("INSERT OR IGNORE INTO municipalities(name,county,kind) VALUES(?,?,?)",
                          list(roster()))
            c.commit()

    def conn(self):
        c = getattr(self._local, "c", None)
        if c is None:
            c = sqlite3.connect(self.path, timeout=30)
            c.row_factory = sqlite3.Row
            c.execute("PRAGMA foreign_keys=ON")
            c.execute("PRAGMA journal_mode=WAL")
            self._local.c = c
        return c

    def q(self, sql, args=()):
        return [dict(r) for r in self.conn().execute(sql, args).fetchall()]

    def one(self, sql, args=()):
        r = self.conn().execute(sql, args).fetchone()
        return dict(r) if r else None

    def run(self, sql, args=()):
        c = self.conn()
        cur = c.execute(sql, args)
        c.commit()
        return cur
