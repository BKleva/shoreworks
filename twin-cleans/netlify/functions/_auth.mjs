import { createHmac, timingSafeEqual } from 'node:crypto';

// Session secret — set ADMIN_SECRET in the Netlify site environment.
const secret = () => process.env.ADMIN_SECRET || 'twin-cleans-dev-secret-change-me';

const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export function makeToken() {
  const exp = String(Date.now() + TTL_MS);
  const sig = createHmac('sha256', secret()).update(exp).digest('hex');
  return Buffer.from(exp + '.' + sig).toString('base64url');
}

export function verifyToken(token) {
  try {
    const raw = Buffer.from(String(token || ''), 'base64url').toString('utf8');
    const dot = raw.indexOf('.');
    if (dot < 0) return false;
    const exp = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    if (!/^\d+$/.test(exp) || Date.now() > Number(exp)) return false;
    const good = createHmac('sha256', secret()).update(exp).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(good);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function bearer(req) {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''), 'utf8');
  const y = Buffer.from(String(b ?? ''), 'utf8');
  if (x.length !== y.length) {
    // still burn a compare to reduce timing signal
    timingSafeEqual(x, x);
    return false;
  }
  return timingSafeEqual(x, y);
}
