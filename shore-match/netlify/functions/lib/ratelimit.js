// Per-IP throttle for login/signup. Stored with the rest of the data so it
// works across serverless invocations.
const db = require('./db');

const STORE = 'ratelimit';
const WINDOW_MS = 15 * 60 * 1000;

async function check(bucket, ip, max) {
  const key = `${bucket}:${ip}`;
  const rec = (await db.get(STORE, key)) || { count: 0, resetAt: 0 };
  if (Date.now() > rec.resetAt) return { blocked: false, rec: { count: 0, resetAt: Date.now() + WINDOW_MS }, key };
  return { blocked: rec.count >= max, rec, key, retryAfter: Math.ceil((rec.resetAt - Date.now()) / 1000) };
}

async function hit(state) {
  state.rec.count += 1;
  await db.set(STORE, state.key, state.rec);
}

async function clear(state) {
  await db.del(STORE, state.key);
}

module.exports = { check, hit, clear };
