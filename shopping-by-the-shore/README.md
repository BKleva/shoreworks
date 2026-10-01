# Shopping by the Shore LLC

Static site + two Netlify Functions. Own Netlify project (publish dir = this folder).

## How ordering works

1. Customer builds an order in the 5-step wizard, then **checks out** (order summary, tip, totals, card).
2. The card is entered into **Square's hosted card fields** — card numbers never touch this site.
   `netlify/functions/checkout.js` receives only Square's single-use token, finds/creates the
   Square customer by email, and **saves the card on file**. **Nothing is charged at checkout.**
3. The full order (items, stores, date, address, tip, estimate, Square customer id, card brand + last 4)
   is submitted to **Netlify Forms** (form name `booking`) so Celeste gets it in email/dashboard.
4. After shopping, Celeste charges the real total (receipt + 23%/$50 min fee + tip) from the
   **Square Dashboard** (Customers → the customer → saved card → charge / Virtual Terminal).
5. Check-in-only bookings (home / pet / plant) skip tip + payment; Celeste sends a quote.

**Demo mode:** if the Square env vars below aren't set, checkout still works but collects no card
(a yellow "demo mode" note shows). This is also what you see running locally with `python -m http.server`.

## Setup (Square)

1. Create an app at https://developer.squareup.com/apps (use **Sandbox** first).
2. Netlify → Site configuration → Environment variables:

   | Variable | Notes |
   |---|---|
   | `SQUARE_ENVIRONMENT` | `sandbox` or `production` |
   | `SQUARE_APP_ID` | the app's Application ID (public — rendered in the browser) |
   | `SQUARE_LOCATION_ID` | the Square location to attach the card flow to |
   | `SQUARE_ACCESS_TOKEN` | **secret**; server-side only |
   | `SQUARE_API_VERSION` | optional, defaults to `2025-01-23` |

3. Token scopes (same advice as `square-invoicer/README.md`): prefer an OAuth token limited to
   `CUSTOMERS_READ`, `CUSTOMERS_WRITE`, `PAYMENTS_WRITE`. Don't use the all-access production token.
4. Test in sandbox with Square's test cards: https://developer.squareup.com/docs/devtools/sandbox/payments
   (e.g. `4111 1111 1111 1111`, any future date, any CVV/ZIP).
5. In Netlify → Forms → `booking` → add an email notification so orders reach Celeste.
6. Switch to production values when ready.

## Local development

```bash
python -m http.server 8093      # static site only (demo-mode checkout)
netlify dev                      # site + functions (needs the env vars above in a .env or Netlify link)
```

## Things to tweak

- `app.js` top: `FEE_RATE`, `FEE_MIN`, `CLOSED_DAYS` (Fridays), `STORES`, `SERVICES`, `TOWNS`.
- Default tip is "No tip" (`fresh()` → `tip.pct`).
- Hero photo: drop `images/celeste.jpg` (falls back to an illustration).
