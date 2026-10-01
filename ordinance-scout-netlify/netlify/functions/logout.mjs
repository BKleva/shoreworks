import { COOKIE } from '../lib/auth.mjs';

export default async () =>
  Response.json({ ok: true }, { headers: { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });

export const config = { path: '/api/logout' };
