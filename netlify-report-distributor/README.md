# Netlify Traffic Report Distributor

Emails each client a monthly HTML report of their Netlify site traffic (pageviews, unique visitors, top pages, top referrers), pulled from Netlify's Analytics add-on. Add/remove clients from a small password-gated admin page.

## How it works

- `admin/index.html` — password-gated admin page (Shore Works branded) to add, edit, and remove clients (name, email, Netlify Site ID) and send an individual client's report on demand.
- `netlify/functions/clients.js` — CRUD API backing the admin page (GET/POST/PUT/DELETE), stores the client list in Netlify Blobs.
- `netlify/functions/send-reports.js` — **scheduled function** (see `netlify.toml`, cron `0 13 1 * *` — 1st of the month, 9am ET). Emails every client their prior-month report.
- `netlify/functions/send-reports-now.js` — same logic, triggered manually from the admin page's per-client **Send** button. Pass `{ client_id }` in the POST body to send just that one client; omit it to send to everyone (not exposed in the UI, but still supported for scripting).
- `lib/netlify-analytics.js` — calls Netlify's **unofficial, undocumented** Analytics API (`analytics.services.netlify.com`, `v2` endpoints — the old `v1` pageviews/visitors endpoints were retired by Netlify). This is not a supported integration; if Netlify changes it, this will need updating.
- `lib/email-template.js` — builds the report HTML.
- `lib/run-reports.js` — shared "for each client, pull metrics, send email" logic.

## Deploy setup

1. **Create a new Netlify site** from this directory (separate site, like `review-collector` / `twin-cleans`), or `netlify deploy` from here directly.
2. **Enable Netlify Blobs** — no setup needed, it's available automatically on any Netlify site's functions.
3. **Set environment variables** in the Netlify site's dashboard (Site settings → Environment variables):
   - `ADMIN_PASSWORD` — the password you'll use to log into the admin page. Pick something strong.
   - `NETLIFY_PAT` — a Netlify **Personal Access Token** (User settings → Applications → New access token) for the account that owns the client sites. Used to call the Analytics API.
   - `RESEND_API_KEY` — your Resend API key (same one used by `review-collector`, or a new one).
   - `RESEND_FROM` (optional) — sender, e.g. `Traffic Reports <reports@shoreworksnj.com>`. Must be a verified sender/domain in Resend.
4. Deploy. Visit the site's `/` (the admin page), enter `ADMIN_PASSWORD`, and add your first client:
   - **Client / business name** — internal label.
   - **Report label** — optional, what shows as the report title (defaults to name).
   - **Client email** — where the report is sent.
   - **Netlify Site ID** — find it in that site's Netlify dashboard under Site settings → General → Site details → Site ID (a UUID, not the site name). The site must have the **Netlify Analytics** add-on enabled, or metrics will come back empty/error.
5. Click **Send** next to a client to test end-to-end before waiting for the 1st of the month (this sends only that client's report, not everyone's).

## Known limitations

- The Netlify Analytics API is unofficial and undocumented (community-reverse-engineered). It could change or break without notice — if reports start failing, check `analytics.services.netlify.com` responses first.
- Reports only cover sites with the paid Netlify Analytics add-on enabled.
- The client list lives in Netlify Blobs scoped to this site; there's no export/import UI yet — if you need a backup, hit `GET /.netlify/functions/clients` with the `x-admin-password` header.
