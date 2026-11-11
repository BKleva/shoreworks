// Fills the LOCAL JSON database with fictional demo data so you can click around.
//   npm run seed        (then: npm start)
// Refuses to run on Netlify / production so demo accounts can never reach real data.

if (process.env.NETLIFY || process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed in production.');
  process.exit(1);
}

const bcrypt = require('bcryptjs');
const db = require('../netlify/functions/lib/db');
const { newId, nowIso, connId } = require('../netlify/functions/lib/shared');

const PASSWORD = 'demo1234';
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

const founders = [
  { email: 'maya@demo.test', name: 'Maya Torres', profile: { companyName: 'Tidal Roasters', tagline: 'Small-batch coffee roasted at the shore', town: 'Asbury Park', industry: 'Hospitality & Food', founded: 2022, teamSize: 6, website: 'https://example.com/tidal', about: 'We roast single-origin coffee in Asbury Park and sell through our cafe, 14 local restaurants and a growing subscription.' },
    verified: true,
    proposals: [
      { title: 'Second roastery & cafe in Belmar', summary: 'Opening a second roastery and cafe to double roasting capacity and add a wholesale kitchen for local restaurants.', industry: 'Hospitality & Food', stage: 'early-revenue', instrument: 'safe', ask: 150000, minCheck: 10000, town: 'Belmar', problem: 'Our current roaster runs at 95% capacity and we turn away wholesale accounts every month.', solution: 'A 2,400 sq ft site with a 35 kg roaster, cafe seating and a wholesale packing line.', traction: '$410K trailing-12-month revenue, 14 wholesale accounts, 900 subscribers, 38% gross margin.', useOfFunds: 'Build-out $90K, roaster $45K, working capital $15K.', status: 'open' },
      { title: 'Subscription app (draft)', summary: 'A mobile app so subscribers can pause, swap and gift coffees without emailing us.', industry: 'Software & Tech', stage: 'idea', instrument: 'open', ask: 40000, town: 'Asbury Park', status: 'draft' }
    ] },
  { email: 'jon@demo.test', name: 'Jon Reyes', profile: { companyName: 'Saltwater Surf Repair', tagline: 'Mobile board repair and rentals for the Jersey Shore', town: 'Point Pleasant', industry: 'Marine & Outdoor', founded: 2023, teamSize: 3, about: 'Two vans, three repair techs and a rental fleet of 60 boards across four beach towns.' },
    verified: true,
    proposals: [{ title: 'Add a third van and rental kiosk', summary: 'Expand mobile repair coverage to Long Beach Island and open a rental kiosk at the boardwalk for peak season.', industry: 'Marine & Outdoor', stage: 'growth', instrument: 'revenue-share', ask: 60000, minCheck: 5000, town: 'Point Pleasant', traction: '$180K revenue last season, 62% repeat customers, break-even on both vans within 5 months.', useOfFunds: 'Van and equipment $38K, kiosk permit and fit-out $14K, marketing $8K.', status: 'open' }] },
  { email: 'priya@demo.test', name: 'Priya Shah', profile: { companyName: 'BrightPath Tutoring', tagline: 'Neighborhood learning pods for K-8', town: 'Red Bank', industry: 'Education', founded: 2024, teamSize: 8, about: 'Small-group tutoring in partnership with local libraries and community centers.' },
    verified: false,
    proposals: [{ title: 'Launch 5 new learning pods', summary: 'Scale from 3 to 8 neighborhood pods across Monmouth County with a shared curriculum platform.', industry: 'Education', stage: 'early-revenue', instrument: 'equity', ask: 250000, minCheck: 25000, town: 'Red Bank', traction: '210 enrolled students, 94% retention, $22K monthly revenue.', status: 'open' }] },
  { email: 'sam@demo.test', name: 'Sam Okafor', profile: { companyName: 'Harborlight Solar', tagline: 'Rooftop solar for small marinas and boatyards', town: 'Toms River', industry: 'Clean Energy', founded: 2021, teamSize: 12, about: 'Design-build solar and battery systems for marine commercial properties.' },
    verified: true,
    proposals: [{ title: 'Working capital for 8 signed installs', summary: 'Eight marinas have signed contracts; we need bridge financing for equipment ahead of incentive payments.', industry: 'Clean Energy', stage: 'established', instrument: 'loan', ask: 400000, minCheck: 50000, town: 'Toms River', traction: '$1.9M revenue last year, 8 signed contracts worth $1.2M, 0 defaults.', status: 'open' }] }
];

