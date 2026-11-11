const test = require('node:test');
const assert = require('node:assert');
const { Client, signup, startupProfile, investorProfile, proposal } = require('./helpers');

test('signup validates input, blocks duplicates, and logs in/out', async () => {
  const c = new Client();
  let r = await c.post('/api/auth/signup', { name: 'A', email: 'bad', password: 'short', role: 'startup', agree: false });
  assert.strictEqual(r.status, 422);
  assert.ok(r.body.fields.email && r.body.fields.password && r.body.fields.agree);

  r = await c.post('/api/auth/signup', { name: 'Inv', email: 'x@example.com', password: 'password123', role: 'investor', agree: true });
  assert.strictEqual(r.status, 422, 'investors must tick the acknowledgement');
  assert.ok(r.body.fields.accreditedAck);

  const s = await signup('startup', { email: 'dupe@example.com' });
  r = await new Client().post('/api/auth/signup', { name: 'B', email: 'DUPE@example.com', password: 'password123', role: 'startup', agree: true });
  assert.strictEqual(r.status, 422);

  assert.strictEqual((await s.get('/api/me')).body.user.email, 'dupe@example.com');
  await s.post('/api/auth/logout');
  assert.strictEqual((await s.get('/api/me')).status, 401);

  r = await s.post('/api/auth/login', { email: 'dupe@example.com', password: 'wrong' });
  assert.strictEqual(r.status, 401);
  r = await s.post('/api/auth/login', { email: 'dupe@example.com', password: 'password123' });
  assert.strictEqual(r.status, 200);
});

test('password hash never leaves the server', async () => {
  const s = await signup('startup');
  const me = JSON.stringify((await s.get('/api/me')).body);
  assert.ok(!/passwordHash|\$2[aby]\$/.test(me));
});

test('login is rate limited after repeated failures', async () => {
  const c = new Client();
  await signup('startup', { email: 'victim@example.com' });
  let last;
  for (let i = 0; i < 9; i++) last = await c.post('/api/auth/login', { email: 'victim@example.com', password: 'nope' + i });
  assert.strictEqual(last.status, 429);
});

test('forged or tampered session cookies are rejected', async () => {
  const s = await signup('startup');
  const c = new Client();
  c.cookie = s.cookie.replace(/.$/, (ch) => (ch === 'a' ? 'b' : 'a'));
  assert.strictEqual((await c.get('/api/me')).status, 401);
  c.cookie = 'sm_session=' + Buffer.from(JSON.stringify({ uid: s.user.id, exp: Date.now() + 1e9 })).toString('base64url') + '.fake';
  assert.strictEqual((await c.get('/api/me')).status, 401);
});

test('cross-origin writes are blocked', async () => {
  const { handler } = require('../netlify/functions/api');
  const res = await handler({ httpMethod: 'POST', path: '/api/auth/logout', headers: { host: 'app.example.com', origin: 'https://evil.example' }, body: '{}' });
  assert.strictEqual(res.statusCode, 403);
});

test('role separation: startups cannot browse proposals, investors cannot browse investors', async () => {
  const s = await signup('startup');
  const i = await signup('investor');
  assert.strictEqual((await s.get('/api/proposals')).status, 403);
  assert.strictEqual((await i.get('/api/investors')).status, 403);
  assert.strictEqual((await i.post('/api/proposals', proposal())).status, 403);
});

