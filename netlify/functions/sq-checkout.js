const crypto = require('crypto');

const SUPA_URL = 'https://gjhkjtmnpckcpnnnqtbx.supabase.co';
// Anon key is already public (in login.html source), safe to use here
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqaGtqdG1ucGNrY3Bubm5xdGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTc2OTMsImV4cCI6MjA5NTU3MzY5M30.iukNPG3C1hvY6WeLrXta898i5OVNN50A48BbfWej4v8';
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

  // Verify the caller actually owns this uid by checking their JWT
  const jwt = (event.headers.authorization || '').replace(/^Bearer /i, '');
  if (jwt) {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPA_ANON_KEY, 'Authorization': `Bearer ${jwt}` }
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      if (userData.id !== uid) return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
  }

  const token = crypto.randomBytes(24).toString('hex');

  // Store session token (RLS policy allows insert with anon key)
  const insertRes = await fetch(`${SUPA_URL}/rest/v1/spotlight_sessions`, {
    method: 'POST',
    headers: {
      'apikey': SUPA_ANON_KEY,
      'Authorization': `Bearer ${SUPA_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
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
