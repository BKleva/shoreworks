# Shore Match

A private matchmaking network where **local startups** publish funding proposals and
**local investors** discover them, so both sides can build relationships.

- **Founders**: company profile, funding proposals (draft → open → funded/closed), investor directory ranked by fit, pitch investors, accept inbound interest.
- **Investors**: thesis profile, browse/filter proposals with a transparent **match score**, watchlist, express interest, private deal pipeline + notes.
- **Both**: request/accept connections (contact details hidden until accepted), in-app messaging, unread badges.
- **Admin** (`ADMIN_EMAILS`): verify members, hide proposals, disable/delete accounts.

## Run it locally

```bash
cd shore-match
npm install
npm run seed     # optional: fictional demo data (password for all demo users: demo1234)
npm start        # http://localhost:8888
npm test         # 22 tests: API rules, privacy, match scoring
```

Demo logins after seeding: founders `maya@demo.test`, `jon@demo.test`, `priya@demo.test`, `sam@demo.test`;
investors `dana@demo.test`, `raj@demo.test`, `ellie@demo.test`. Data lives in `./.data` (git-ignored).
To try the admin panel: `ADMIN_EMAILS=maya@demo.test npm start`.

## Deploy (Netlify, same pattern as the other sites in this repo)

1. New Netlify site from this repo, **base directory** `shore-match`.
2. Environment variables:
   - `SESSION_SECRET` — long random string (`openssl rand -hex 32`). **Required**; the function refuses to run without it.
   - `ADMIN_EMAILS` — comma-separated emails that get the Admin tab.
3. Deploy. Storage automatically switches from JSON files to **Netlify Blobs**; no database to provision.

## How it's built

```
public/                    static single-page app (vanilla JS modules, no build step)
  js/main.js               hash router, header, auth gating
  js/views/*.js            one file per screen
  js/ui.js                 DOM helper h(), forms, modal, toasts (never uses innerHTML)
netlify/functions/api.js   the only function: router, auth, CSRF check, error handling
  lib/routes/*.js          auth, profile, proposals, connections, admin
  lib/match.js             explainable match scoring (industry, stage, check size, town, deal type)
  lib/db.js                storage adapter: Netlify Blobs in prod, JSON files locally
  lib/config.js            industries / stages / towns / region name: edit to retarget the platform
server.js                  local dev server (same API + same CSP as production)
```

**Retargeting to another region or niche** (e.g. a different town, or "local restaurants"): edit
`netlify/functions/lib/config.js`; the UI reads it from `/api/config`.

## Security & privacy decisions

- Passwords: bcrypt. Sessions: HMAC-signed, `HttpOnly`, `SameSite=Lax`, `Secure` in production, 14 days.
- Login/signup rate-limited per IP. Same-origin check on every write. Strict CSP (no inline scripts or styles).
- Every route checks role and ownership server-side; responses are built by explicit "shaper" functions so private fields (emails, investor notes, drafts) can't leak by accident. Tests assert this.
- Contact details are revealed only after a connection is accepted.
- All input validated and length-capped in `lib/validate.js`; links must be http(s).
- Users can permanently delete their account and all associated data.

## Known limits (and what to do when you hit them)

- Blobs has no query engine, so lists read a whole store. Fine for hundreds to a few thousand records; beyond that, replace `lib/db.js` with Postgres/Supabase (nothing else touches storage).
- Writes are last-write-wins. Two people editing the *same* conversation at the *same* instant could drop a message; use a DB with transactions before high volume.
- No email notifications yet (the repo already uses Resend; add a call after a connection is created/accepted).