test('profiles: validation and verified flag cannot be self-set', async () => {
  const s = await signup('startup');
  let r = await s.put('/api/profile', { companyName: '' });
  assert.strictEqual(r.status, 422);
  r = await s.put('/api/profile', { ...startupProfile(), verified: true, userId: 'someone-else' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.profile.verified, false);
  assert.strictEqual(r.body.profile.userId, s.user.id);
  assert.strictEqual(r.body.profile.website, 'https://tidalroasters.example');

  const i = await signup('investor');
  r = await i.put('/api/profile', investorProfile({ checkMin: 50000, checkMax: 1000 }));
  assert.strictEqual(r.status, 422);
  r = await i.put('/api/profile', investorProfile({ industries: ['Not real'] }));
  assert.strictEqual(r.status, 422);
});

test('proposal lifecycle, drafts stay private, javascript: links rejected', async () => {
  const s = await signup('startup');
  await s.put('/api/profile', startupProfile());
  const i = await signup('investor');
  await i.put('/api/profile', investorProfile());

  let r = await s.post('/api/proposals', proposal({ deckUrl: 'javascript:alert(1)' }));
  assert.strictEqual(r.status, 422);
  r = await s.post('/api/proposals', proposal({ status: 'draft', title: 'Secret draft' }));
  assert.strictEqual(r.status, 201);
  const draftId = r.body.proposal.id;

  assert.strictEqual((await i.get('/api/proposals/' + draftId)).status, 404);
  assert.ok(!(await i.get('/api/proposals')).body.proposals.some((p) => p.id === draftId));

  r = await s.put('/api/proposals/' + draftId, proposal({ title: 'Now public', status: 'open' }));
  assert.strictEqual(r.status, 200);
  const list = (await i.get('/api/proposals')).body.proposals;
  const found = list.find((p) => p.id === draftId);
  assert.ok(found && found.match.score > 50);
  assert.ok(!JSON.stringify(found).includes('@example.com'), 'no emails in browse results');

  const other = await signup('startup');
  assert.strictEqual((await other.get('/api/proposals/' + draftId)).status, 404);
  assert.strictEqual((await other.put('/api/proposals/' + draftId, proposal())).status, 404);
  assert.strictEqual((await other.del('/api/proposals/' + draftId)).status, 404);
});

test('browse filters and sorting', async () => {
  const i = await signup('investor');
  await i.put('/api/profile', investorProfile());
  const s = await signup('startup');
  await s.put('/api/profile', startupProfile({ companyName: 'FilterCo' }));
  await s.post('/api/proposals', proposal({ title: 'Cheap one', ask: 5000, industry: 'Education' }));
  await s.post('/api/proposals', proposal({ title: 'Pricey one', ask: 900000, industry: 'Education' }));
  let r = await i.get('/api/proposals?industry=Education&minAsk=100000');
  assert.ok(r.body.proposals.length >= 1 && r.body.proposals.every((p) => p.ask >= 100000 && p.industry === 'Education'));
  r = await i.get('/api/proposals?q=filterco&sort=ask-asc');
  const asks = r.body.proposals.map((p) => p.ask);
  assert.deepStrictEqual(asks, [...asks].sort((a, b) => a - b));
});

test('startup pitches investor: contact stays hidden until accepted; notes stay private', async () => {
  const s = await signup('startup');
  await s.put('/api/profile', startupProfile());
  const i = await signup('investor');
  await i.put('/api/profile', investorProfile());
  const pid = (await s.post('/api/proposals', proposal())).body.proposal.id;

  // directory shows match against my open proposal
  const dir = (await s.get('/api/investors')).body.investors.find((x) => x.id === i.user.id);
  assert.ok(dir.match.score > 60 && dir.match.proposalId === pid);

  let r = await s.post('/api/connections', { proposalId: pid, investorId: i.user.id, message: 'Hi Dana, would love your thoughts.' });
  assert.strictEqual(r.status, 201);
  const cid = r.body.connectionId;
  assert.strictEqual((await s.post('/api/connections', { proposalId: pid, investorId: i.user.id, message: 'again' })).status, 409);

  // pending: no contact info for anyone, no messaging yet
  let inv = (await i.get('/api/connections/' + cid)).body.connection;
  assert.strictEqual(inv.status, 'pending');
  assert.ok(inv.awaitingMe && !inv.contact);
  assert.strictEqual((await i.post(`/api/connections/${cid}/messages`, { message: 'hey' })).status, 409);
  // initiator cannot accept their own request
  assert.strictEqual((await s.post(`/api/connections/${cid}/respond`, { action: 'accept' })).status, 403);

  // investor-only data
  await i.put(`/api/connections/${cid}/stage`, { stage: 'meeting', notes: 'PRIVATE: valuation seems high' });
  assert.strictEqual((await s.put(`/api/connections/${cid}/stage`, { stage: 'passed' })).status, 403);

  r = await i.post(`/api/connections/${cid}/respond`, { action: 'accept' });
  assert.strictEqual(r.body.status, 'accepted');

  const forStartup = (await s.get('/api/connections/' + cid)).body.connection;
  assert.strictEqual(forStartup.contact.email, i.user.email);
  assert.ok(!JSON.stringify(forStartup).includes('PRIVATE'), 'investor notes never reach the startup');
  assert.strictEqual(forStartup.stage, undefined);
  const forInvestor = (await i.get('/api/connections/' + cid)).body.connection;
  assert.strictEqual(forInvestor.contact.email, s.user.email);
  assert.strictEqual(forInvestor.stage, 'meeting');
  assert.ok(forInvestor.notes.includes('PRIVATE'));

  // messaging + unread
  await s.post(`/api/connections/${cid}/messages`, { message: 'Thanks for accepting!' });
  assert.strictEqual((await i.get('/api/me')).body.unread, 1);
  await i.get('/api/connections/' + cid);
  assert.strictEqual((await i.get('/api/me')).body.unread, 0);

  // outsiders can't see it
  const stranger = await signup('investor');
  assert.strictEqual((await stranger.get('/api/connections/' + cid)).status, 404);
  assert.strictEqual((await stranger.post(`/api/connections/${cid}/messages`, { message: 'hi' })).status, 404);
});

test('investor expresses interest; startup declines; only decliner can reopen', async () => {
  const s = await signup('startup');
  await s.put('/api/profile', startupProfile());
  const i = await signup('investor');
  await i.put('/api/profile', investorProfile());
  const pid = (await s.post('/api/proposals', proposal())).body.proposal.id;

  let r = await i.post('/api/connections', { proposalId: pid, message: 'Interested in learning more.' });
  assert.strictEqual(r.status, 201);
  const cid = r.body.connectionId;
  assert.strictEqual((await s.get('/api/me')).body.pendingForMe, 1);
  await s.post(`/api/connections/${cid}/respond`, { action: 'decline' });

  // investor can't pester after a decline
  assert.strictEqual((await i.post('/api/connections', { proposalId: pid, message: 'please?' })).status, 409);
  // startup changes its mind -> reopens as startup-initiated pending
  r = await s.post('/api/connections', { proposalId: pid, investorId: i.user.id, message: 'Reconsidering, let us talk.' });
  assert.strictEqual(r.body.status, 'pending');
  r = await i.post(`/api/connections/${cid}/respond`, { action: 'accept' });
  assert.strictEqual(r.body.status, 'accepted');
});

test('mutual interest connects immediately; withdraw works', async () => {
  const s = await signup('startup');
  await s.put('/api/profile', startupProfile());
  const i = await signup('investor');
  await i.put('/api/profile', investorProfile());
  const pid = (await s.post('/api/proposals', proposal())).body.proposal.id;

  await s.post('/api/connections', { proposalId: pid, investorId: i.user.id, message: 'Hello there, investor.' });
  const r = await i.post('/api/connections', { proposalId: pid, message: 'Saw your pitch, I am in.' });
  assert.strictEqual(r.body.mutual, true);
  assert.strictEqual(r.body.status, 'accepted');

  const i2 = await signup('investor');
  await i2.put('/api/profile', investorProfile());
  const c2 = (await i2.post('/api/connections', { proposalId: pid, message: 'Interested here.' })).body.connectionId;
  assert.strictEqual((await i2.post(`/api/connections/${c2}/withdraw`)).body.status, 'withdrawn');
});

test('guards: must have profile, closed proposals and non-pitchable investors are off limits', async () => {
  const s = await signup('startup');
  assert.strictEqual((await s.post('/api/proposals', proposal())).status, 400, 'cannot open a proposal without a profile');
  await s.put('/api/profile', startupProfile());
  const pid = (await s.post('/api/proposals', proposal())).body.proposal.id;

  const i = await signup('investor');
  assert.strictEqual((await i.post('/api/connections', { proposalId: pid, message: 'hello there' })).status, 400);
  await i.put('/api/profile', investorProfile({ openToPitches: false }));
  const r = await s.post('/api/connections', { proposalId: pid, investorId: i.user.id, message: 'Pitching you.' });
  assert.strictEqual(r.status, 400);

  await s.put('/api/proposals/' + pid, proposal({ status: 'closed' }));
  assert.strictEqual((await i.post('/api/connections', { proposalId: pid, message: 'too late?' })).status, 404);

  // startups cannot pitch with someone else's proposal
  const s2 = await signup('startup');
  await s2.put('/api/profile', startupProfile());
  const open = (await s.put('/api/proposals/' + pid, proposal())).body.proposal.id;
  assert.strictEqual((await s2.post('/api/connections', { proposalId: open, investorId: i.user.id, message: 'stolen' })).status, 403);
});

test('watchlist', async () => {
  const s = await signup('startup');
  await s.put('/api/profile', startupProfile());
  const pid = (await s.post('/api/proposals', proposal())).body.proposal.id;
  const i = await signup('investor');
  await i.post(`/api/proposals/${pid}/save`);
  assert.strictEqual((await i.get('/api/proposals/saved')).body.proposals.length, 1);
  assert.strictEqual((await i.get('/api/proposals/' + pid)).body.saved, true);
  await i.del(`/api/proposals/${pid}/save`);
  assert.strictEqual((await i.get('/api/proposals/saved')).body.proposals.length, 0);
});

test('admin: gated, can verify, hide, disable', async () => {
  const s = await signup('startup');
  await s.put('/api/profile', startupProfile());
  const pid = (await s.post('/api/proposals', proposal())).body.proposal.id;
  const i = await signup('investor');
  await i.put('/api/profile', investorProfile());

  assert.strictEqual((await s.get('/api/admin/overview')).status, 403);
  const a = await signup('startup', { email: 'admin@example.com' });
  const ov = (await a.get('/api/admin/overview')).body;
  assert.ok(ov.users.length >= 3 && ov.proposals.some((p) => p.id === pid));

  assert.strictEqual((await a.post(`/api/admin/profiles/${s.user.id}/verified`, { verified: true })).body.verified, true);
  assert.strictEqual((await i.get('/api/proposals')).body.proposals.find((p) => p.id === pid).startup.verified, true);

  await a.post(`/api/admin/proposals/${pid}/hidden`, { hidden: true });
  assert.ok(!(await i.get('/api/proposals')).body.proposals.some((p) => p.id === pid));
  assert.strictEqual((await s.put('/api/proposals/' + pid, proposal())).status, 403, 'owner cannot re-open a moderated proposal');
  await a.post(`/api/admin/proposals/${pid}/hidden`, { hidden: false });

  await a.post(`/api/admin/users/${i.user.id}/disabled`, { disabled: true });
  assert.strictEqual((await i.get('/api/me')).status, 401, 'disabled user is logged out immediately');
  assert.strictEqual((await a.post(`/api/admin/users/${a.user.id}/disabled`, { disabled: true })).status, 400);
});

test('account deletion removes user data', async () => {
  const s = await signup('startup');
  await s.put('/api/profile', startupProfile());
  const pid = (await s.post('/api/proposals', proposal())).body.proposal.id;
  const i = await signup('investor');
  await i.put('/api/profile', investorProfile());
  await i.post('/api/connections', { proposalId: pid, message: 'Interested here.' });

  assert.strictEqual((await s.post('/api/me/delete', { password: 'wrong-password' })).status, 422);
  assert.strictEqual((await s.post('/api/me/delete', { password: 'password123' })).status, 200);
  assert.strictEqual((await i.get('/api/proposals/' + pid)).status, 404);
  assert.strictEqual((await i.get('/api/connections')).body.connections.length, 0);
  assert.strictEqual((await new Client().post('/api/auth/login', { email: s.user.email, password: 'password123' })).status, 401);
});

test('unknown routes 404, wrong method 405', async () => {
  const c = new Client();
  assert.strictEqual((await c.get('/api/nope')).status, 404);
  assert.strictEqual((await c.get('/api/auth/login')).status, 405);
  assert.strictEqual((await c.get('/api/config')).status, 200);
});
