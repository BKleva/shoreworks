const bcrypt = require('bcryptjs');
const { createSessionCookie } = require('./lib/session');
const { isLocked, recordFailure, clearFailures, clientIp } = require('./lib/rate-limit');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const ip = clientIp(event);

  const lockedSeconds = await isLocked(ip);
  if (lockedSeconds > 0) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Too many attempts. Try again in ${lockedSeconds}s.` })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash) {
    console.error('ADMIN_PASSWORD_HASH env var is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  if (!password) {
    await recordFailure(ip);
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid credentials' }) };
  }

  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    await recordFailure(ip);
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid credentials' }) };
  }

  await clearFailures(ip);

  return {
    statusCode: 200,
    headers: { 'Set-Cookie': createSessionCookie(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true })
  };
};
