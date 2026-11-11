// Storage layer. On Netlify it uses Netlify Blobs; everywhere else (local dev,
// tests) it falls back to JSON files so the app runs with zero setup.
//
// API: get(store,key) / set(store,key,value) / del(store,key) / list(store)
// Every record is a JSON document. Blobs has no query engine, so `list`
// reads the whole store -- fine for a local-market directory (hundreds to a
// few thousand records). If the platform outgrows that, swap this file for
// Postgres/Supabase; nothing else in the app touches storage directly.

const fs = require('fs');
const path = require('path');

const onNetlify = () => !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY_BLOBS_CONTEXT);

// ---------- Netlify Blobs ----------
function blobsStore(name) {
  const { getStore } = require('@netlify/blobs');
  return getStore(name);
}

const blobsImpl = {
  async get(store, key) {
    return blobsStore(store).get(key, { type: 'json' }).catch(() => null);
  },
  async set(store, key, value) {
    await blobsStore(store).setJSON(key, value);
  },
  async del(store, key) {
    await blobsStore(store).delete(key).catch(() => {});
  },
  async list(store) {
    const s = blobsStore(store);
    const { blobs } = await s.list();
    const out = [];
    for (let i = 0; i < blobs.length; i += 25) {
      const batch = blobs.slice(i, i + 25);
      const vals = await Promise.all(batch.map((b) => s.get(b.key, { type: 'json' }).catch(() => null)));
      vals.forEach((v, j) => { if (v) out.push(v); });
    }
    return out;
  }
};

// ---------- JSON files ----------
function dataDir() {
  return process.env.SHOREMATCH_DATA_DIR || path.join(__dirname, '..', '..', '..', '.data');
}
function safeName(s) {
  // Keys are generated ids / emails; never allow path traversal.
  return encodeURIComponent(String(s)).replace(/\./g, '%2E');
}
function storeDir(store) {
  const dir = path.join(dataDir(), safeName(store));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const fileImpl = {
  async get(store, key) {
    try {
      return JSON.parse(fs.readFileSync(path.join(storeDir(store), safeName(key) + '.json'), 'utf8'));
    } catch (e) {
      return null;
    }
  },
  async set(store, key, value) {
    const file = path.join(storeDir(store), safeName(key) + '.json');
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, file); // atomic replace
  },
  async del(store, key) {
    try { fs.unlinkSync(path.join(storeDir(store), safeName(key) + '.json')); } catch (e) { /* already gone */ }
  },
  async list(store) {
    const dir = storeDir(store);
    const out = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try { out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch (e) { /* skip corrupt */ }
    }
    return out;
  }
};

const impl = () => (onNetlify() ? blobsImpl : fileImpl);

module.exports = {
  get: (s, k) => impl().get(s, k),
  set: (s, k, v) => impl().set(s, k, v),
  del: (s, k) => impl().del(s, k),
  list: (s) => impl().list(s),
  onNetlify
};
