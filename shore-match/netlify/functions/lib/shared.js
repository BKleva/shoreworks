const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const { HttpError } = require('./http');

const S = {
  users: 'users',
  emails: 'emails',
  profiles: 'profiles',
  proposals: 'proposals',
  connections: 'connections',
  saves: 'saves'
};

const newId = () => crypto.randomBytes(9).toString('base64url');
const nowIso = () => new Date().toISOString();
const ids = (arr) => arr.map((x) => x.id);

function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(String(email).toLowerCase());
}

function requireRole(ctx, ...roles) {
  if (!ctx.user) throw new HttpError(401, 'Please log in');
  if (!roles.includes(ctx.user.role)) throw new HttpError(403, 'Not available for your account type');
}

function requireProfile(ctx) {
  if (!ctx.profile) {
    throw new HttpError(400, 'Complete your profile first', { code: 'profile_required' });
  }
}

// ---- shapers: decide exactly which fields leave the server ----
const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s || '');

function startupCard(p) {
  if (!p) return null;
  return {
    id: p.userId, companyName: p.companyName, tagline: p.tagline, town: p.town,
    industry: p.industry, website: p.website, verified: !!p.verified
  };
}

function investorCard(p, { full = false } = {}) {
  if (!p) return null;
  return {
    id: p.userId, displayName: p.displayName, firm: p.firm, town: p.town,
    bio: full ? p.bio : trunc(p.bio, 240),
    industries: p.industries, stages: p.stages, instruments: p.instruments,
    checkMin: p.checkMin, checkMax: p.checkMax, openToPitches: p.openToPitches !== false,
    website: p.website, verified: !!p.verified
  };
}

function proposalCard(pr, startupProfile) {
  return {
    id: pr.id, title: pr.title, summary: pr.summary, industry: pr.industry, stage: pr.stage,
    instrument: pr.instrument, ask: pr.ask, minCheck: pr.minCheck, town: pr.town,
    status: pr.status, createdAt: pr.createdAt, updatedAt: pr.updatedAt,
    startup: startupCard(startupProfile)
  };
}

const FULL_PROPOSAL_FIELDS = ['problem', 'solution', 'traction', 'useOfFunds', 'deckUrl'];
function proposalFull(pr, startupProfile) {
  const card = proposalCard(pr, startupProfile);
  for (const f of FULL_PROPOSAL_FIELDS) card[f] = pr[f];
  card.hidden = !!pr.hidden;
  return card;
}

// ---- connections ----
const connId = (proposalId, investorId) => `${proposalId}_${investorId}`;

async function connectionsFor(user) {
  const all = await db.list(S.connections);
  const key = user.role === 'startup' ? 'startupId' : 'investorId';
  return all.filter((c) => c[key] === user.id);
}

function unreadCount(conn, role) {
  const readAt = (conn.readAt && conn.readAt[role]) || '';
  return conn.messages.filter((m) => m.from !== role && m.at > readAt).length;
}

async function profileMap() {
  const all = await db.list(S.profiles);
  const map = new Map();
  all.forEach((p) => map.set(p.userId, p));
  return map;
}

async function userIsActive(id) {
  const u = await db.get(S.users, id);
  return !!u && !u.disabled;
}

module.exports = {
  S, db, config, newId, nowIso, ids, isAdminEmail, requireRole, requireProfile, trunc,
  startupCard, investorCard, proposalCard, proposalFull, connId, connectionsFor, unreadCount,
  profileMap, userIsActive
};
