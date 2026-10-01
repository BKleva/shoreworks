# Square Invoicer (test/admin site)

A minimal, password-protected admin panel for creating and emailing Square
invoices. Built as its own Netlify site (functions + static pages), same
pattern as the other client sites in this repo.

## How it works

- **Login** (`/login`) posts to `/api/auth-login`, which checks the submitted
  password against a bcrypt hash and, on success, sets a signed, `HttpOnly`,
  `Secure`, `SameSite=Strict` session cookie. Failed attempts are rate-limited
  per IP (5 tries, then a 15-minute lockout) using Netlify Blobs.
- **Admin panel** (`/admin`) checks the session via `/api/auth-check` before
  rendering the form, and lets you enter a customer name/email, invoice memo,
  due date, and line items.
- **Sending an invoice** posts to `/api/invoices-create`, which runs
  entirely server-side:
  1. Verifies the session cookie (401 if missing/expired).
  2. Validates and sanitizes all input (lengths, formats, positive numbers).
  3. Finds or creates the Square customer by email.
  4. Creates a Square Order with the line items.
  5. Creates a Square Invoice against that order and **publishes** it, which
     triggers Square to email the customer with a hosted payment link.
- The Square access token and admin password hash live only in Netlify
  environment variables — they are never sent to the browser.

## Security measures

- No client ever sees the Square access token; all Square API calls happen
  in Netlify Functions.
- Admin password is stored as a bcrypt hash (never plaintext) in an env var.
- Session cookie is HMAC-signed, `HttpOnly`, `Secure`, `SameSite=Strict`,
  and expires after 12 hours — it can't be read or forged from JS, and
  `SameSite=Strict` means it's never sent on cross-site requests (CSRF
  protection).
- Login attempts are rate-limited and lock out an IP for 15 minutes after
  5 failed tries.
- All inputs are length-capped and type/format validated before touching
  the Square API.
- Security headers (CSP, HSTS, X-Frame-Options, nosniff, noindex) are set
  site-wide in `netlify.toml`.
- The whole site is marked `noindex` / disallowed in `robots.txt` since
  it's a private admin tool.
- **No card or bank details ever reach this site.** The admin panel only
  collects the customer's name/email and invoice line items. When the
  invoice is published, Square emails the customer a link to Square's own
  hosted payment page — the actual card/bank entry happens on Square's
  servers, not here. This site's code and database never see or store
  payment credentials of any kind.

## Scoping the Square access token (do this before production)

The "Production Access Token" shown on your app's Credentials page in the
Square Developer Dashboard has **full access to your Square account** —
payouts, bank account info, team members, everything — not just invoicing.
If that token ever leaked, the blast radius is your whole account. Use it
for nothing beyond initial local testing.

For real use, mint a token that can only do what this app needs:

1. In the [Square Developer Dashboard](https://developer.squareup.com/apps),
   open your app → **OAuth** page → set **Permissions** to only:
   `CUSTOMERS_READ`, `CUSTOMERS_WRITE`, `ORDERS_WRITE`, `INVOICES_READ`,
   `INVOICES_WRITE`.
2. Self-authorize your own app against your own Square account by visiting
   (replace `APP_ID` and, for sandbox, use the sandbox host):
   ```
   https://connect.squareup.com/oauth2/authorize?client_id=APP_ID&scope=CUSTOMERS_READ+CUSTOMERS_WRITE+ORDERS_WRITE+INVOICES_READ+INVOICES_WRITE
   ```
   Log in as the merchant and click **Allow**.
3. Square redirects to your configured redirect URL with a `code` query
   param. Exchange it once for a token:
   ```bash
   curl https://connect.squareup.com/oauth2/token \
     -H "Content-Type: application/json" \
     -d '{"client_id":"APP_ID","client_secret":"APP_SECRET","code":"CODE_FROM_REDIRECT","grant_type":"authorization_code"}'
   ```
4. Use the `access_token` from that response as `SQUARE_ACCESS_TOKEN`. It
   is now restricted to invoicing/customers/orders — it cannot touch
   payouts, bank accounts, or team data even if it leaks.
5. OAuth tokens expire (Square's default is 30 days) and come with a
   `refresh_token` — you'll need to refresh it periodically via
   `POST /oauth2/token` with `grant_type: refresh_token`. For a low-volume
   internal tool, the simplest approach is redoing step 2–4 manually when
   it expires, or writing a small scheduled refresh function if that
   becomes annoying.

## Setup

1. **Install dependencies** (for local `netlify dev` — Netlify's build also
   installs them automatically on deploy):
   ```bash
   cd square-invoicer
   npm install
   ```

2. **Create a Square app** at https://developer.squareup.com/apps and grab,
   for the **Sandbox** (recommended for testing):
   - Sandbox Access Token
   - A Sandbox Location ID (Locations API or dashboard)

3. **Generate a bcrypt hash for your admin password** (run locally, don't
   commit the plaintext password anywhere):
   ```bash
   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" "your-strong-password"
   ```

4. **Generate a random session secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. **Set environment variables** in the Netlify site dashboard (Site
   configuration → Environment variables) — do **not** put these in
   `netlify.toml` or commit them:

   | Variable | Example | Notes |
   |---|---|---|
   | `SQUARE_ENVIRONMENT` | `sandbox` | `sandbox` or `production` |
   | `SQUARE_ACCESS_TOKEN` | `EAAAE...` | from your Square app |
   | `SQUARE_LOCATION_ID` | `L1234ABC` | from your Square account |
   | `SQUARE_API_VERSION` | `2025-01-23` | check developer.squareup.com for the current version if calls fail |
   | `ADMIN_PASSWORD_HASH` | `$2a$12$...` | output from step 3 |
   | `SESSION_SECRET` | `a1b2c3...` | output from step 4 |

6. **Deploy** by connecting this `square-invoicer/` folder as its own
   Netlify site (same as `review-collector/` and `twin-cleans/` in this
   repo), or via `netlify deploy` from inside the folder.

7. Visit the site, sign in with your admin password, and send a test
   invoice. In Sandbox mode, Square provides test cards for paying the
   invoice — see https://developer.squareup.com/docs/devtools/sandbox/payments.

## Going to production

- Switch `SQUARE_ENVIRONMENT` to `production` and use a production access
  token/location ID once you're ready for real invoices.
- Rotate `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` before production use if
  they were ever shared/tested elsewhere.
- Consider adding a second admin user or proper user accounts if more than
  one person needs access with individual audit trails — this build assumes
  a single shared admin password, appropriate for a one-person test/admin
  tool but not for multi-user access control.
