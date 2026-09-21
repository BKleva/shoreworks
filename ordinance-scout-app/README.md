# Outdoor Impact Ordinance Scout

A standalone app — its own repo, own Netlify site, own domain. Not part
of the shoreworks or outdoor-impact marketing site codebases.

## What it does

- **Real login** (`netlify/functions/ordinance-login.mjs`, `ordinance-session.mjs`,
  `_auth.mjs`): server-side credential check against `ADMIN_USER`/`ADMIN_PASS`
  env vars, HMAC-signed session token. No credential lives in this repo.
- **Real crawler** (`crawl-run.mjs`, `dca-directory.mjs`, `web-search.mjs`,
  `phrases.mjs`): finds and reads real ordinance pages (eCode360, Municode,
  American Legal — all free, no login) and master plan PDFs across
  Monmouth, Ocean, Bergen, and Morris counties, searching for
  billboard-prohibition and scenic-view/corridor language.
- **Scheduled runs** (`crawl-scheduled.mjs`): runs automatically on a
  cron schedule (weekly by default — edit the `config.schedule` in that
  file), stores results in Netlify Blobs.
- **On-demand refresh** (`crawl-now-background.mjs`): the app's
  "Refresh Results" button, admin-only, triggers a real crawl run
  immediately instead of waiting for the schedule.
- **The app itself** (`index.html`): the 5-click gate + login you've
  already seen, now loading real data from `/api/ordinance-data`
  instead of hardcoded sample rows.

## Setup — what only you can do

1. **Create the GitHub repo.** I don't have permission to create new
   repos myself (tried once, got a 403). Create an empty one at
   github.com/new, tell me the name, and I'll push everything here
   into it.
2. **Create the Netlify site.** Add new site → Import an existing
   project → point it at that repo, base directory blank/root (this
   *is* the whole repo, unlike the earlier outdoor-impact attempt).
3. **Set environment variables** on that Netlify site (Site settings →
   Environment variables):
   - `ADMIN_USER` — the login username
   - `ADMIN_PASS` — the login password
   - `ADMIN_SECRET` — any long random string (signs the session token;
     I can generate one)
   - `BRAVE_SEARCH_API_KEY` — from api.search.brave.com (self-serve,
     ~5 min, needs a card on file; their monthly credit covers roughly
     1,000 queries, comfortably enough for a weekly four-county crawl)
4. **Optional:** point a custom domain at the new Netlify site.

Once those are set, the scheduled crawl starts running on its own, and
the sign-in flow works for real.

## What's verified vs. what needs a live check

Everything in `crawl-run.mjs`'s phrase-matching approach was validated
against real NJ ordinance and master plan text — see the actual crawl I
ran by hand across all 17 sample towns for concrete examples (Wall
Township's outright prohibition, Stafford Township's prohibition later
overturned in court, Fort Lee's Palisades Scenic Byway connection, and
so on).

What I could **not** verify from this coding environment, because its
network policy blocks outbound requests to arbitrary sites entirely
(confirmed against nj.gov and ecode360.com directly): the DCA
directory's exact spreadsheet column names in `dca-directory.mjs`, and
whether the two Netlify Function behaviors this design leans on —
scheduled function execution time limits, and the `-background`
filename suffix convention for `crawl-now-background.mjs` — behave
exactly as documented on your current Netlify plan. All of that needs
one real test run once this is deployed; the code is structured so
fixing a mismatch (a column name, a timeout) is a small, targeted
edit, not a redesign.

## eCode360 API (optional, not required)

`ecode360.mjs` is an unused-by-default file for eCode360's real
developer API, which returns more structured results than the
search-and-scrape path this app uses by default. Getting access isn't
self-serve — General Code (the company) needs to grant it directly.
Not needed to get started; worth revisiting later if search-and-scrape
proves too imprecise.
