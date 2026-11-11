import { get, post, put } from '../api.js';
import { state, pipelineLabel } from '../state.js';
import { h, money, statusBadge, clock, toast, buildForm, matchPill, fill } from '../ui.js';

export const title = 'Conversation';

export default async function thread({ params, navigate }) {
  const role = state.me.user.role;
  const root = h('div', { class: 'wrap' });

  const load = async () => {
    const { connection: c } = await get('/connections/' + params.id);
    const other = role === 'startup' ? c.investor : c.startup;
    const otherName = role === 'startup' ? (other && other.displayName) : (other && other.companyName);
    const p = c.proposal;

    const status = h('div', {});
    if (c.status === 'pending' && c.awaitingMe) {
      status.append(h('div', { class: 'banner stack' }, h('b', {}, `${otherName} wants to connect.`),
        h('div', {}, 'Accepting shares your email with them and opens messaging.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => act('accept') }, 'Accept'),
          h('button', { class: 'btn secondary', onclick: () => act('decline') }, 'Decline'))));
    } else if (c.status === 'pending') {
      status.append(h('div', { class: 'banner row between' }, h('span', {}, `Waiting for ${otherName} to respond.`),
        h('button', { class: 'btn secondary sm', onclick: () => act('withdraw') }, 'Withdraw')));
    } else if (c.status === 'declined') {
      status.append(h('div', { class: 'banner' }, c.declinedBy === role ? 'You declined this request.' : 'This request was declined.'));
    } else if (c.status === 'withdrawn') {
      status.append(h('div', { class: 'banner' }, 'This request was withdrawn.'));
    } else if (c.contact) {
      status.append(h('div', { class: 'banner good' }, h('b', {}, 'You’re connected. '), `${c.contact.name} · `, h('a', { href: 'mailto:' + c.contact.email }, c.contact.email),
        c.contact.website ? [' · ', h('a', { href: c.contact.website, target: '_blank', rel: 'noopener noreferrer' }, 'website ↗')] : null));
    }

    const msgs = h('div', { class: 'thread', 'aria-label': 'Messages' }, c.messages.map((m) =>
      h('div', { class: 'msg' + (m.from === role ? ' me' : '') }, m.body, h('time', {}, clock(m.at), m.intro ? ' · introduction' : ''))));

    const composer = c.status === 'accepted' ? buildForm([{ name: 'message', label: 'Message', type: 'textarea', rows: 3, maxlength: 2000, required: true }], {}, {
      submitLabel: 'Send', onSubmit: async (v) => { await post(`/connections/${c.id}/messages`, v); await load(); }
    }) : null;

    const main = h('div', { class: 'card' }, status, msgs, composer);
    const side = h('div', { class: 'stack' },
      h('div', { class: 'card stack' }, h('h3', {}, 'About the opportunity'),
        p ? [h('a', { href: '#/proposals/' + p.id }, h('b', {}, p.title)), h('div', { class: 'muted small' }, `${p.startup ? p.startup.companyName : ''} · ${money(p.ask)}`)] : h('div', { class: 'muted' }, 'This proposal was removed.'),
        role === 'investor' && c.match ? matchPill(c.match) : null,
        role === 'startup' && other ? h('a', { href: '#/investors/' + other.id }, 'View investor profile') : null),
      role === 'investor' && c.status === 'accepted' ? pipelinePanel(c) : null);

    fill(root, 
      h('p', {}, h('a', { href: '#/inbox' }, '← Inbox')),
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, otherName || 'Conversation'), h('p', {}, p ? p.title : '')), statusBadge(c.status)),
      h('div', { class: 'layout2' }, main, side));
    const last = msgs.lastElementChild; if (last) last.scrollIntoView({ block: 'nearest' });
  };

  async function act(action) {
    try {
      await post(`/connections/${params.id}/${action === 'withdraw' ? 'withdraw' : 'respond'}`, action === 'withdraw' ? {} : { action });
      toast(action === 'accept' ? 'Connected!' : action === 'decline' ? 'Declined.' : 'Withdrawn.');
      await load();
    } catch (e) { toast(e.message, 'error'); }
  }

  function pipelinePanel(c) {
    const f = buildForm([
      { name: 'stage', label: 'Deal stage', type: 'select', required: true, options: state.config.pipelineStages.map((s) => ({ value: s.id, label: s.label })) },
      { name: 'notes', label: 'Private notes', type: 'textarea', rows: 5, maxlength: 4000, hint: 'Only you can see these.' }
    ], { stage: c.stage, notes: c.notes }, { submitLabel: 'Save', onSubmit: async (v) => { await put(`/connections/${c.id}/stage`, v); toast('Saved.'); } });
    return h('div', { class: 'card stack' }, h('h3', {}, 'Your pipeline'), f);
  }

  await load();
  return root;
}
