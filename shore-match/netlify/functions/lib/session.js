const crypto = require('crypto');

const COOKIE = 'sm_session';
const TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

let devSecret;
function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NETLIFY || process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET env var must be set to a long random string');
  }
  // Local dev only: random per process (sessions reset on restart).
  if (!devSecret) devSecret = crypto.randomBytes(32).toString('hex');
  return devSecret;
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (p) => crypto.createHmac('sha256', secret()).update(p).digest('base64url');

function secureFlag() {
  return process.env.NETLIFY || process.env.NODE_ENV === 'production' ? '; Secure' : '';
}

function createCookie(userId) {
  const payload = b64(JSON.stringify({ uid: userId, exp: Date.now() + TTL_MS }));
  return `${COOKIE}=${payload}.${sign(payload)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${TTL_MS / 1000}${secureFlag()}`;
}

function clearCookie() {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureFlag()}`;
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    if (k) { try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { /* ignore */ } }
  });
  return out;
}

// Returns the user id from a valid, unexpired, correctly-signed cookie, else null.
function readSession(cookieHeader) {
  try {
    const raw = parseCookies(cookieHeader)[COOKIE];
    if (!raw) return null;
    const [payload, sig] = raw.split('.');
    if (!payload || !sig) return null;
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || !data.exp || Date.now() > data.exp) return null;
    return data.uid;
  } catch (e) {
    return null;
  }
}

module.exports = { createCookie, clearCookie, readSession };
