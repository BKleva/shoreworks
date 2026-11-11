import { get } from '../api.js';
import { state } from '../state.js';
import { h, empty, spinner, fill } from '../ui.js';
import { investorCard } from './components.js';

export const title = 'Find investors';

export default function investors() {
  const c = state.config;
  const f = { q: '', industry: '', stage: '', town: '' };
  const results = h('div', {});
  let timer; let seq = 0;

  async function load() {
    const my = ++seq;
    fill(results, spinner());
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    const data = await get('/investors?' + qs).catch((e) => ({ error: e }));
    if (my !== seq) return;
    if (data.error) return fill(results, h('div', { class: 'form-error' }, data.error.message));
    fill(results, 
      !data.hasOpenProposal ? h('div', { class: 'banner mb' }, 'Publish a proposal to see how well each investor fits it. ',
        h('a', { href: '#/proposals/new' }, 'Create a proposal')) : null,
      h('p', { class: 'muted small' }, `${data.investors.length} ${data.investors.length === 1 ? 'investor' : 'investors'}`),
      data.investors.length ? h('div', { class: 'cards' }, data.investors.map(investorCard)) : empty('No investors found', 'Try clearing a filter.'));
  }
  const sel = (name, label, options, ph) => {
    const s = h('select', { id: 'i-' + name }, h('option', { value: '' }, ph), options.map((o) => h('option', { value: o.value }, o.label)));
    s.addEventListener('change', () => { f[name] = s.value; load(); });
    return h('div', { class: 'field' }, h('label', { for: 'i-' + name }, label), s);
  };
  const q = h('input', { type: 'search', id: 'i-q', placeholder: 'Search by name, firm, thesis…' });
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { f.q = q.value; load(); }, 250); });
  const filters = h('div', { class: 'filters four' },
    h('div', { class: 'field' }, h('label', { for: 'i-q' }, 'Search'), q),
    sel('industry', 'Industry focus', c.industries.map((i) => ({ value: i, label: i })), 'All industries'),
    sel('stage', 'Stage', c.stages.map((s) => ({ value: s.id, label: s.label })), 'All stages'),
    sel('town', 'Town', c.towns.filter((t) => t !== 'Other').map((t) => ({ value: t, label: t })), 'Anywhere'));
  const wrap = h('div', { class: 'wrap' }, h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Find local investors'),
    h('p', {}, 'Ranked by fit with your open proposals.'))), filters, results);
  load();
  return wrap;
}
