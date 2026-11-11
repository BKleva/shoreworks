import { get, put, del, post } from '../api.js';
import { state, stageLabel, instrumentLabel, statusLabel } from '../state.js';
import { h, money, moneyShort, matchPill, verifiedBadge, tag, statusBadge, toast, confirmDialog, empty, timeAgo } from '../ui.js';
import { openConnectDialog } from './components.js';

export const title = 'Proposal';

export default async function proposalDetail({ params, navigate }) {
  const data = await get('/proposals/' + params.id);
  const p = data.proposal;
  const s = p.startup || {};
  const owner = data.owner;

  const section = (label, text) => (text ? h('section', {}, h('h3', {}, label), h('p', { class: 'prose' }, text)) : null);

  const main = h('div', { class: 'card stack' },
    h('div', {}, h('div', { class: 'row' }, statusBadge(p.status), p.hidden ? h('span', { class: 'badge bad' }, 'Hidden by moderator') : null, !owner ? matchPill(data.match) : null),
      h('h1', { class: 'mt-sm' }, p.title),
      h('div', { class: 'co muted' }, s.companyName, ' ', verifiedBadge(s.verified), s.tagline ? ' — ' + s.tagline : '')),
    h('div', { class: 'meta' }, tag(p.industry), tag(stageLabel(p.stage)), tag(instrumentLabel(p.instrument)), tag(p.town)),
    h('p', { class: 'prose' }, p.summary),
    section('The problem', p.problem), section('The solution', p.solution), section('Traction', p.traction), section('Use of funds', p.useOfFunds),
    p.deckUrl ? h('p', {}, h('a', { href: p.deckUrl, target: '_blank', rel: 'noopener noreferrer' }, 'View pitch deck ↗')) : null,
    !owner && data.startupAbout ? section(`About ${s.companyName}`, data.startupAbout) : null);

  const facts = h('div', { class: 'card stack' },
    h('div', {}, h('div', { class: 'small muted' }, 'Raising'), h('div', { class: 'bignum' }, money(p.ask))),
    h('dl', { class: 'facts' },
      h('dt', {}, 'Min. check'), h('dd', {}, p.minCheck ? money(p.minCheck) : 'Flexible'),
      h('dt', {}, 'Deal type'), h('dd', {}, instrumentLabel(p.instrument)),
      h('dt', {}, 'Stage'), h('dd', {}, stageLabel(p.stage)),
      h('dt', {}, 'Location'), h('dd', {}, p.town || s.town || '—'),
      !owner && data.startupFounded ? [h('dt', {}, 'Founded'), h('dd', {}, String(data.startupFounded))] : null,
      !owner && data.startupTeamSize ? [h('dt', {}, 'Team'), h('dd', {}, String(data.startupTeamSize))] : null,
      s.website ? [h('dt', {}, 'Website'), h('dd', {}, h('a', { href: s.website, target: '_blank', rel: 'noopener noreferrer' }, 'Visit ↗'))] : null),
    owner ? ownerActions(p, navigate) : investorActions(p, data, navigate));

  const wrapper = h('div', { class: 'wrap' },
    h('p', {}, h('a', { href: owner ? '#/dashboard' : '#/browse' }, owner ? '← Dashboard' : '← Browse startups')),
    h('div', { class: 'layout2' }, main, facts));
  if (owner) wrapper.append(await interestSection(p.id));
  return wrapper;
}

function investorActions(p, data, navigate) {
  const box = h('div', { class: 'stack' });
  if (data.connection) {
    box.append(h('div', { class: 'row' }, 'Conversation:', statusBadge(data.connection.status)),
      h('a', { class: 'btn', href: '#/inbox/' + data.connection.id }, 'Open conversation'));
  } else if (p.status === 'open') {
    box.append(h('button', { class: 'btn accent', onclick: () => {
      if (!state.me.profile) return navigate('/profile');
      openConnectDialog({ role: 'investor', proposal: p, onDone: (r) => navigate('/inbox/' + r.connectionId) });
    } }, 'Express interest'));
  } else {
    box.append(h('p', { class: 'muted' }, 'This proposal is no longer open.'));
  }
  const save = h('button', { class: 'btn secondary', 'aria-pressed': String(data.saved) }, data.saved ? '♥ Saved' : '♡ Save to watchlist');
  save.addEventListener('click', async () => {
    const on = save.getAttribute('aria-pressed') !== 'true';
    try {
      if (on) await post(`/proposals/${p.id}/save`); else await del(`/proposals/${p.id}/save`);
      save.setAttribute('aria-pressed', String(on));
      save.textContent = on ? '♥ Saved' : '♡ Save to watchlist';
    } catch (e) { toast(e.message, 'error'); }
  });
  box.append(save);
  if (data.match && data.match.reasons.length) {
    box.append(h('div', {}, h('h3', {}, 'Why it matches'), h('ul', { class: 'ticks' }, data.match.reasons.map((r) => h('li', {}, r)))));
  }
  return box;
}

function ownerActions(p, navigate) {
  const setStatus = (status) => async () => {
    try {
      await put('/proposals/' + p.id, { ...p, status });
      toast('Status updated.');
      navigate('/proposals/' + p.id);
    } catch (e) { toast(e.fields ? Object.values(e.fields)[0] : e.message, 'error'); }
  };
  return h('div', { class: 'stack' },
    h('a', { class: 'btn', href: `#/proposals/${p.id}/edit` }, 'Edit proposal'),
    p.status === 'draft' ? h('button', { class: 'btn accent', onclick: setStatus('open') }, 'Publish to investors') : null,
    p.status === 'open' ? [h('button', { class: 'btn secondary', onclick: setStatus('funded') }, 'Mark as funded'), h('button', { class: 'btn secondary', onclick: setStatus('draft') }, 'Unpublish (back to draft)'), h('button', { class: 'btn ghost', onclick: setStatus('closed') }, 'Close round')] : null,
    ['funded', 'closed'].includes(p.status) ? h('button', { class: 'btn secondary', onclick: setStatus('open') }, 'Reopen') : null,
    h('button', { class: 'btn danger sm', onclick: async () => {
      if (!(await confirmDialog('Delete this proposal?', 'Its conversations will be deleted too. This cannot be undone.', 'Delete', true))) return;
      await del('/proposals/' + p.id);
      toast('Proposal deleted.');
      navigate('/dashboard');
    } }, 'Delete'));
}

async function interestSection(proposalId) {
  const { connections } = await get('/connections');
  const rows = connections.filter((c) => c.proposal && c.proposal.id === proposalId);
  return h('section', { class: 'section' }, h('h2', {}, 'Investor activity'),
    rows.length ? h('div', { class: 'list' }, rows.map((c) => h('a', { class: 'li' + (c.unread || c.awaitingMe ? ' unread' : ''), href: '#/inbox/' + c.id },
      h('div', { class: 'main' }, h('b', {}, c.investor ? c.investor.displayName : 'Investor'), h('span', { class: 'prev' }, c.lastMessage ? c.lastMessage.body : '')),
      c.awaitingMe ? h('span', { class: 'badge warn' }, 'Needs your reply') : statusBadge(c.status), h('span', { class: 'small muted' }, timeAgo(c.updatedAt)))))
      : empty('No activity yet', 'Share this proposal with matching investors, or wait for investors to reach out.', h('a', { class: 'btn', href: '#/investors' }, 'Find investors')));
}
