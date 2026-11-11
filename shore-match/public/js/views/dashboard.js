import { get, post } from '../api.js';
import { state, stageLabel, pipelineLabel } from '../state.js';
import { h, money, moneyShort, statusBadge, empty, toast, timeAgo, matchPill, fill } from '../ui.js';
import { proposalCard, investorCard } from './components.js';

export const title = 'Dashboard';

export default async function dashboard(ctx) {
  return state.me.user.role === 'startup' ? startupDashboard(ctx) : investorDashboard(ctx);
}

const tile = (n, l) => h('div', { class: 'tile' }, h('div', { class: 'n' }, String(n)), h('div', { class: 'l' }, l));

function checklist(items) {
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  return h('div', { class: 'card mb-lg' }, h('h2', {}, `Get started (${done}/${items.length})`),
    h('ul', { class: 'checklist' }, items.map((i) => h('li', { class: i.done ? 'done' : '' },
      h('span', { class: 'tick' }, i.done ? '✓' : ''), h('span', { class: 't' }, i.done ? i.text : h('a', { href: i.href }, i.text))))));
}

function requestRow(c, reload) {
  const who = state.me.user.role === 'startup' ? (c.investor && c.investor.displayName) : (c.startup && c.startup.companyName);
  return h('div', { class: 'li' },
    h('a', { class: 'main plain', href: '#/inbox/' + c.id },
      h('b', {}, who || 'Member', ' — ', c.proposal ? c.proposal.title : ''), h('span', { class: 'prev' }, c.lastMessage ? c.lastMessage.body : '')),
    h('button', { class: 'btn sm', onclick: () => respond(c.id, 'accept', reload) }, 'Accept'),
    h('button', { class: 'btn sm secondary', onclick: () => respond(c.id, 'decline', reload) }, 'Decline'));
}

async function respond(id, action, reload) {
  try { await post(`/connections/${id}/respond`, { action }); toast(action === 'accept' ? 'Connected! Contact details are now visible.' : 'Declined.'); reload(); }
  catch (e) { toast(e.message, 'error'); }
}

async function startupDashboard({ navigate }) {
  const root = h('div', { class: 'wrap' });
  const load = async () => {
    const [{ proposals }, { connections }, inv] = await Promise.all([get('/proposals/mine'), get('/connections'), get('/investors')]);
    const incoming = connections.filter((c) => c.awaitingMe);
    const active = connections.filter((c) => c.status === 'accepted');
    const open = proposals.filter((p) => p.status === 'open');
    fill(root, 
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, `Hi ${state.me.user.name.split(' ')[0]} 👋`), h('p', {}, state.me.profile ? state.me.profile.companyName : '')),
        h('a', { class: 'btn accent', href: '#/proposals/new' }, '+ New proposal')),
      checklist([
        { text: 'Complete your company profile', done: !!state.me.profile, href: '#/profile' },
        { text: 'Create a funding proposal', done: proposals.length > 0, href: '#/proposals/new' },
        { text: 'Publish it to investors', done: open.length > 0 || proposals.some((p) => ['funded', 'closed'].includes(p.status)), href: proposals[0] ? `#/proposals/${proposals[0].id}` : '#/proposals/new' },
        { text: 'Pitch your first investor', done: connections.length > 0, href: '#/investors' }
      ]),
      h('div', { class: 'tiles' }, tile(open.length, 'Open proposals'), tile(incoming.length, 'Investors awaiting your reply'),
        tile(active.length, 'Active conversations'), tile(connections.filter((c) => c.status === 'pending' && !c.awaitingMe).length, 'Pitches awaiting a reply')),
      incoming.length ? h('section', { class: 'section' }, h('h2', {}, 'Investor interest'), h('div', { class: 'list' }, incoming.map((c) => requestRow(c, load)))) : null,
      h('section', { class: 'section' }, h('h2', {}, 'Your proposals'),
        proposals.length ? h('div', { class: 'list' }, proposals.map((p) => h('a', { class: 'li', href: '#/proposals/' + p.id },
          h('div', { class: 'main' }, h('b', {}, p.title), h('span', { class: 'prev' }, `${money(p.ask)} • ${p.industry} • updated ${timeAgo(p.updatedAt)}`)),
          p.counts.awaitingMe ? h('span', { class: 'badge warn' }, `${p.counts.awaitingMe} new interest`) : null,
          p.counts.accepted ? h('span', { class: 'badge good' }, `${p.counts.accepted} connected`) : null,
          statusBadge(p.status))))
          : empty('No proposals yet', 'Describe what you’re raising and who it’s for. It takes about five minutes.', h('a', { class: 'btn', href: '#/proposals/new' }, 'Create your first proposal'))),
      open.length ? h('section', { class: 'section' }, h('h2', {}, 'Investors who fit you best', h('a', { class: 'btn sm secondary', href: '#/investors' }, 'See all')),
        h('div', { class: 'cards' }, inv.investors.filter((i) => i.openToPitches).slice(0, 3).map(investorCard))) : null);
  };
  await load();
  return root;
}

async function investorDashboard() {
  const root = h('div', { class: 'wrap' });
  const load = async () => {
    const [{ connections }, browse, saved] = await Promise.all([get('/connections'), get('/proposals?sort=match'), get('/proposals/saved')]);
    const incoming = connections.filter((c) => c.awaitingMe);
    const live = connections.filter((c) => c.status === 'accepted');
    const fresh = browse.proposals.filter((p) => !p.connection).slice(0, 3);
    const stages = state.config.pipelineStages;
    const board = h('div', { class: 'board' }, stages.map((st) => {
      const items = live.filter((c) => c.stage === st.id);
      return h('div', { class: 'col' }, h('h3', {}, st.label, h('span', {}, String(items.length))),
        items.map((c) => h('a', { class: 'item', href: '#/inbox/' + c.id }, h('b', {}, c.startup ? c.startup.companyName : 'Startup'),
          h('span', {}, c.proposal ? `${c.proposal.title} · ${moneyShort(c.proposal.ask)}` : ''))));
    }));
    fill(root, 
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, `Hi ${state.me.user.name.split(' ')[0]} 👋`), h('p', {}, 'Your local deal flow at a glance.')),
        h('a', { class: 'btn accent', href: '#/browse' }, 'Browse startups')),
      checklist([
        { text: 'Complete your investor profile', done: !!state.me.profile, href: '#/profile' },
        { text: 'Browse open proposals', done: browse.total > 0 && (saved.proposals.length > 0 || connections.length > 0), href: '#/browse' },
        { text: 'Save a startup or express interest', done: saved.proposals.length > 0 || connections.length > 0, href: '#/browse' }
      ]),
      h('div', { class: 'tiles' }, tile(browse.total, 'Open proposals'), tile(incoming.length, 'Awaiting your reply'), tile(live.length, 'In your pipeline'), tile(saved.proposals.length, 'On your watchlist')),
      incoming.length ? h('section', { class: 'section' }, h('h2', {}, 'Founder pitches'), h('div', { class: 'list' }, incoming.map((c) => requestRow(c, load)))) : null,
      h('section', { class: 'section' }, h('h2', {}, 'Deal pipeline'),
        live.length ? board : empty('Your pipeline is empty', 'Connect with a founder and track the deal here.', h('a', { class: 'btn', href: '#/browse' }, 'Find startups'))),
      fresh.length ? h('section', { class: 'section' }, h('h2', {}, 'Top matches for you', h('a', { class: 'btn sm secondary', href: '#/browse' }, 'See all')),
        h('div', { class: 'cards' }, fresh.map((p) => proposalCard(p)))) : null);
  };
  await load();
  return root;
}
