# Outdoor Impact Ordinance Scout (Netlify)

Password-protected web app: county ordinance / master-plan scouting (Monmouth, Ocean, Bergen, Morris) plus the
Roadside Map (vacant / commercial / industrial parcels within a set distance of NJ state highways, Garden State Parkway excluded).

Live: https://outdoor-impact-ordinance-scout.netlify.app  (admin: https://app.netlify.com/projects/outdoor-impact-ordinance-scout)

## How it is built
- `public/` – the pages (`login.html`, `index.html`, `static/*`).
- `netlify/edge-functions/gate.ts` – the password gate in front of every page and API call.
- `netlify/functions/` – the API (`ordinance-api`, `roadside-api`, `login`, `logout`, `me`), background jobs
  (`crawl-source-background`, `roadside-refresh-background`, `roadside-enrich-background`) and two schedules
  (`crawl-schedule` weekly re-crawl, `roadside-schedule` refresh when data is older than 2 days; both check daily).
- `netlify/lib/` – shared code (keyword rules `analyzer.mjs`, township tagging, crawler, geometry, roadside engine).
- Data lives in Netlify Blobs (no database to run).

## Login
One user. Settings are Netlify environment variables (never in the repo):

| Variable | What |
|---|---|
| `OI_LOGIN_EMAIL` | the login email |
| `OI_PASS_HASH` | salted scrypt hash of the password (secret) |
| `SESSION_SECRET` | signs the session cookie (secret) |
| `INTERNAL_KEY` | lets scheduled jobs start background jobs (secret) |

**Change the password**
```
node scripts/hash-password.mjs "the new password"
```
Copy the printed value into `OI_PASS_HASH` (Netlify → Project configuration → Environment variables, or
`netlify env:set OI_PASS_HASH "<value>" --secret --context production`; read it from the terminal, not through a shell that
expands `$`), then redeploy: `netlify deploy --prod --dir=public --functions=netlify/functions`.
Changing `SESSION_SECRET` signs everyone out.

Eight wrong passwords from one address lock that address out for 15 minutes.

## Deploy
```
npm install
netlify deploy --prod --dir=public --functions=netlify/functions
```

## Local run
Create `.env` with the four variables above, then `netlify dev`.

## Limits worth knowing
- Blocked sites (eCode360, some NJ state pages) refuse automated access; use the Import tab for those documents.
- Business names/emails come from OpenStreetMap and are sparse.
- Sync functions have ~10 s; long work (crawl, county reload, business lookup) runs as background functions.
