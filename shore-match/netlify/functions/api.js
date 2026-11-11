// Single API entry point: /api/* is rewritten to this function (see netlify.toml).
// Routing, auth, CSRF checks and error handling live here; business logic is in lib/routes/.

const db = require('./lib/db');
const config = require('./lib/config');
const session = require('./lib/session');
const { json, HttpError, parseBody, clientIp, assertSameOrigin } = require('./lib/http');
const { ValidationError } = require('./lib/validate');

const auth = require('./lib/routes/auth');
const profile = require('./lib/routes/profile');
const proposals = require('./lib/routes/proposals');
const connections = require('./lib/routes/connections');
const admin = require('./lib/routes/admin');

// access: 'public' | 'user' (any logged-in) | 'admin'
const ROUTES = [
  ['GET', '/config', 'public', async () => ({ status: 200, data: config })],

  ['POST', '/auth/signup', 'public', auth.signup],
  ['POST', '/auth/login', 'public', auth.login],
  ['POST', '/auth/logout', 'public', auth.logout],
  ['GET', '/me', 'user', auth.me],
  ['POST', '/me/password', 'user', auth.changePassword],
  ['POST', '/me/delete', 'user', auth.deleteAccount],
  ['PUT', '/profile', 'user', profile.saveProfile],

  ['GET', '/investors', 'user', profile.listInvestors],
  ['GET', '/investors/:id', 'user', profile.getInvestor],

  ['GET', '/proposals', 'user', proposals.browse],
  ['GET', '/proposals/mine', 'user', proposals.mine],
  ['GET', '/proposals/saved', 'user', proposals.listSaved],
  ['POST', '/proposals', 'user', proposals.create],
  ['GET', '/proposals/:id', 'user', proposals.get],
  ['PUT', '/proposals/:id', 'user', proposals.update],
  ['DELETE', '/proposals/:id', 'user', proposals.remove],
  ['POST', '/proposals/:id/save', 'user', proposals.save],
  ['DELETE', '/proposals/:id/save', 'user', proposals.unsave],

  ['GET', '/connections', 'user', connections.list],
  ['POST', '/connections', 'user', connections.create],
  ['GET', '/connections/:id', 'user', connections.detail],
  ['POST', '/connections/:id/respond', 'user', connections.respond],
  ['POST', '/connections/:id/withdraw', 'user', connections.withdraw],
  ['POST', '/connections/:id/messages', 'user', connections.postMessage],
  ['PUT', '/connections/:id/stage', 'user', connections.setStage],

  ['GET', '/admin/overview', 'admin', admin.overview],
  ['POST', '/admin/users/:id/disabled', 'admin', admin.setDisabled],
  ['POST', '/admin/users/:id/delete', 'admin', admin.deleteUser],
  ['POST', '/admin/profiles/:id/verified', 'admin', admin.setVerified],
  ['POST', '/admin/proposals/:id/hidden', 'admin', admin.setHidden]
];

function match(method, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  let pathMatched = false;
  for (const [m, pattern, access, handler] of ROUTES) {
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i][0] === ':') params[pp[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (pp[i] !== parts[i]) { ok = false; break; }
    }
    if (!ok) continue;
    pathMatched = true;
    if (m === method) return { access, handler, params };
  }
  return { pathMatched };
}

async function loadSession(event) {
  const cookie = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  const uid = session.readSession(cookie);
  if (!uid) return {};
  const user = await db.get('users', uid);
  if (!user || user.disabled) return {};
  const profile = await db.get('profiles', uid);
  return { user, profile };
}

exports.handler = async (event) => {
  try {
    if (event.blobs) { try { require('@netlify/blobs').connectLambda(event); } catch (e) { /* not on Netlify */ } }

    const method = (event.httpMethod || 'GET').toUpperCase();
    const pathname = (event.path || '/').replace(/^\/(?:\.netlify\/functions\/api|api)(?=\/|$)/, '') || '/';
    const found = match(method, pathname);
    if (!found.handler) {
      return found.pathMatched ? json(405, { error: 'Method not allowed' }) : json(404, { error: 'Not found' });
    }
    if (method !== 'GET' && method !== 'HEAD') assertSameOrigin(event);

    const { user, profile: prof } = await loadSession(event);
    if (found.access !== 'public' && !user) throw new HttpError(401, 'Please log in');
    if (found.access === 'admin') {
      const { isAdminEmail } = require('./lib/shared');
      if (!isAdminEmail(user.email)) throw new HttpError(403, 'Admins only');
    }

    const ctx = {
      event, user, profile: prof, ip: clientIp(event),
      params: found.params,
      query: event.queryStringParameters || {},
      body: method === 'GET' || method === 'DELETE' ? {} : parseBody(event)
    };
    const result = await found.handler(ctx);
    return json(result.status, result.data, result.cookie ? { 'Set-Cookie': result.cookie } : undefined);
  } catch (err) {
    if (err instanceof ValidationError) return json(422, { error: 'Please fix the highlighted fields', fields: err.fields });
    if (err instanceof HttpError) return json(err.status, { error: err.message, ...(err.extra || {}) });
    console.error('Unhandled API error:', err);
    return json(500, { error: 'Something went wrong on our end. Please try again.' });
  }
};
