import { get } from '../api.js';
import { h, empty, fill } from '../ui.js';
import { proposalCard } from './components.js';

export const title = 'Watchlist';

export default async function watchlist() {
  const { proposals } = await get('/proposals/saved');
  const grid = h('div', { class: 'cards' });
  const render = (list) => fill(grid, ...list.map((p) => proposalCard(p, { onSaveChange: () => {} })));
  render(proposals);
  return h('div', { class: 'wrap' }, h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Watchlist'), h('p', {}, 'Startups you’re keeping an eye on.'))),
    proposals.length ? grid : empty('Nothing saved yet', 'Tap ♡ on any proposal to save it here.', h('a', { class: 'btn', href: '#/browse' }, 'Browse startups')));
}
