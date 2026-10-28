// Print-mail storage: the saved letter text and options, the signature, the prospect list, and the log of who has been mailed.
// The page does the work in the browser; this only keeps what it needs to remember between visits and devices.
import { requireAuth } from '../lib/auth.mjs';
import { del, getJSON, setJSON } from '../lib/store.mjs';

const json = (data, status = 200) => Response.json(data, { status });
const err = (msg, status = 400) => json({ error: msg }, status);
const MAX_BODY = 5.5 * 1024 * 1024;   // functions accept about 6 MB per request
const K = { settings: 'mail/settings', signature: 'mail/signature', prospects: 'mail/prospects', mailed: 'mail/mailed' };

async function body(req) {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_BODY) throw Object.assign(new Error('Too large to save'), { status: 413 });
  const text = await req.text();
  if (text.length > MAX_BODY) throw Object.assign(new Error('Too large to save'), { status: 413 });
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('Bad request'), { status: 400 }); }
}

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  const what = new URL(req.url).pathname.replace(/\/+$/, '').split('/').pop(), m = req.method;
  try {
    if (what === 'settings') {
      if (m === 'GET') return json((await getJSON(K.settings)) || {});
      if (m === 'PUT') { const b = await body(req); b.saved_at = new Date().toISOString(); await setJSON(K.settings, b); return json({ ok: true, saved_at: b.saved_at }); }
    }
    if (what === 'signature') {
      if (m === 'GET') return json((await getJSON(K.signature)) || { data_url: null });
      if (m === 'PUT') {
        const b = await body(req);
        if (b.data_url && !/^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(b.data_url)) return err('Not an image');
        if (b.data_url) await setJSON(K.signature, { data_url: b.data_url }); else await del(K.signature);
        return json({ ok: true });
      }
    }
    if (what === 'prospects') {
      if (m === 'GET') return json((await getJSON(K.prospects)) || {});
      if (m === 'PUT') { const b = await body(req); if (!Array.isArray(b.grid)) return err('No rows'); await setJSON(K.prospects, b); return json({ ok: true }); }
      if (m === 'DELETE') { await del(K.prospects); return json({ ok: true }); }
    }
    // Who has been mailed: { m: { personHash: [time, batchId, addressHash] }, b: { batchId: { at, format, label, n } } }
    if (what === 'mailed') {
      const cur = (await getJSON(K.mailed)) || { m: {}, b: {} };
      if (m === 'GET') return json(cur);
      if (m === 'POST') {
        const b = await body(req);
        if (!b.batch?.id || !Array.isArray(b.items)) return err('Bad request');
        cur.b[b.batch.id] = { at: b.batch.at, format: b.batch.format, label: String(b.batch.label || '').slice(0, 120), n: Math.max(cur.b[b.batch.id]?.n || 0, 0) + b.items.length };
        for (const [id, ah] of b.items) if (id) cur.m[id] = [b.batch.at, b.batch.id, ah || ''];
        await setJSON(K.mailed, cur);
        return json({ ok: true, total: Object.keys(cur.m).length });
      }
    }
    if (what === 'unmail' && m === 'POST') {
      const cur = (await getJSON(K.mailed)) || { m: {}, b: {} }, b = await body(req);
      for (const id of b.ids || []) delete cur.m[id];
      await setJSON(K.mailed, cur);
      return json({ ok: true, total: Object.keys(cur.m).length });
    }
    return err('Not found', 404);
  } catch (e) {
    return err(e.message || 'Failed', e.status || 500);
  }
};

export const config = { path: ['/api/mail/settings', '/api/mail/signature', '/api/mail/prospects', '/api/mail/mailed', '/api/mail/unmail'] };
