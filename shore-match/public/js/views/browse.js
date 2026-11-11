import { get } from '../api.js';
import { state } from '../state.js';
import { h, empty, spinner, buildForm, fill } from '../ui.js';
import { proposalCard } from './components.js';

export const title = 'Browse startups';

export default function browse() {
  const c = state.config;
  const f = { q: '', industry: '', stage: '', town: '', sort: 'match' };
  const results = h('div', {});
  let timer; let seq = 0;

  async function load() {
    const my = ++seq;
    fill(results, spinner());
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    const data = await get('/proposals?' + qs).catch((e) => ({ error: e }));
    if (my !== seq) return;
    if (data.error) return fill(results, h('div', { class: 'form-error' }, data.error.message));
    fill(results, 
      h('p', { class: 'muted small' }, `${data.total} open ${data.total === 1 ? 'proposal' : 'proposals'}`),
      data.proposals.length ? h('div', { class: 'cards' }, data.proposals.map((p) => proposalCard(p)))
        : empty('No matches', 'Try clearing a filter. New proposals are added regularly.'));
  }

  const sel = (name, label, options, ph) => {
    const s = h('select', { id: 'f-' + name, 'aria-label': label }, h('option', { value: '' }, ph), options.map((o) => h('option', { value: o.value }, o.label)));
    s.addEventListener('change', () => { f[name] = s.value; load(); });
    return h('div', { class: 'field' }, h('label', { for: 'f-' + name }, label), s);
  };
  const q = h('input', { type: 'search', id: 'f-q', placeholder: 'Search companies, ideas…', 'aria-label': 'Search' });
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { f.q = q.value; load(); }, 250); });

  const sort = h('select', { id: 'f-sort' }, [['match', 'Best match'], ['newest', 'Newest'], ['ask-asc', 'Ask: low to high'], ['ask-desc', 'Ask: high to low']].map(([v, l]) => h('option', { value: v }, l)));
  sort.addEventListener('change', () => { f.sort = sort.value; load(); });

  const filters = h('div', { class: 'filters' },
    h('div', { class: 'field' }, h('label', { for: 'f-q' }, 'Search'), q),
    sel('industry', 'Industry', c.industries.map((i) => ({ value: i, label: i })), 'All industries'),
    sel('stage', 'Stage', c.stages.map((s) => ({ value: s.id, label: s.label })), 'All stages'),
    sel('town', 'Town', c.towns.filter((t) => t !== 'Other').map((t) => ({ value: t, label: t })), 'Anywhere'),
    h('div', { class: 'field' }, h('label', { for: 'f-sort' }, 'Sort by'), sort));

  const wrap = h('div', { class: 'wrap' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Browse local startups'),
      h('p', {}, state.me.profile ? 'Ranked by how well each proposal fits your thesis.' : 'Complete your profile to see match scores.')),
      state.me.profile ? null : h('a', { class: 'btn', href: '#/profile' }, 'Set up profile')),
    filters, results);
  load();
  return wrap;
}
