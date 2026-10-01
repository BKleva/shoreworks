# Outdoor Impact Ordinance Scout

Local app that crawls ordinance and master plan text for Monmouth, Ocean, Bergen and Morris counties (county-level),
then surfaces passages such as "billboards are prohibited" or "preserve scenic highways".

## Run
Double-click `run.bat` (installs dependencies, opens http://127.0.0.1:5057). Or: `pip install -r requirements.txt` then `python app.py`.

## How it works
- **Sources** (`scout/seeds.py`): official state (NJDOT, N.J.A.C. 16:41C), county planning board and municipal pages, loaded on first run. Add more on the *Sources & Crawl* tab.
- **Auto-refresh**: while the app is open it checks every 10 minutes and re-crawls any source not crawled in `OI_REFRESH_DAYS` (default 7). Unchanged pages are skipped by content hash. Set `OI_REFRESH_DAYS=0` to disable.
- **Crawler**: identifies itself, obeys robots.txt, 1 s delay per host, same-site links only (plus relevant PDFs).
- **Blocked sites**: eCode360, Municode, and some state pages return 403 to bots. The crawler logs this and does not work around it. Download the chapter or PDF and use the *Import* tab.
- **Findings** are keyword matches with surrounding text and a link to the source. They point you at language to read; they are not a legal determination.

## Data
Stored in `OutdoorImpactScoutData\scout.db` in your user folder (override with `OI_SCOUT_DATA`), outside the OneDrive and Netlify folders.

## Tests
`python -m pytest tests`
