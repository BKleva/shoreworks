# Balsley Losco Real Estate — new website (concept build)

Static, pre-rendered redesign of https://www.blhomes.com/ (Balsley Losco Real Estate, Northfield & Somers Point NJ).
Every page is real HTML (no JS needed to read content) so search engines index it fully.

## Build & preview
```
python tools/build.py          # regenerates ./public (≈133 indexable pages + sitemap.xml + robots.txt)
python -m http.server 8199 --directory public
```
Content lives in `tools/data.py` (towns, listings, guides, FAQs, offices) and `tools/agents.json` (76-agent roster).
Layout/pages are in `tools/lib.py` and `tools/build.py`; styles/JS in `public/assets/`.

## What's included
- **Public:** home, search (filters, sort, save search, favorites), 12 town landing pages, condo / waterfront / open-house / rental landing pages, listing detail pages, agent directory + 76 profiles, buy hub, mortgage calculator, pre-approval, sell hub, free home valuation, about, offices (+2 pages), careers, commercial, contact, 7 buyer/seller guides, legal pages, HTML site map.
- **Portals:** client account (`/account/` — saved homes, saved searches, alert prefs) and agent portal (`/agent-portal/` — leads, listings, open houses, tools). Both are noindex demo UIs backed by localStorage.
- **SEO:** unique title/description/canonical per page, Open Graph + Twitter cards, JSON-LD (RealEstateAgent + LocalBusiness with both offices, WebSite SearchAction, BreadcrumbList, FAQPage, ItemList, RealEstateListing, Article, agent profiles, Place), semantic headings, crawlable internal links, `sitemap.xml`, `robots.txt`, 301 redirect map from old `.php` URLs (`netlify.toml`).

## Before launch (placeholders to replace)
1. **Listings are demo data.** Connect the MLS/IDX feed (the old site's data comes via Cape May County MLS and others) and remove the "demo listings" notes. Listing JSON-LD is generated from the same data — keep it in sync with the feed.
2. **Legal text.** `/privacy/`, `/terms/` are drafts; use the brokerage's approved language and required MLS disclaimers (footer `LEGAL` in `tools/lib.py`).
3. **Forms** use Netlify Forms (`data-netlify`). Set notification emails in Netlify. Account/agent portals need a real auth + CRM backend.
4. **Agent photos** hot-link from the existing site's CDN (with initials fallback). Copy them into `public/assets/agents/` before the old site is retired. Agent bios/contact details were not copied — add per-agent bios and direct lines/emails with each agent's consent.
5. **Guides & town copy** are original, general information — have the broker review for accuracy (fees, programs and rules change).
6. Add a Google Business Profile / Search Console property and submit `sitemap.xml`.
