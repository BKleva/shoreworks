# Outdoor Impact Ordinance Scout (Netlify)

Password-protected web app: township-level ordinance / master-plan scouting (Monmouth, Ocean, Bergen, Morris, Essex) plus a
bulk mail tool: upload a prospect list (CSV, Excel or pasted rows) and print labels, envelopes or merged letters (`public/mail.html`).

Live: https://outdoor-impact-ordinance-scout.netlify.app  (admin: https://app.netlify.com/projects/outdoor-impact-ordinance-scout)

## How it is built
- `public/` – the pages (`login.html`, `index.html`, `static/*`).
- `netlify/edge-functions/gate.ts` – the password gate in front of every page and API call.
- `netlify/functions/` – the API (`ordinance-api`, `login`, `logout`, `me`), the background crawl job
  (`crawl-source-background`) and a schedule (`crawl-schedule`, weekly re-crawl, checked daily).
- `netlify/lib/` – shared code (keyword rules `analyzer.mjs`, township tagging, crawler).
- The mail page reads and prints in the browser (the Excel reader is loaded from a CDN only when an .xlsx file is chosen).
  `netlify/functions/mail-api.mjs` stores what it must remember between visits and devices: the letter settings, the signature,
  the prospect list and the log of who has been mailed (stored as short hashes, not names).
- Data lives in Netlify Blobs (no database to run).

## Login
One user. Settings are Netlify environment variables (never in the repo):

| Variable | What |
|---|---|
| `OI_LOGIN_EMAIL` | the login email |
| `OI_PASS_HASH` | salted scrypt hash of the password (secret) |
| `SESSION_SECRET` | signs the session cookie (secret) |
| `INTERNAL_KEY` | lets the scheduled crawl start background jobs (secret) |

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
- Sync functions have ~10 s; long work (the crawl) runs as background functions.
