const { getStore } = require('@netlify/blobs');

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function store() {
  return getStore('login-attempts');
}

function clientIp(event) {
  return (
    event.headers['x-nf-client-connection-ip'] ||
    (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown'
  );
}

async function isLocked(ip) {
  const record = await store()
    .get(ip, { type: 'json' })
    .catch(() => null);
  if (record && record.lockedUntil && Date.now() < record.lockedUntil) {
    return Math.ceil((record.lockedUntil - Date.now()) / 1000);
  }
  return 0;
}

async function recordFailure(ip) {
  const s = store();
  const record = (await s.get(ip, { type: 'json' }).catch(() => null)) || { count: 0 };
  record.count = (record.count || 0) + 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
    record.count = 0;
  }
  await s.setJSON(ip, record);
}

async function clearFailures(ip) {
  await store()
    .delete(ip)
    .catch(() => {});
}

module.exports = { isLocked, recordFailure, clearFailures, clientIp };
