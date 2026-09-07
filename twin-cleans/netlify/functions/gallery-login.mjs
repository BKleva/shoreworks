import { makeToken, safeEqual } from './_auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Slow down brute-force attempts a little.
  await new Promise((r) => setTimeout(r, 400));

  const userOk = safeEqual(body.username, process.env.ADMIN_USER);
  const passOk = safeEqual(body.password, process.env.ADMIN_PASS);

  if (!userOk || !passOk) {
    return Response.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  return Response.json({ token: makeToken() });
};

export const config = { path: '/api/gallery-login' };
