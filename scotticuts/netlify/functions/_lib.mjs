import { getStore } from '@netlify/blobs';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const TZ = 'America/New_York';

// Shop-side booking alerts go here (override with NOTIFY_EMAIL in Netlify env).
export const notifyTo = () => process.env.NOTIFY_EMAIL || 'ben@shoreworksnj.com';

export const SHOP = {
  name: "ScottiCuts",
  phone: '(609) 365-2539',
  address: '426 Shore Rd Unit E, Somers Point, NJ 08244',
};

// Minutes-from-midnight [open, close] per weekday (0 = Sunday), null = closed.
const DAY = [600, 1080];
export const DEFAULT_CONFIG = {
  chairs: 1, // how many appointments can run at the same time
  step: 30, // start-time grid, minutes
  leadMinutes: 60, // can't book less than this far ahead
  maxDays: 60, // how far ahead people can book
  hours: { 0: null, 1: null, 2: DAY, 3: DAY, 4: DAY, 5: DAY, 6: DAY },
  services: [
    { id: 'basic-cut', name: 'Basic Cut', priceLabel: '$20', duration: 30, active: true, desc: 'Clean, classic cut — clippers and scissor work.' },
    { id: 'premium-cut', name: 'Premium Cut', priceLabel: '$25', duration: 45, active: true, desc: 'Extra detail, fade work and a sharp finish.' },
    { id: 'cut-facial', name: 'Cut & Facial Hair', priceLabel: '$25–$30', duration: 45, active: true, desc: 'Your cut plus a beard or mustache trim and line-up.' },
    { id: 'facial-only', name: 'Facial Hair Only', priceLabel: '$10–$15', duration: 30, active: true, desc: 'Beard shape-up, trim and line-up.' },
    { id: 'razor-shave', name: 'Razor Steam Shave', priceLabel: '$25', duration: 30, active: true, desc: 'Hot towel, steam and a traditional straight-razor shave.' },
    { id: 'cut-shave', name: 'Cut & Shave', priceLabel: '$40', duration: 60, active: true, desc: 'The full treatment — premium cut plus a razor steam shave.' },
  ],
};

export const store = () => getStore({ name: 'scotticuts', consistency: 'strong' });

export async function getConfig(s = store()) {
  const saved = await s.get('config', { type: 'json' }).catch(() => null);
  return { ...DEFAULT_CONFIG, ...(saved || {}) };
}

/* ---------------- time helpers (shop is on New Jersey time) ---------------- */

export function nowNJ() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: Number(g('hour')) * 60 + Number(g('minute')) };
}

export const validDate = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return false;
  const t = new Date(d + 'T12:00:00Z');
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
};

export const dayOfWeek = (d) => new Date(d + 'T12:00:00Z').getUTCDay();

export function addDays(d, n) {
  const t = new Date(d + 'T12:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function fmtTime(min) {
  const h = Math.floor(min / 60), m = min % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}

/* ---------------- day documents ---------------- */

const dayKey = (d) => `days/${d}`;
const emptyDay = () => ({ bookings: [], blocks: [], closed: false, closedNote: '' });

export async function getDay(date, s = store()) {
  const d = await s.get(dayKey(date), { type: 'json' }).catch(() => null);
  return { ...emptyDay(), ...(d || {}) };
}

// Read-modify-write with an ETag guard so two writers can't clobber each other.
export async function mutateDoc(key, fresh, fn, s = store()) {
  for (let i = 0; i < 6; i++) {
    const cur = await s.getWithMetadata(key, { type: 'json' }).catch(() => null);
    const doc = { ...fresh(), ...(cur?.data || {}) };
    const out = await fn(doc);
    if (out && out.error) return out;
    const res = await s.setJSON(key, doc, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (res.modified) return { ...(out || {}), doc, day: doc };
  }
  return { error: 'The calendar is busy right now — please try again.', status: 503 };
}

export const mutateDay = (date, fn, s = store()) => mutateDoc(dayKey(date), emptyDay, fn, s);

const live = (b) => b.status !== 'cancelled' && b.status !== 'noshow';
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

export function openSlots(config, day, date, duration, now = nowNJ()) {
  if (!validDate(date) || date < now.date || date > addDays(now.date, config.maxDays)) return [];
  const hours = config.hours?.[dayOfWeek(date)];
  if (!hours || day.closed) return [];
  const [open, close] = hours;
  const out = [];
  for (let t = open; t + duration <= close; t += config.step) {
    if (date === now.date && t < now.minutes + config.leadMinutes) continue;
    if (day.blocks.some((b) => overlaps(t, t + duration, b.start, b.end))) continue;
    const busy = day.bookings.filter((b) => live(b) && overlaps(t, t + duration, b.start, b.start + b.duration)).length;
    if (busy >= config.chairs) continue;
    out.push(t);
  }
  return out;
}

/* ---------------- tokens ---------------- */

const secret = () => process.env.ADMIN_SECRET || 'scotticuts-dev-secret-change-me';
const sign = (s) => createHmac('sha256', secret()).update(s).digest('hex');

export const manageToken = (id) => sign('manage:' + id).slice(0, 32);

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''), 'utf8');
  const y = Buffer.from(String(b ?? ''), 'utf8');
  if (x.length !== y.length) { timingSafeEqual(x, x); return false; }
  return timingSafeEqual(x, y);
}

