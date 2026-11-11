import { get } from '../api.js';
import { state } from '../state.js';
import { h, empty, statusBadge, timeAgo, fill } from '../ui.js';

export const title = 'Inbox';

const TABS = [
  ['action', 'Needs your reply', (c) => c.awaitingMe],
  ['active', 'Connected', (c) => c.status === 'accepted'],
  ['waiting', 'Waiting on them', (c) => c.status === 'pending' && !c.awaitingMe],
  ['closed', 'Closed', (c) => ['declined', 'withdrawn'].includes(c.status)]
];

export default async function inbox() {
  const { connections } = await get('/connections');
  const role = state.me.user.role;
  let tab = connections.some(TABS[0][2]) ? 'action' : connections.some(TABS[1][2]) ? 'active' : connections.some(TABS[2][2]) ? 'waiting' : 'active';
  const list = h('div', { class: 'list' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });

  const render = () => {
    fill(tabs, ...TABS.map(([id, label, fn]) => {
      const n = connections.filter(fn).length;
      const b = h('button', { class: 'tab', role: 'tab', 'aria-selected': String(tab === id) }, `${label} (${n})`);
      b.addEventListener('click', () => { tab = id; render(); });
      return b;
    }));
    const rows = connections.filter(TABS.find((t) => t[0] === tab)[2]);
    fill(list, ...(rows.length ? rows.map((c) => {
      const other = role === 'startup' ? (c.investor && c.investor.displayName) : (c.startup && c.startup.companyName);
      return h('a', { class: 'li' + (c.unread || c.awaitingMe ? ' unread' : ''), href: '#/inbox/' + c.id },
        h('div', { class: 'main' }, h('b', {}, other || 'Member'), h('span', { class: 'small muted' }, c.proposal ? c.proposal.title : 'Proposal removed'),
          h('div', { class: 'prev' }, c.lastMessage ? (c.lastMessage.from === role ? 'You: ' : '') + c.lastMessage.body : '')),
        c.unread ? h('span', { class: 'dot' }, String(c.unread)) : null,
        c.awaitingMe ? h('span', { class: 'badge warn' }, 'Reply needed') : statusBadge(c.status),
        h('span', { class: 'small muted' }, timeAgo(c.updatedAt)));
    }) : [empty('Nothing here', role === 'startup' ? 'Pitch an investor to start a conversation.' : 'Express interest in a proposal to start a conversation.',
      h('a', { class: 'btn', href: role === 'startup' ? '#/investors' : '#/browse' }, role === 'startup' ? 'Find investors' : 'Browse startups'))]));
  };
  render();
  return h('div', { class: 'wrap' }, h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Inbox'), h('p', {}, 'Introductions and conversations.'))), tabs, list);
}
