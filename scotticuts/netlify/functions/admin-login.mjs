import { makeToken, safeEqual, json } from './_lib.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let b = {};
  try { b = await req.json(); } catch { /* empty */ }

  await new Promise((r) => setTimeout(r, 400)); // slow down brute force

  const user = process.env.ADMIN_USER, pass = process.env.ADMIN_PASS;
  if (!user || !pass) return json({ error: 'Admin login isn’t set up yet.' }, 503);
  const ok = safeEqual(b.username, user) & safeEqual(b.password, pass);
  if (!ok) return json({ error: 'Invalid username or password.' }, 401);
  return json({ token: makeToken('admin') });
};

export const config = { path: '/api/admin-login' };