const TTL_MS = 12 * 60 * 60 * 1000;
// Session token: base64url("role:id:expiry.signature"). role is 'admin' or 'staff'.
export function makeToken(role, id = '') {
  const body = `${role}:${id}:${Date.now() + TTL_MS}`;
  return Buffer.from(body + '.' + sign('tok:' + body)).toString('base64url');
}
export function authOf(req) {
  try {
    const h = req.headers.get('authorization') || '';
    const raw = Buffer.from(h.startsWith('Bearer ') ? h.slice(7) : '', 'base64url').toString('utf8');
    const dot = raw.lastIndexOf('.');
    if (dot < 0) return null;
    const body = raw.slice(0, dot);
    if (!safeEqual(raw.slice(dot + 1), sign('tok:' + body))) return null;
    const [role, id, exp] = body.split(':');
    if (!/^\d+$/.test(exp) || Date.now() > Number(exp)) return null;
    return { role, id };
  } catch { return null; }
}
export const verifyAdmin = (req) => authOf(req)?.role === 'admin';

/* ---------------- passwords ---------------- */
export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(String(pw), salt, 32).toString('hex')}`;
}
export function checkPassword(pw, stored) {
  const [salt, hash] = String(stored || 'x:y').split(':');
  let got;
  try { got = scryptSync(String(pw), salt || 'x', 32); } catch { return false; }
  const want = Buffer.from(hash || '', 'hex');
  return want.length === got.length && timingSafeEqual(got, want);
}

/* ---------------- barbers (team) ---------------- */
export const teamKey = (id) => `team/${id}`;
export const imgKey = (emp, img) => `img/${emp}/${img}`;
export const validId = (v) => /^[a-z0-9-]{3,60}$/.test(v || '');
export const MAX_IMAGES = 40;

export async function listEmployees(s = store()) {
  const { blobs } = await s.list({ prefix: 'team/' });
  const docs = await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' }).catch(() => null)));
  return docs.filter(Boolean).sort((a, b) => (a.created || '').localeCompare(b.created || ''));
}
export const getEmployee = (id, s = store()) => (validId(id) ? s.get(teamKey(id), { type: 'json' }).catch(() => null) : null);

const imgUrl = (emp, img) => `/api/img/${emp}/${img}`;
// What the public site (and the owner) may see — never the password hash.
export const publicEmployee = (e) => ({
  id: e.id, name: e.name, title: e.title || '', bio: e.bio || '',
  photo: e.photo ? imgUrl(e.id, e.photo) : null,
  images: (e.portfolio || []).map((p) => ({ id: p.id, url: imgUrl(e.id, p.id), caption: p.caption || '' })),
});

export const newId = (date) => `${date}-${randomBytes(4).toString('hex')}`;

/* ---------------- misc ---------------- */

export const json = (data, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

export const publicConfig = (c) => ({
  chairs: c.chairs, step: c.step, leadMinutes: c.leadMinutes, maxDays: c.maxDays, hours: c.hours,
  services: c.services.filter((s) => s.active).map(({ id, name, priceLabel, duration, desc }) => ({ id, name, priceLabel, duration, desc })),
});

// Optional email via Resend. Set RESEND_API_KEY (+ RESEND_FROM, NOTIFY_EMAIL) in Netlify env to turn it on.
export async function sendMail({ to, subject, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM || 'ScottiCuts <onboarding@resend.dev>', to: [to], subject, text }),
    });
  } catch { /* email is best-effort */ }
}

export const prettyDate = (d) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