const investors = [
  { email: 'dana@demo.test', name: 'Dana Whitfield', profile: { displayName: 'Dana Whitfield', firm: 'Boardwalk Angels', town: 'Belmar', bio: 'Former restaurateur. I back food, hospitality and local retail founders who already have paying customers and want to open their next location.', industries: ['Hospitality & Food', 'Retail & E-commerce'], stages: ['early-revenue', 'growth'], instruments: ['equity', 'safe', 'revenue-share'], checkMin: 10000, checkMax: 50000, openToPitches: true }, verified: true },
  { email: 'raj@demo.test', name: 'Raj Patel', profile: { displayName: 'Raj Patel', firm: 'Garden State Growth Partners', town: 'Freehold', bio: 'Operator-turned-investor focused on durable, cash-flowing businesses. Comfortable with debt and revenue-share structures.', industries: ['Clean Energy', 'Manufacturing', 'Professional Services', 'Education'], stages: ['growth', 'established'], instruments: ['loan', 'revenue-share', 'equity'], checkMin: 50000, checkMax: 300000, openToPitches: true }, verified: true },
  { email: 'ellie@demo.test', name: 'Ellie Brooks', profile: { displayName: 'Ellie Brooks', firm: '', town: 'Long Branch', bio: 'Lifelong surfer and former marine engineer. Early-stage checks for outdoor, marine and wellness ideas on the coast.', industries: ['Marine & Outdoor', 'Health & Wellness'], stages: ['pre-revenue', 'early-revenue', 'growth'], instruments: ['safe', 'convertible-note', 'revenue-share'], checkMin: 5000, checkMax: 25000, openToPitches: true }, verified: false }
];

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const base = { passwordHash: hash, createdAt: daysAgo(30), disabled: false, agreedAt: daysAgo(30) };
  const ids = {};

  async function user(u, role) {
    if (await db.get('emails', u.email)) { const idx = await db.get('emails', u.email); return idx.userId; }
    const id = newId();
    await db.set('users', id, { ...base, id, email: u.email, name: u.name, role, accreditedAck: role === 'investor' });
    await db.set('emails', u.email, { userId: id });
    const prof = { ...u.profile, userId: id, type: role, verified: !!u.verified, createdAt: daysAgo(29), updatedAt: daysAgo(29) };
    if (role === 'startup') { prof.about = prof.about || ''; prof.website = prof.website || ''; }
    else { prof.website = prof.website || ''; }
    await db.set('profiles', id, prof);
    return id;
  }

  for (const f of founders) {
    const id = await user(f, 'startup');
    ids[f.email] = id;
    for (const [n, p] of f.proposals.entries()) {
      const pid = newId();
      await db.set('proposals', pid, { problem: '', solution: '', traction: '', useOfFunds: '', deckUrl: '', minCheck: null, ...p, id: pid, ownerId: id, hidden: false, createdAt: daysAgo(20 - n * 3), updatedAt: daysAgo(18 - n * 3) });
      f.proposals[n].id = pid;
    }
  }
  for (const i of investors) ids[i.email] = await user(i, 'investor');

  // A few connections in different states so the inbox & pipeline have life.
  const mk = async (proposal, investorEmail, initiatedBy, status, stage, msgs) => {
    const investorId = ids[investorEmail];
    const startupId = proposal.ownerId || ids[founders.find((f) => f.proposals.includes(proposal)).email];
    const id = connId(proposal.id, investorId);
    const t = daysAgo(5);
    await db.set('connections', id, { id, proposalId: proposal.id, startupId, investorId, initiatedBy, status, stage, notes: stage === 'meeting' ? 'Liked the unit economics. Ask for the lease terms and wholesale contracts.' : '',
      messages: msgs.map(([from, body], k) => ({ id: newId(), from, body, at: daysAgo(5 - k * 0.5), ...(k === 0 ? { intro: true } : {}) })), createdAt: t, updatedAt: daysAgo(1), readAt: {} });
  };
  const [maya, jon, priya, sam] = founders;
  await mk(maya.proposals[0], 'dana@demo.test', 'startup', 'accepted', 'meeting', [
    ['startup', 'Hi Dana, we’re a Belmar-adjacent roaster looking to open a second site. Would love your take.'],
    ['investor', 'Hi Maya! I’ve been a customer for a year. Happy to talk. Can you send the lease terms?'],
    ['startup', 'Absolutely. How does Thursday at 10 work for a walk-through of the numbers?']]);
  await mk(jon.proposals[0], 'ellie@demo.test', 'investor', 'pending', 'new', [['investor', 'Love the mobile-repair model. I’d like to learn more about your van economics.']]);
  await mk(sam.proposals[0], 'raj@demo.test', 'investor', 'accepted', 'diligence', [
    ['investor', 'Raj here. The marina niche is interesting and the contracts de-risk the loan. Can we talk terms?'],
    ['startup', 'Yes. Sending contract summaries now.']]);
  await mk(priya.proposals[0], 'raj@demo.test', 'startup', 'pending', 'new', [['startup', 'Hi Raj, we think BrightPath fits your education focus. Would you take a look?']]);

  console.log('Seeded demo data. Log in with any of these (password: ' + PASSWORD + '):');
  console.log('  Founders:  ' + founders.map((f) => f.email).join(', '));
  console.log('  Investors: ' + investors.map((i) => i.email).join(', '));
}
main().catch((e) => { console.error(e); process.exit(1); });
