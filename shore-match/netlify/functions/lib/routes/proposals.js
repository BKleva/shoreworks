const { S, db, config, nowIso, newId, requireRole, requireProfile, proposalCard, proposalFull, startupCard,
  profileMap, userIsActive } = require('../shared');
const { clean, ValidationError } = require('../validate');
const { HttpError } = require('../http');
const { scoreMatch } = require('../match');

const stageIds = config.stages.map((s) => s.id);
const instrumentIds = config.instruments.map((i) => i.id);
const statusIds = config.proposalStatuses.map((s) => s.id);

const SPEC = {
  title: { type: 'string', required: true, max: 120, label: 'Title' },
  summary: { type: 'text', required: true, max: 600, min: 20, label: 'Summary' },
  problem: { type: 'text', max: 3000, label: 'Problem' },
  solution: { type: 'text', max: 3000, label: 'Solution' },
  traction: { type: 'text', max: 3000, label: 'Traction' },
  useOfFunds: { type: 'text', max: 2000, label: 'Use of funds' },
  industry: { type: 'enum', enum: config.industries, required: true, label: 'Industry' },
  stage: { type: 'enum', enum: stageIds, required: true, label: 'Stage' },
  instrument: { type: 'enum', enum: instrumentIds, required: true, label: 'Deal type' },
  ask: { type: 'int', min: 1000, max: 1e9, required: true, label: 'Amount raising' },
  minCheck: { type: 'int', min: 0, max: 1e9, label: 'Minimum check' },
  town: { type: 'string', max: 80, label: 'Town' },
  deckUrl: { type: 'url', label: 'Pitch deck link' },
  status: { type: 'enum', enum: statusIds, required: true, label: 'Status' }
};

function validateProposal(body) {
  const d = clean(body, SPEC);
  if (d.minCheck != null && d.minCheck > d.ask) {
    throw new ValidationError({ minCheck: 'Minimum check cannot exceed the amount raising' });
  }
  return d;
}

async function mine(ctx) {
  requireRole(ctx, 'startup');
  const props = (await db.list(S.proposals)).filter((p) => p.ownerId === ctx.user.id);
  const conns = await db.list(S.connections);
  const out = props.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => {
    const cs = conns.filter((c) => c.proposalId === p.id);
    return {
      ...proposalFull(p, ctx.profile),
      counts: {
        pending: cs.filter((c) => c.status === 'pending').length,
        awaitingMe: cs.filter((c) => c.status === 'pending' && c.initiatedBy === 'investor').length,
        accepted: cs.filter((c) => c.status === 'accepted').length
      }
    };
  });
  return { status: 200, data: { proposals: out } };
}

async function create(ctx) {
  requireRole(ctx, 'startup');
  const data = validateProposal(ctx.body);
  if (data.status === 'open') requireProfile(ctx);
  const mineCount = (await db.list(S.proposals)).filter((p) => p.ownerId === ctx.user.id).length;
  if (mineCount >= 10) throw new HttpError(400, 'You can have up to 10 proposals. Close or delete one first.');
  const t = nowIso();
  const pr = { ...data, id: newId(), ownerId: ctx.user.id, hidden: false, createdAt: t, updatedAt: t };
  if (!pr.town && ctx.profile) pr.town = ctx.profile.town;
  await db.set(S.proposals, pr.id, pr);
  return { status: 201, data: { proposal: proposalFull(pr, ctx.profile) } };
}

async function loadOwned(ctx) {
  const pr = await db.get(S.proposals, ctx.params.id);
  if (!pr || pr.ownerId !== ctx.user.id) throw new HttpError(404, 'Proposal not found');
  return pr;
}

async function update(ctx) {
  requireRole(ctx, 'startup');
  const pr = await loadOwned(ctx);
  const data = validateProposal(ctx.body);
  if (data.status === 'open') requireProfile(ctx);
  if (pr.hidden && data.status === 'open') throw new HttpError(403, 'This proposal was hidden by a moderator');
  const next = { ...pr, ...data, updatedAt: nowIso() };
  await db.set(S.proposals, pr.id, next);
  return { status: 200, data: { proposal: proposalFull(next, ctx.profile) } };
}

async function remove(ctx) {
  requireRole(ctx, 'startup');
  const pr = await loadOwned(ctx);
  for (const c of await db.list(S.connections)) if (c.proposalId === pr.id) await db.del(S.connections, c.id);
  await db.del(S.proposals, pr.id);
  return { status: 200, data: { ok: true } };
}

// An investor can see a proposal if it is open & visible, or they already have a connection to it.
async function visibleToInvestor(pr, investorId) {
  if (!pr) return false;
  if (pr.hidden) return false;
  if (pr.status === 'open') return true;
  const conn = await db.get(S.connections, `${pr.id}_${investorId}`);
  return !!conn;
}

