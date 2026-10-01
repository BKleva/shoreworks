import { clearFailures, makeToken, noteFailure, sessionCookie, throttled, verifyPassword } from '../lib/auth.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const ip = req.headers.get('x-nf-client-connection-ip') || context?.ip || 'unknown';
  if (await throttled(ip)) {
    return Response.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  }
  let body = {};
  try { body = await req.json(); } catch { /* empty */ }
  await new Promise((r) => setTimeout(r, 500)); // slow down guessing
  if (!verifyPassword(body.email, body.password)) {
    await noteFailure(ip);
    return Response.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }
  await clearFailures(ip);
  return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie(makeToken()) } });
};

export const config = { path: '/api/login' };
