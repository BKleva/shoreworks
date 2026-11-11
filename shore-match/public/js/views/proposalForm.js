import { get, post, put } from '../api.js';
import { state } from '../state.js';
import { h, buildForm, toast, spinner, confirmDialog } from '../ui.js';

export const title = 'Proposal';

export default async function proposalForm({ params, navigate }) {
  const c = state.config;
  const editing = !!params.id;
  if (!state.me.profile) {
    return h('div', { class: 'wrap' }, h('div', { class: 'card' }, h('h2', {}, 'Create your company profile first'),
      h('p', { class: 'muted' }, 'Investors see your profile alongside every proposal.'), h('a', { class: 'btn', href: '#/profile' }, 'Set up profile')));
  }
  let initial = { status: 'open', instrument: 'open', town: state.me.profile.town, industry: state.me.profile.industry };
  if (editing) initial = (await get('/proposals/' + params.id)).proposal;

  const form = buildForm([
    { name: 'title', label: 'Proposal title', type: 'text', required: true, maxlength: 120, placeholder: 'e.g. Second roastery location', full: true },
    { name: 'summary', label: 'Elevator pitch', type: 'textarea', required: true, rows: 3, maxlength: 600, hint: '20–600 characters. This is the first thing investors read.' },
    { name: 'industry', label: 'Industry', type: 'select', required: true, options: c.industries },
    { name: 'stage', label: 'Stage', type: 'select', required: true, options: c.stages.map((s) => ({ value: s.id, label: s.label })) },
    { name: 'ask', label: 'Amount you’re raising ($)', type: 'text', required: true, inputmode: 'numeric', placeholder: '100000' },
    { name: 'minCheck', label: 'Minimum check ($)', type: 'text', inputmode: 'numeric', placeholder: '10000', hint: 'Smallest investment you’ll accept. Optional.' },
    { name: 'instrument', label: 'Deal type', type: 'select', required: true, options: c.instruments.map((s) => ({ value: s.id, label: s.label })) },
    { name: 'town', label: 'Town', type: 'text', list: 'towns' },
    { name: 'problem', label: 'The problem', type: 'textarea', rows: 4, maxlength: 3000 },
    { name: 'solution', label: 'Your solution', type: 'textarea', rows: 4, maxlength: 3000 },
    { name: 'traction', label: 'Traction so far', type: 'textarea', rows: 4, maxlength: 3000, hint: 'Revenue, customers, pre-orders, pilots, milestones.' },
    { name: 'useOfFunds', label: 'Use of funds', type: 'textarea', rows: 3, maxlength: 2000 },
    { name: 'deckUrl', label: 'Pitch deck link', type: 'url', hint: 'Google Drive, Dropbox or website link. Optional.' },
    { name: 'status', label: 'Visibility', type: 'select', required: true, options: c.proposalStatuses.map((s) => ({ value: s.id, label: s.label })),
      hint: 'Draft keeps it private. Open makes it visible to signed-in investors.' }
  ], initial, {
    submitLabel: editing ? 'Save changes' : 'Create proposal',
    extra: h('a', { class: 'btn secondary', href: editing ? `#/proposals/${params.id}` : '#/dashboard' }, 'Cancel'),
    onSubmit: async (v) => {
      const res = editing ? await put('/proposals/' + params.id, v) : await post('/proposals', v);
      toast(v.status === 'open' ? 'Proposal is live for investors.' : 'Proposal saved.');
      navigate('/proposals/' + res.proposal.id);
    }
  });
  const towns = h('datalist', { id: 'towns' }, c.towns.map((t) => h('option', { value: t })));
  return h('div', { class: 'wrap narrow' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, editing ? 'Edit proposal' : 'New funding proposal'),
      h('p', {}, 'The clearer your ask, the better the matches.'))),
    h('div', { class: 'card' }, towns, form));
}
