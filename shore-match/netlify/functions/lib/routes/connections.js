const { S, db, config, nowIso, newId, requireRole, requireProfile, connId, connectionsFor, unreadCount,
  proposalCard, startupCard, investorCard, profileMap, userIsActive } = require('../shared');
const { clean } = require('../validate');
const { HttpError } = require('../http');
const { scoreMatch } = require('../match');

const MAX_PENDING_OUT = 15;
const MAX_MESSAGES = 300;
const stageIds = config.pipelineStages.map((s) => s.id);

const MESSAGE_SPEC = { message: { type: 'text', required: true, max: 2000, label: 'Message' } };

function otherRole(role) { return role === 'startup' ? 'investor' : 'startup'; }

// Shapes a connection for the viewer. Contact details appear only once accepted.
async function shape(conn, viewer, profiles, { detail = false } = {}) {
  const proposal = await db.get(S.proposals, conn.proposalId);
  const sp = profiles.get(conn.startupId);
  const ip = profiles.get(conn.investorId);
  const out = {
    id: conn.id,
    status: conn.status,
    initiatedBy: conn.initiatedBy,
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt,
    unread: unreadCount(conn, viewer.role),
    lastMessage: conn.messages.length ? conn.messages[conn.messages.length - 1] : null,
    proposal: proposal ? proposalCard(proposal, sp) : null,
    startup: startupCard(sp),
    investor: investorCard(ip),
    awaitingMe: conn.status === 'pending' && conn.initiatedBy !== viewer.role
  };
  if (viewer.role === 'investor') {
    out.stage = conn.stage;
    if (detail) out.notes = conn.notes || '';
    if (proposal && ip) out.match = scoreMatch(proposal, ip);
  }
  if (conn.status === 'accepted') {
    const other = otherRole(viewer.role);
    const otherUser = await db.get(S.users, other === 'startup' ? conn.startupId : conn.investorId);
    if (otherUser) {
      const prof = other === 'startup' ? sp : ip;
      out.contact = { name: otherUser.name, email: otherUser.email, website: prof ? prof.website : '' };
    }
  }
  if (detail) {
    out.messages = conn.messages;
    out.declinedBy = conn.status === 'declined' ? conn.declinedBy : undefined;
  }
  return out;
}

async function list(ctx) {
  requireRole(ctx, 'startup', 'investor');
  const conns = await connectionsFor(ctx.user);
  const profiles = await profileMap();
  const rows = [];
  for (const c of conns) rows.push(await shape(c, ctx.user, profiles));
  rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { status: 200, data: { connections: rows } };
}

async function loadMine(ctx) {
  const c = await db.get(S.connections, ctx.params.id);
  const key = ctx.user.role === 'startup' ? 'startupId' : 'investorId';
  if (!c || c[key] !== ctx.user.id) throw new HttpError(404, 'Conversation not found');
  return c;
}

async function detail(ctx) {
  requireRole(ctx, 'startup', 'investor');
  const c = await loadMine(ctx);
  // Opening the thread marks it read for the viewer.
  c.readAt = { ...(c.readAt || {}), [ctx.user.role]: nowIso() };
  await db.set(S.connections, c.id, c);
  const profiles = await profileMap();
  return { status: 200, data: { connection: await shape(c, ctx.user, profiles, { detail: true }) } };
}

