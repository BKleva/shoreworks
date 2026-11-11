const { S, db, config, nowIso, requireRole, investorCard, startupCard, proposalCard, userIsActive } = require('../shared');
const { clean, ValidationError } = require('../validate');
const { HttpError } = require('../http');
const { scoreMatch } = require('../match');

const industries = config.industries;
const stageIds = config.stages.map((s) => s.id);
const instrumentIds = config.instruments.map((i) => i.id);

const STARTUP_SPEC = {
  companyName: { type: 'string', required: true, max: 120, label: 'Company name' },
  tagline: { type: 'string', required: true, max: 140, label: 'One-line description' },
  about: { type: 'text', max: 3000, label: 'About the company' },
  website: { type: 'url', label: 'Website' },
  town: { type: 'string', required: true, max: 80, label: 'Town' },
  industry: { type: 'enum', enum: industries, required: true, label: 'Industry' },
  founded: { type: 'int', min: 1900, max: 2100, label: 'Year founded' },
  teamSize: { type: 'int', min: 1, max: 100000, label: 'Team size' }
};

const INVESTOR_SPEC = {
  displayName: { type: 'string', required: true, max: 120, label: 'Display name' },
  firm: { type: 'string', max: 120, label: 'Firm / fund' },
  bio: { type: 'text', required: true, max: 3000, label: 'Investment thesis / bio' },
  website: { type: 'url', label: 'Website' },
  town: { type: 'string', required: true, max: 80, label: 'Town' },
  industries: { type: 'enumList', enum: industries, label: 'Industries' },
  stages: { type: 'enumList', enum: stageIds, label: 'Stages' },
  instruments: { type: 'enumList', enum: instrumentIds, label: 'Deal types' },
  checkMin: { type: 'int', min: 0, max: 1e9, label: 'Minimum check' },
  checkMax: { type: 'int', min: 0, max: 1e9, label: 'Maximum check' }
};

async function saveProfile(ctx) {
  requireRole(ctx, 'startup', 'investor');
  const isInv = ctx.user.role === 'investor';
  const data = clean(ctx.body, isInv ? INVESTOR_SPEC : STARTUP_SPEC);
  if (isInv) {
    if (data.checkMin != null && data.checkMax != null && data.checkMax < data.checkMin) {
      throw new ValidationError({ checkMax: 'Maximum check must be at least the minimum' });
    }
    data.openToPitches = ctx.body.openToPitches !== false;
  }
  const profile = {
    ...data,
    userId: ctx.user.id,
    type: ctx.user.role,
    verified: ctx.profile ? !!ctx.profile.verified : false, // only admins change this
    createdAt: ctx.profile ? ctx.profile.createdAt : nowIso(),
    updatedAt: nowIso()
  };
  await db.set(S.profiles, ctx.user.id, profile);
  return { status: 200, data: { profile } };
}

function includesText(hay, q) {
  return hay.toLowerCase().includes(q);
}

// Startups browse investors. Each investor is scored against the caller's open proposals.
async function listInvestors(ctx) {
  requireRole(ctx, 'startup');
  const q = (ctx.query.q || '').trim().toLowerCase().slice(0, 100);
  const { industry, stage, town } = ctx.query;
  const myProposals = (await db.list(S.proposals)).filter((p) => p.ownerId === ctx.user.id && p.status === 'open');
  const profiles = (await db.list(S.profiles)).filter((p) => p.type === 'investor');

  const rows = [];
  for (const p of profiles) {
    if (!(await userIsActive(p.userId))) continue;
    if (industry && p.industries.length && !p.industries.includes(industry)) continue;
    if (stage && p.stages.length && !p.stages.includes(stage)) continue;
    if (town && (p.town || '').toLowerCase() !== town.toLowerCase()) continue;
    if (q && !includesText([p.displayName, p.firm, p.bio, p.town].join(' '), q)) continue;
    let best = null;
    for (const pr of myProposals) {
      const m = scoreMatch(pr, p);
      if (!best || m.score > best.score) best = { ...m, proposalId: pr.id, proposalTitle: pr.title };
    }
    rows.push({ ...investorCard(p), match: best });
  }
  rows.sort((a, b) => ((b.match && b.match.score) || 0) - ((a.match && a.match.score) || 0) ||
    a.displayName.localeCompare(b.displayName));
  return { status: 200, data: { investors: rows, hasOpenProposal: myProposals.length > 0 } };
}

async function getInvestor(ctx) {
  requireRole(ctx, 'startup');
  const p = await db.get(S.profiles, ctx.params.id);
  if (!p || p.type !== 'investor' || !(await userIsActive(p.userId))) throw new HttpError(404, 'Investor not found');
  const mine = (await db.list(S.proposals)).filter((pr) => pr.ownerId === ctx.user.id);
  const conns = (await db.list(S.connections)).filter((c) => c.startupId === ctx.user.id && c.investorId === p.userId);
  const connByProposal = new Map(conns.map((c) => [c.proposalId, c]));
  const proposals = mine.map((pr) => ({
    ...proposalCard(pr, null),
    match: scoreMatch(pr, p),
    connection: connByProposal.has(pr.id)
      ? { id: connByProposal.get(pr.id).id, status: connByProposal.get(pr.id).status } : null
  }));
  return { status: 200, data: { investor: investorCard(p, { full: true }), proposals } };
}

module.exports = { saveProfile, listInvestors, getInvestor, STARTUP_SPEC, INVESTOR_SPEC };
