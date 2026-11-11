const bcrypt = require('bcryptjs');
const { S, db, newId, nowIso, isAdminEmail, connectionsFor, unreadCount } = require('../shared');
const { clean, ValidationError } = require('../validate');
const { HttpError } = require('../http');
const session = require('../session');
const rl = require('../ratelimit');

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, isAdmin: isAdminEmail(u.email) };
}

async function me(ctx) {
  const conns = await connectionsFor(ctx.user);
  const unread = conns.reduce((n, c) => n + unreadCount(c, ctx.user.role), 0);
  const pendingForMe = conns.filter((c) => c.status === 'pending' && c.initiatedBy !== ctx.user.role).length;
  return { status: 200, data: { user: publicUser(ctx.user), profile: ctx.profile || null, unread, pendingForMe } };
}

async function signup(ctx) {
  const ip = ctx.ip;
  const limit = await rl.check('signup', ip, 10);
  if (limit.blocked) throw new HttpError(429, 'Too many sign-ups from this network. Try again later.');

  const b = ctx.body;
  const errors = {};
  let data = {};
  try {
    data = clean(b, {
      name: { type: 'string', required: true, max: 80, label: 'Name' },
      email: { type: 'email', required: true, label: 'Email' },
      role: { type: 'enum', enum: ['startup', 'investor'], required: true, label: 'Account type' }
    });
  } catch (e) {
    if (!(e instanceof ValidationError)) throw e;
    Object.assign(errors, e.fields); // keep going so the user sees every problem at once
  }
  const password = typeof b.password === 'string' ? b.password : '';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (password.length > 100) errors.password = 'Password is too long';
  if (b.agree !== true) errors.agree = 'You must accept the terms to continue';
  if (data.role === 'investor' && b.accreditedAck !== true) {
    errors.accreditedAck = 'Please confirm the investor acknowledgement';
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);

  await rl.hit(limit);

  if (await db.get(S.emails, data.email)) {
    throw new ValidationError({ email: 'An account with this email already exists' });
  }

  const user = {
    id: newId(), email: data.email, name: data.name, role: data.role,
    passwordHash: await bcrypt.hash(password, 10), createdAt: nowIso(), disabled: false,
    agreedAt: nowIso(), accreditedAck: data.role === 'investor'
  };
  await db.set(S.users, user.id, user);
  await db.set(S.emails, user.email, { userId: user.id });

  return { status: 201, data: { user: publicUser(user) }, cookie: session.createCookie(user.id) };
}

async function login(ctx) {
  const limit = await rl.check('login', ctx.ip, 8);
  if (limit.blocked) throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`);

  const email = typeof ctx.body.email === 'string' ? ctx.body.email.trim().toLowerCase() : '';
  const password = typeof ctx.body.password === 'string' ? ctx.body.password : '';
  const idx = email ? await db.get(S.emails, email) : null;
  const user = idx ? await db.get(S.users, idx.userId) : null;

  // Always run a bcrypt compare so timing doesn't reveal whether the email exists.
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok || user.disabled) {
    await rl.hit(limit);
    throw new HttpError(401, user && user.disabled ? 'This account has been disabled' : 'Incorrect email or password');
  }
  await rl.clear(limit);
  return { status: 200, data: { user: publicUser(user) }, cookie: session.createCookie(user.id) };
}

async function logout() {
  return { status: 200, data: { ok: true }, cookie: session.clearCookie() };
}

async function changePassword(ctx) {
  const { current, next } = ctx.body;
  if (typeof next !== 'string' || next.length < 8 || next.length > 100) {
    throw new ValidationError({ next: 'New password must be 8-100 characters' });
  }
  if (typeof current !== 'string' || !(await bcrypt.compare(current, ctx.user.passwordHash))) {
    throw new ValidationError({ current: 'Current password is incorrect' });
  }
  ctx.user.passwordHash = await bcrypt.hash(next, 10);
  await db.set(S.users, ctx.user.id, ctx.user);
  return { status: 200, data: { ok: true } };
}

// Self-serve account deletion: removes the user and everything tied to them.
async function deleteAccount(ctx) {
  if (typeof ctx.body.password !== 'string' || !(await bcrypt.compare(ctx.body.password, ctx.user.passwordHash))) {
    throw new ValidationError({ password: 'Password is incorrect' });
  }
  await purgeUser(ctx.user);
  return { status: 200, data: { ok: true }, cookie: session.clearCookie() };
}

async function purgeUser(user) {
  const conns = await connectionsFor(user);
  if (user.role === 'startup') {
    const proposals = (await db.list(S.proposals)).filter((p) => p.ownerId === user.id);
    const pids = new Set(proposals.map((p) => p.id));
    for (const c of await db.list(S.connections)) if (pids.has(c.proposalId)) await db.del(S.connections, c.id);
    for (const p of proposals) await db.del(S.proposals, p.id);
  } else {
    for (const c of conns) await db.del(S.connections, c.id);
    await db.del(S.saves, user.id);
  }
  await db.del(S.profiles, user.id);
  await db.del(S.emails, user.email);
  await db.del(S.users, user.id);
}

module.exports = { me, signup, login, logout, changePassword, deleteAccount, purgeUser, publicUser };
