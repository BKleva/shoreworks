const crypto = require('crypto');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET env var must be set to a long random string');
  }
  return s;
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

function createSessionCookie() {
  const expires = Date.now() + SESSION_TTL_MS;
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${expires}.${nonce}`;
  const value = `${payload}.${sign(payload)}`;
  return `admin_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

function clearSessionCookie() {
  return 'admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function isValidSession(cookieHeader) {
  try {
    const cookies = parseCookies(cookieHeader);
    const value = cookies.admin_session;
    if (!value) return false;
    const parts = value.split('.');
    if (parts.length !== 3) return false;
    const [expiresStr, nonce, sig] = parts;
    const payload = `${expiresStr}.${nonce}`;
    const expected = sign(payload);
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expectedBuf.length) return false;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
    const expires = Number(expiresStr);
    if (!Number.isFinite(expires) || Date.now() > expires) return false;
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { createSessionCookie, clearSessionCookie, isValidSession };
