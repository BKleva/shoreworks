// Login + session helpers shared by every function.
//
// Settings live in Netlify environment variables (never in the repo):
//   OI_LOGIN_EMAIL   the only allowed username (an email address)
//   OI_PASS_HASH     "scrypt$<salt hex>$<hash hex>"  (make one with: node scripts/hash-password.mjs)
//   SESSION_SECRET   long random string used to sign the session cookie
//   INTERNAL_KEY     lets scheduled functions start background functions
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const COOKIE = 'oi_session';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // stay signed in for a week

const secret = () => process.env.SESSION_SECRET || '';

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''), 'utf8');
  const y = Buffer.from(String(b ?? ''), 'utf8');
  if (x.length !== y.length) {
    timingSafeEqual(x, x); // burn a compare so length is not a timing signal
    return false;
  }
  return timingSafeEqual(x, y);
}

export function makeToken() {
  const exp = String(Date.now() + TTL_MS);
  const sig = createHmac('sha256', secret()).update(exp).digest('hex');
  return Buffer.from(`${exp}.${sig}`).toString('base64url');
}

export function verifyToken(token) {
  try {
    if (!secret()) return false; // never accept sessions if the secret is missing
    const raw = Buffer.from(String(token || ''), 'base64url').toString('utf8');
    const dot = raw.indexOf('.');
    if (dot < 0) return false;
    const exp = raw.slice(0, dot);
    if (!/^\d+$/.test(exp) || Date.now() > Number(exp)) return false;
    const good = createHmac('sha256', secret()).update(exp).digest('hex');
    return safeEqual(raw.slice(dot + 1), good);
  } catch {
    return false;
  }
}

export function cookieOf(req, name = COOKIE) {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : '';
}

export function sessionCookie(token, maxAgeSec = TTL_MS / 1000) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

/** Returns null when the caller is allowed in, otherwise a 401 Response. */
export function requireAuth(req) {
  const internal = req.headers.get('x-oi-internal');
  if (internal && process.env.INTERNAL_KEY && safeEqual(internal, process.env.INTERNAL_KEY)) return null;
  if (verifyToken(cookieOf(req))) return null;
  return Response.json({ error: 'Not signed in.' }, { status: 401 });
}

export function verifyPassword(email, password) {
  const wantEmail = (process.env.OI_LOGIN_EMAIL || '').trim().toLowerCase();
  const [scheme, saltHex, hashHex] = (process.env.OI_PASS_HASH || '').split('$');
  const emailOk = safeEqual(String(email || '').trim().toLowerCase(), wantEmail);
  let passOk = false;
  if (scheme === 'scrypt' && saltHex && hashHex) {
    const got = scryptSync(String(password ?? ''), Buffer.from(saltHex, 'hex'), 64);
    const want = Buffer.from(hashHex, 'hex');
    passOk = got.length === want.length && timingSafeEqual(got, want);
  }
  return emailOk && passOk && !!wantEmail;
}

// ---- brute-force throttle: 8 wrong tries per IP per 15 minutes ----
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;
const authStore = () => getStore({ name: 'oi-auth', consistency: 'strong' });

export async function throttled(ip) {
  try {
    const rec = await authStore().get(`fail/${ip}`, { type: 'json' });
    return !!rec && Date.now() - rec.first < WINDOW_MS && rec.count >= MAX_FAILS;
  } catch {
    return false;
  }
}

export async function noteFailure(ip) {
  try {
    const s = authStore();
    const rec = await s.get(`fail/${ip}`, { type: 'json' });
    const fresh = !rec || Date.now() - rec.first >= WINDOW_MS;
    await s.setJSON(`fail/${ip}`, { first: fresh ? Date.now() : rec.first, count: fresh ? 1 : rec.count + 1 });
  } catch { /* throttling is best effort */ }
}

export async function clearFailures(ip) {
  try { await authStore().delete(`fail/${ip}`); } catch { /* ignore */ }
}
