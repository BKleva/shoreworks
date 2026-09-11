const SUPA_URL = 'https://gjhkjtmnpckcpnnnqtbx.supabase.co';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqaGtqdG1ucGNrY3Bubm5xdGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTc2OTMsImV4cCI6MjA5NTU3MzY5M30.iukNPG3C1hvY6WeLrXta898i5OVNN50A48BbfWej4v8';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, body: 'Bad JSON' }; }

  const { token } = body;
  if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'Missing token' }) };

  const headers = {
    'apikey': SUPA_ANON_KEY,
    'Authorization': `Bearer ${SUPA_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  // Verify token exists and is not yet activated
  const lookupRes = await fetch(
    `${SUPA_URL}/rest/v1/spotlight_sessions?token=eq.${encodeURIComponent(token)}&activated=eq.false&select=user_id`,
    { headers }
  );
  const rows = await lookupRes.json();
  if (!Array.isArray(rows) || !rows.length) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Invalid or already-used token' }) };
  }

  // Mark as activated — one-time use
  const updateRes = await fetch(
    `${SUPA_URL}/rest/v1/spotlight_sessions?token=eq.${encodeURIComponent(token)}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ activated: true, activated_at: new Date().toISOString() }),
    }
  );
  if (!updateRes.ok) {
    const txt = await updateRes.text();
    return { statusCode: 500, body: JSON.stringify({ error: 'Activation failed', detail: txt }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
