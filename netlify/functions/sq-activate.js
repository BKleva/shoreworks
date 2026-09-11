const SUPA_URL = 'https://gjhkjtmnpckcpnnnqtbx.supabase.co';
const SUPA_SERVICE_KEY = process.env.SUPA_SERVICE_KEY;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, body: 'Bad JSON' }; }

  const { token } = body;
  if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'Missing token' }) };

  const svcHeaders = {
    'apikey': SUPA_SERVICE_KEY,
    'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  // Verify token exists
  const lookupRes = await fetch(
    `${SUPA_URL}/rest/v1/spotlight_sessions?token=eq.${encodeURIComponent(token)}&select=user_id`,
    { headers: svcHeaders }
  );
  const rows = await lookupRes.json();
  if (!Array.isArray(rows) || !rows.length) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Invalid or expired token' }) };
  }

  const userId = rows[0].user_id;

  // Activate spotlight on the Supabase user
  const updateRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: svcHeaders,
    body: JSON.stringify({
      user_metadata: { plan: 'spotlight', spotlight_since: new Date().toISOString() },
    }),
  });
  if (!updateRes.ok) {
    const txt = await updateRes.text();
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to activate', detail: txt }) };
  }

  // Consume the token — one-time use only
  await fetch(
    `${SUPA_URL}/rest/v1/spotlight_sessions?token=eq.${encodeURIComponent(token)}`,
    { method: 'DELETE', headers: svcHeaders }
  );

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
