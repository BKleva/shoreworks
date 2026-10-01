// Saves the customer's card on file with Square (no charge is made here).
//
// The browser tokenizes the card inside Square's own hosted fields and sends
// us only the single-use token ("sourceId"). We never see card numbers.
// Celeste charges the final receipt total later from the Square Dashboard.
const crypto = require('crypto');
const { squareFetch } = require('./lib/square');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KEY_RE = /^[A-Za-z0-9-]{16,64}$/;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function findOrCreateCustomer({ name, email, phone }) {
  const search = await squareFetch('/v2/customers/search', {
    method: 'POST',
    body: JSON.stringify({ query: { filter: { email_address: { exact: email } } }, limit: 1 })
  });
  if (search.customers && search.customers.length) return search.customers[0].id;

  const [given, ...rest] = name.split(/\s+/);
  const digits = phone.replace(/\D/g, '');
  const e164 = digits.length === 10 ? '+1' + digits : digits.length === 11 && digits[0] === '1' ? '+' + digits : undefined;
  const created = await squareFetch('/v2/customers', {
    method: 'POST',
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      given_name: given,
      family_name: rest.join(' ') || undefined,
      email_address: email,
      phone_number: e164,
      reference_id: 'shopping-by-the-shore-web',
      note: 'Created from the Shopping by the Shore booking site'
    })
  });
  return created.customer.id;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  // Same-origin only (the booking page calls us from its own domain).
  const origin = event.headers.origin;
  const host = event.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json(403, { error: 'Forbidden' });
    } catch (_) {
      return json(403, { error: 'Forbidden' });
    }
  }

  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    console.error('Square env vars are not set');
    return json(500, { error: 'Payments are not set up yet. Please call Celeste at 609.339.1600.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return json(400, { error: 'Invalid request' });
  }

  const sourceId = clean(body.sourceId, 300);
  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 40);
  const key = KEY_RE.test(body.idempotencyKey || '') ? body.idempotencyKey : crypto.randomUUID();

  if (!sourceId) return json(400, { error: 'Card details are missing. Please re-enter your card.' });
  if (!name) return json(400, { error: 'Name is required.' });
  if (!EMAIL_RE.test(email)) return json(400, { error: 'A valid email is required.' });

  try {
    const customerId = await findOrCreateCustomer({ name, email, phone });
    const res = await squareFetch('/v2/cards', {
      method: 'POST',
      body: JSON.stringify({
        idempotency_key: key,
        source_id: sourceId,
        card: { customer_id: customerId, cardholder_name: name }
      })
    });
    const card = res.card || {};
    return json(200, {
      ok: true,
      customerId,
      card: { brand: card.card_brand || 'CARD', last4: card.last_4 || '', expMonth: card.exp_month, expYear: card.exp_year }
    });
  } catch (err) {
    // Square's detail text is safe to show (e.g. "Card declined", "CVV verification failed").
    const status = err.statusCode && err.statusCode < 500 ? 402 : 502;
    return json(status, { error: err.message || 'We couldn’t save that card. Please try another card.' });
  }
};