// Create an intro (startup -> investor) or express interest (investor -> proposal).
async function create(ctx) {
  requireRole(ctx, 'startup', 'investor');
  requireProfile(ctx);
  const role = ctx.user.role;
  const { message } = clean(ctx.body, MESSAGE_SPEC);

  const proposalId = typeof ctx.body.proposalId === 'string' ? ctx.body.proposalId : '';
  const proposal = proposalId ? await db.get(S.proposals, proposalId) : null;
  if (!proposal || proposal.hidden || proposal.status !== 'open') throw new HttpError(404, 'That proposal is not open to investors');

  let startupId; let investorId;
  if (role === 'startup') {
    if (proposal.ownerId !== ctx.user.id) throw new HttpError(403, 'You can only pitch your own proposals');
    startupId = ctx.user.id;
    investorId = typeof ctx.body.investorId === 'string' ? ctx.body.investorId : '';
    const ip = await db.get(S.profiles, investorId);
    if (!ip || ip.type !== 'investor' || !(await userIsActive(investorId))) throw new HttpError(404, 'Investor not found');
    if (ip.openToPitches === false) throw new HttpError(400, 'This investor is not accepting pitches right now');
  } else {
    if (!(await userIsActive(proposal.ownerId))) throw new HttpError(404, 'That proposal is not open to investors');
    startupId = proposal.ownerId;
    investorId = ctx.user.id;
  }

  const id = connId(proposalId, investorId);
  const existing = await db.get(S.connections, id);
  const t = nowIso();
  const msg = (from) => ({ id: newId(), from, body: message, at: t, intro: true });

  if (existing) {
    if (existing.status === 'accepted' || (existing.status === 'pending' && existing.initiatedBy === role)) {
      throw new HttpError(409, 'You already have a conversation open for this match', { connectionId: id });
    }
    if (existing.status === 'pending') {
      // Mutual interest: the other side already reached out, so connect immediately.
      existing.status = 'accepted';
      existing.messages.push({ id: newId(), from: role, body: message, at: t });
      existing.updatedAt = t;
      existing.readAt = { ...(existing.readAt || {}), [role]: t };
      await db.set(S.connections, id, existing);
      return { status: 200, data: { connectionId: id, status: 'accepted', mutual: true } };
    }
    if (existing.status === 'declined' && existing.declinedBy !== role) {
      throw new HttpError(409, 'This conversation was declined');
    }
    // withdrawn, or declined by me -> reopen as a fresh request from me
    existing.status = 'pending';
    existing.initiatedBy = role;
    existing.declinedBy = undefined;
    existing.messages = [msg(role)];
    existing.updatedAt = t;
    existing.readAt = { [role]: t };
    await db.set(S.connections, id, existing);
    return { status: 200, data: { connectionId: id, status: 'pending' } };
  }

  const mine = await connectionsFor(ctx.user);
  if (mine.filter((c) => c.status === 'pending' && c.initiatedBy === role).length >= MAX_PENDING_OUT) {
    throw new HttpError(429, `You have ${MAX_PENDING_OUT} requests waiting for a reply. Wait for responses before sending more.`);
  }

  const conn = {
    id, proposalId, startupId, investorId, initiatedBy: role, status: 'pending', stage: 'new', notes: '',
    messages: [msg(role)], createdAt: t, updatedAt: t, readAt: { [role]: t }
  };
  await db.set(S.connections, id, conn);
  return { status: 201, data: { connectionId: id, status: 'pending' } };
}

async function respond(ctx) {
  requireRole(ctx, 'startup', 'investor');
  const c = await loadMine(ctx);
  const action = ctx.body.action;
  if (!['accept', 'decline'].includes(action)) throw new HttpError(400, 'Unknown action');
  if (c.status !== 'pending') throw new HttpError(409, 'This request is no longer pending');
  if (c.initiatedBy === ctx.user.role) throw new HttpError(403, 'Waiting on the other party to respond');
  c.status = action === 'accept' ? 'accepted' : 'declined';
  if (action === 'decline') c.declinedBy = ctx.user.role;
  c.updatedAt = nowIso();
  c.readAt = { ...(c.readAt || {}), [ctx.user.role]: c.updatedAt };
  await db.set(S.connections, c.id, c);
  return { status: 200, data: { status: c.status } };
}

async function withdraw(ctx) {
  requireRole(ctx, 'startup', 'investor');
  const c = await loadMine(ctx);
  if (c.status !== 'pending' || c.initiatedBy !== ctx.user.role) throw new HttpError(409, 'Only your own pending requests can be withdrawn');
  c.status = 'withdrawn';
  c.updatedAt = nowIso();
  await db.set(S.connections, c.id, c);
  return { status: 200, data: { status: c.status } };
}

async function postMessage(ctx) {
  requireRole(ctx, 'startup', 'investor');
  const c = await loadMine(ctx);
  if (c.status !== 'accepted') throw new HttpError(409, 'Messaging opens once the request is accepted');
  if (c.messages.length >= MAX_MESSAGES) throw new HttpError(400, 'This conversation reached its message limit. Continue by email.');
  const { message } = clean(ctx.body, MESSAGE_SPEC);
  const t = nowIso();
  c.messages.push({ id: newId(), from: ctx.user.role, body: message, at: t });
  c.updatedAt = t;
  c.readAt = { ...(c.readAt || {}), [ctx.user.role]: t };
  await db.set(S.connections, c.id, c);
  return { status: 201, data: { message: c.messages[c.messages.length - 1] } };
}

// Investor-only deal tracking: pipeline stage + private notes the startup never sees.
async function setStage(ctx) {
  requireRole(ctx, 'investor');
  const c = await loadMine(ctx);
  const data = clean(ctx.body, {
    stage: { type: 'enum', enum: stageIds, required: true, label: 'Stage' },
    notes: { type: 'text', max: 4000, label: 'Notes' }
  });
  c.stage = data.stage;
  c.notes = data.notes;
  await db.set(S.connections, c.id, c);
  return { status: 200, data: { stage: c.stage, notes: c.notes } };
}

module.exports = { list, detail, create, respond, withdraw, postMessage, setStage };