async function get(ctx) {
  requireRole(ctx, 'startup', 'investor');
  const pr = await db.get(S.proposals, ctx.params.id);
  if (!pr) throw new HttpError(404, 'Proposal not found');
  const startup = await db.get(S.profiles, pr.ownerId);

  if (ctx.user.role === 'startup') {
    if (pr.ownerId !== ctx.user.id) throw new HttpError(404, 'Proposal not found');
    return { status: 200, data: { proposal: proposalFull(pr, startup), owner: true } };
  }
  if (!(await visibleToInvestor(pr, ctx.user.id)) || !(await userIsActive(pr.ownerId))) {
    throw new HttpError(404, 'Proposal not found');
  }
  const conn = await db.get(S.connections, `${pr.id}_${ctx.user.id}`);
  const saves = (await db.get(S.saves, ctx.user.id)) || { proposalIds: [] };
  return {
    status: 200,
    data: {
      proposal: proposalFull(pr, startup),
      owner: false,
      match: ctx.profile ? scoreMatch(pr, ctx.profile) : null,
      saved: saves.proposalIds.includes(pr.id),
      connection: conn ? { id: conn.id, status: conn.status } : null,
      startupAbout: startup ? startup.about : '',
      startupTeamSize: startup ? startup.teamSize : null,
      startupFounded: startup ? startup.founded : null
    }
  };
}

// Investors browse open proposals.
async function browse(ctx) {
  requireRole(ctx, 'investor');
  const { industry, stage, town, instrument, sort } = ctx.query;
  const q = (ctx.query.q || '').trim().toLowerCase().slice(0, 100);
  const minAsk = parseInt(ctx.query.minAsk, 10);
  const maxAsk = parseInt(ctx.query.maxAsk, 10);

  const [all, profiles, saves, conns] = await Promise.all([
    db.list(S.proposals), profileMap(), db.get(S.saves, ctx.user.id), db.list(S.connections)
  ]);
  const saved = new Set((saves && saves.proposalIds) || []);
  const myConns = new Map(conns.filter((c) => c.investorId === ctx.user.id).map((c) => [c.proposalId, c]));

  const rows = [];
  for (const pr of all) {
    if (pr.status !== 'open' || pr.hidden) continue;
    const sp = profiles.get(pr.ownerId);
    if (!sp) continue;
    if (industry && pr.industry !== industry) continue;
    if (stage && pr.stage !== stage) continue;
    if (instrument && pr.instrument !== instrument) continue;
    if (town && (pr.town || '').toLowerCase() !== town.toLowerCase()) continue;
    if (Number.isFinite(minAsk) && pr.ask < minAsk) continue;
    if (Number.isFinite(maxAsk) && pr.ask > maxAsk) continue;
    if (q && !([pr.title, pr.summary, sp.companyName, sp.tagline].join(' ').toLowerCase().includes(q))) continue;
    const conn = myConns.get(pr.id);
    rows.push({
      ...proposalCard(pr, sp),
      match: ctx.profile ? scoreMatch(pr, ctx.profile) : null,
      saved: saved.has(pr.id),
      connection: conn ? { id: conn.id, status: conn.status } : null
    });
  }
  const bySort = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    'ask-asc': (a, b) => a.ask - b.ask,
    'ask-desc': (a, b) => b.ask - a.ask,
    match: (a, b) => ((b.match && b.match.score) || 0) - ((a.match && a.match.score) || 0) || b.createdAt.localeCompare(a.createdAt)
  };
  rows.sort(bySort[sort] || bySort.match);
  return { status: 200, data: { proposals: rows.slice(0, 200), total: rows.length } };
}

async function setSaved(ctx, on) {
  requireRole(ctx, 'investor');
  const pr = await db.get(S.proposals, ctx.params.id);
  if (!pr || !(await visibleToInvestor(pr, ctx.user.id))) throw new HttpError(404, 'Proposal not found');
  const rec = (await db.get(S.saves, ctx.user.id)) || { userId: ctx.user.id, proposalIds: [] };
  const set = new Set(rec.proposalIds);
  if (on) set.add(pr.id); else set.delete(pr.id);
  rec.proposalIds = [...set].slice(-500);
  await db.set(S.saves, ctx.user.id, rec);
  return { status: 200, data: { saved: on } };
}

async function listSaved(ctx) {
  requireRole(ctx, 'investor');
  const rec = (await db.get(S.saves, ctx.user.id)) || { proposalIds: [] };
  const profiles = await profileMap();
  const rows = [];
  for (const id of rec.proposalIds) {
    const pr = await db.get(S.proposals, id);
    if (!pr || pr.hidden || pr.status === 'draft') continue;
    rows.push({
      ...proposalCard(pr, profiles.get(pr.ownerId)),
      match: ctx.profile ? scoreMatch(pr, ctx.profile) : null,
      saved: true
    });
  }
  return { status: 200, data: { proposals: rows } };
}

module.exports = {
  mine, create, update, remove, get, browse,
  save: (ctx) => setSaved(ctx, true),
  unsave: (ctx) => setSaved(ctx, false),
  listSaved
};
