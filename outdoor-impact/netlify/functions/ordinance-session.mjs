import { verifyToken, bearer } from './_auth.mjs';

// Lets the admin page confirm a stored session token is still valid
// (signed by this server and not expired) with a real round trip,
// instead of trusting whatever is sitting in the browser's sessionStorage.
export default async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  if (!verifyToken(bearer(req))) {
    return Response.json({ ok: false }, { status: 401 });
  }
  return Response.json({ ok: true });
};

export const config = { path: '/api/ordinance-session' };
