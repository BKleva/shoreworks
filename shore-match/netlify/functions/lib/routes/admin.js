const { S, db, isAdminEmail, profileMap, proposalFull } = require('../shared');
const { HttpError } = require('../http');
const { purgeUser } = require('./auth');

async function overview() {
  const [users, proposals, conns, profiles] = await Promise.all([
    db.list(S.users), db.list(S.proposals), db.list(S.connections), profileMap()
  ]);
  return {
    status: 200,
    data: {
      stats: {
        startups: users.filter((u) => u.role === 'startup').length,
        investors: users.filter((u) => u.role === 'investor').length,
        proposals: proposals.length,
        openProposals: proposals.filter((p) => p.status === 'open').length,
        connections: conns.length,
        accepted: conns.filter((c) => c.status === 'accepted').length
      },
      users: users.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((u) => {
        const p = profiles.get(u.id);
        return {
          id: u.id, name: u.name, email: u.email, role: u.role, disabled: !!u.disabled,
          createdAt: u.createdAt, isAdmin: isAdminEmail(u.email),
          hasProfile: !!p, verified: !!(p && p.verified),
          label: p ? (p.companyName || p.displayName) : ''
        };
      }),
      proposals: proposals.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((p) => proposalFull(p, profiles.get(p.ownerId)))
    }
  };
}

async function loadUser(id) {
  const u = await db.get(S.users, id);
  if (!u) throw new HttpError(404, 'User not found');
  return u;
}

async function setDisabled(ctx) {
  const u = await loadUser(ctx.params.id);
  if (u.id === ctx.user.id) throw new HttpError(400, "You can't disable your own account");
  if (isAdminEmail(u.email)) throw new HttpError(400, "Admins can't be disabled here");
  u.disabled = ctx.body.disabled === true;
  await db.set(S.users, u.id, u);
  return { status: 200, data: { disabled: u.disabled } };
}

async function setVerified(ctx) {
  const p = await db.get(S.profiles, ctx.params.id);
  if (!p) throw new HttpError(404, 'Profile not found');
  p.verified = ctx.body.verified === true;
  await db.set(S.profiles, p.userId, p);
  return { status: 200, data: { verified: p.verified } };
}

async function setHidden(ctx) {
  const pr = await db.get(S.proposals, ctx.params.id);
  if (!pr) throw new HttpError(404, 'Proposal not found');
  pr.hidden = ctx.body.hidden === true;
  await db.set(S.proposals, pr.id, pr);
  return { status: 200, data: { hidden: pr.hidden } };
}

async function deleteUser(ctx) {
  const u = await loadUser(ctx.params.id);
  if (u.id === ctx.user.id || isAdminEmail(u.email)) throw new HttpError(400, "Admin accounts can't be deleted here");
  await purgeUser(u);
  return { status: 200, data: { ok: true } };
}

module.exports = { overview, setDisabled, setVerified, setHidden, deleteUser };
