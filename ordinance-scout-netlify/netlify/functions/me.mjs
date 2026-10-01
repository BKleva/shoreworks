import { requireAuth } from '../lib/auth.mjs';

export default async (req) => requireAuth(req) || Response.json({ email: (process.env.OI_LOGIN_EMAIL || '').toLowerCase() });

export const config = { path: '/api/me' };
