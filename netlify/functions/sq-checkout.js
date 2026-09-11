const crypto = require('crypto');

const SUPA_URL = 'https://gjhkjtmnpckcpnnnqtbx.supabase.co';
const SUPA_SERVICE_KEY = process.env.SUPA_SERVICE_KEY;
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID;
const SITE_URL = process.env.URL || 'https://shoreworksnj.com';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, body: 'Bad JSON' }; }

  const { uid, email, name, biz } = body;
  if (!uid || !email) return { statusCode: 400, body: JSON.stringify({ error: 'Missing uid or email' }) };

  const token = crypto.randomBytes(24).toString('hex');
  const svcHeaders = {
    'apikey': SUPA_SERVICE_KEY,
    'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  // Store session token so sq-activate can verify it server-side
  const insertRes = await fetch(`${SUPA_URL}/rest/v1/spotlight_sessions`, {
    method: 'POST',
    headers: svcHeaders,
    body: JSON.stringify({ token, user_id: uid }),
  });
  if (!insertRes.ok) {
    const txt = await insertRes.text();
    return { statusCode: 500, body: JSON.stringify({ error: 'Session store failed', detail: txt }) };
  }

  // Create Square hosted payment link
  const sqRes = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'Square-Version': '2024-01-18',
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomBytes(16).toString('hex'),
      order: {
        location_id: SQUARE_LOCATION_ID,
        reference_id: token,
        line_items: [{
          name: 'Spotlight Account — Shore Works Catalog',
          quantity: '1',
          base_price_money: { amount: 1999, currency: 'USD' },
          note: `Monthly subscription — ${biz || name || email}`,
        }],
      },
      checkout_options: {
        redirect_url: `${SITE_URL}/spotlight-success?token=${token}`,
        ask_for_shipping_address: false,
      },
      pre_populated_data: {
        buyer_email: email,
      },
    }),
  });

  const sqData = await sqRes.json();
  if (!sqRes.ok) return { statusCode: 500, body: JSON.stringify({ error: sqData }) };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: sqData.payment_link.url }),
  };
};
