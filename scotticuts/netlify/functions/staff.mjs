import { randomBytes } from 'node:crypto';
import {
  store, authOf, mutateDoc, getEmployee, teamKey, imgKey, validId, publicEmployee, MAX_IMAGES,
  checkPassword, hashPassword, json, clean,
} from './_lib.mjs';

const MAX_BYTES = 5 * 1024 * 1024;

function sniff(buf) {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

// Staff may only touch their own profile; the owner (admin) may touch anyone's by passing `emp`.
function target(auth, emp) {
  if (!auth) return null;
  if (auth.role === 'staff') return auth.id;
  if (auth.role === 'admin' && validId(emp)) return emp;
  return null;
}

const mutateEmp = (id, fn, s) => mutateDoc(teamKey(id), () => ({}), fn, s);
const reply = (out) => (out.error ? json({ error: out.error }, out.status || 400) : json({ ok: true, employee: publicEmployee(out.doc) }));

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = authOf(req);
  if (!auth) return json({ error: 'Please log in again.' }, 401);
  const s = store();
  const url = new URL(req.url);

  /* ---- image upload: raw bytes in the body ---- */
  if (url.pathname.endsWith('/staff-upload')) {
    const id = target(auth, url.searchParams.get('emp'));
    const kind = url.searchParams.get('kind');
    if (!id || !['photo', 'portfolio'].includes(kind)) return json({ error: 'Bad request.' }, 400);
    const cur = await getEmployee(id, s);
    if (!cur) return json({ error: 'Profile not found.' }, 404);

    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > MAX_BYTES) return json({ error: 'Image must be under 5 MB.' }, 413);
    const type = sniff(buf);
    if (!type) return json({ error: 'Please upload a JPG, PNG or WebP image.' }, 415);
    if (kind === 'portfolio' && (cur.portfolio || []).length >= MAX_IMAGES) return json({ error: `Portfolio is full (${MAX_IMAGES} photos max).` }, 400);

    const imgId = randomBytes(6).toString('hex');
    await s.set(imgKey(id, imgId), buf, { metadata: { contentType: type } });

    let oldPhoto = null;
    const out = await mutateEmp(id, (e) => {
      if (!e.id) return { error: 'Profile not found.', status: 404 };
      if (kind === 'photo') { oldPhoto = e.photo; e.photo = imgId; }
      else {
        e.portfolio = e.portfolio || [];
        if (e.portfolio.length >= MAX_IMAGES) return { error: 'Portfolio is full.' };
        e.portfolio.push({ id: imgId, caption: '', added: new Date().toISOString() });
      }
    }, s);
    if (out.error) { await s.delete(imgKey(id, imgId)).catch(() => {}); return json({ error: out.error }, out.status || 400); }
    if (oldPhoto) await s.delete(imgKey(id, oldPhoto)).catch(() => {});
    return reply(out);
  }

  /* ---- JSON actions ---- */
  let b = {};
  try { b = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const id = target(auth, b.emp);
  if (!id) return json({ error: 'Choose a barber.' }, 400);
  const cur = await getEmployee(id, s);
  if (!cur) return json({ error: 'Profile not found.' }, 404);

  switch (b.action) {
    case 'me':
      return json({ employee: { ...publicEmployee(cur), username: cur.username } });

    case 'saveProfile': {
      const name = clean(b.name, 60);
      if (name.length < 2) return json({ error: 'Please enter a name.' }, 400);
      return reply(await mutateEmp(id, (e) => {
        e.name = name; e.title = clean(b.title, 60);
        e.bio = String(b.bio ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, 800);
      }, s));
    }

    case 'setCaption':
      return reply(await mutateEmp(id, (e) => {
        const p = (e.portfolio || []).find((x) => x.id === b.imageId);
        if (!p) return { error: 'Photo not found.', status: 404 };
        p.caption = clean(b.caption, 100);
      }, s));

    case 'deleteImage': {
      let gone = null;
      const out = await mutateEmp(id, (e) => {
        if (b.imageId === 'photo') { gone = e.photo; e.photo = null; return; }
        const i = (e.portfolio || []).findIndex((x) => x.id === b.imageId);
        if (i < 0) return { error: 'Photo not found.', status: 404 };
        gone = e.portfolio[i].id;
        e.portfolio.splice(i, 1);
      }, s);
      if (!out.error && gone) await s.delete(imgKey(id, gone)).catch(() => {});
      return reply(out);
    }

    case 'changePassword': {
      const next = String(b.newPassword || '');
      if (next.length < 8) return json({ error: 'Use at least 8 characters.' }, 400);
      if (auth.role === 'staff' && !checkPassword(b.currentPassword, cur.passHash)) return json({ error: 'Current password is wrong.' }, 403);
      return reply(await mutateEmp(id, (e) => { e.passHash = hashPassword(next); }, s));
    }

    default:
      return json({ error: 'Unknown action.' }, 400);
  }
};

export const config = { path: ['/api/staff', '/api/staff-upload'] };
