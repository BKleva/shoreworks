import { post, del } from '../api.js';
import { state, stageLabel, instrumentLabel } from '../state.js';
import { h, money, moneyShort, range, matchPill, verifiedBadge, tag, statusBadge, modal, buildForm, toast } from '../ui.js';

export function proposalCard(p, { onSaveChange } = {}) {
  const startup = p.startup || {};
  let save = null;
  if (p.saved !== undefined) {
    save = h('button', { class: 'save', 'aria-pressed': String(!!p.saved), 'aria-label': p.saved ? 'Remove from watchlist' : 'Save to watchlist', title: 'Watchlist' }, p.saved ? '♥' : '♡');
    save.addEventListener('click', async () => {
      const on = save.getAttribute('aria-pressed') !== 'true';
      try {
        if (on) await post(`/proposals/${p.id}/save`); else await del(`/proposals/${p.id}/save`);
        save.setAttribute('aria-pressed', String(on));
        save.textContent = on ? '♥' : '♡';
        p.saved = on;
        if (onSaveChange) onSaveChange(p, on);
      } catch (e) { toast(e.message, 'error'); }
    });
  }
  return h('article', { class: 'card pcard' },
    h('div', { class: 'top' },
      h('div', {}, h('div', { class: 'co' }, startup.companyName || 'Startup', ' ', verifiedBadge(startup.verified)), h('h3', {}, h('a', { href: `#/proposals/${p.id}` }, p.title))),
      save),
    h('div', { class: 'meta' }, tag(p.industry), tag(stageLabel(p.stage)), tag(instrumentLabel(p.instrument)), tag(p.town)),
    h('p', {}, p.summary.length > 180 ? p.summary.slice(0, 177) + '…' : p.summary),
    h('div', { class: 'foot' },
      h('div', {}, h('div', { class: 'ask' }, money(p.ask)), h('div', { class: 'small muted' }, p.minCheck ? `min ${moneyShort(p.minCheck)}` : 'raising')),
      h('div', { class: 'row' }, p.connection ? statusBadge(p.connection.status) : null, matchPill(p.match))));
}

export function investorCard(i) {
  return h('article', { class: 'card pcard' },
    h('div', { class: 'top' },
      h('div', {}, h('div', { class: 'co' }, i.firm || 'Independent investor', ' ', verifiedBadge(i.verified)),
        h('h3', {}, h('a', { href: `#/investors/${i.id}` }, i.displayName))),
      matchPill(i.match)),
    h('div', { class: 'meta' }, tag(i.town), ...(i.industries || []).slice(0, 3).map(tag), (i.industries || []).length > 3 ? tag(`+${i.industries.length - 3}`) : null),
    h('p', {}, i.bio),
    h('div', { class: 'foot' },
      h('div', {}, h('div', { class: 'ask' }, range(i.checkMin, i.checkMax)), h('div', { class: 'small muted' }, 'check size')),
      i.openToPitches ? (i.match ? h('span', { class: 'small muted' }, 'Best fit: ' + i.match.proposalTitle) : null) : h('span', { class: 'badge' }, 'Not taking pitches')));
}

// Intro message dialog. role 'startup' pitches `investor` with a chosen proposal; role 'investor' expresses interest in `proposal`.
export function openConnectDialog({ role, investor, proposals, proposal, onDone }) {
  modal(role === 'startup' ? `Pitch ${investor.displayName}` : `Express interest in ${proposal.title}`, (body, close) => {
    const fields = [];
    if (role === 'startup') {
      fields.push({ name: 'proposalId', label: 'Proposal to share', type: 'select', required: true,
        options: proposals.map((p) => ({ value: p.id, label: `${p.title} (${money(p.ask)})` })), full: true });
    }
    const first = role === 'startup' ? investor.displayName.split(' ')[0] : (proposal.startup && proposal.startup.companyName) || 'there';
    const template = role === 'startup'
      ? `Hi ${first},\n\nI’m building something I think fits what you invest in. I’d love to share more and hear your thoughts.\n\nThanks for your time!`
      : `Hi,\n\nYour proposal caught my eye and I’d like to learn more. Could we set up a call?\n\nThanks!`;
    fields.push({ name: 'message', label: 'Your message', type: 'textarea', required: true, maxlength: 2000, rows: 7,
      hint: 'Contact details are shared only if they accept.' });
    const initial = { message: template, proposalId: proposals && proposals.length === 1 ? proposals[0].id : '' };
    const form = buildForm(fields, initial, {
      submitLabel: 'Send',
      extra: h('button', { type: 'button', class: 'btn secondary', onclick: close }, 'Cancel'),
      onSubmit: async (v) => {
        const res = await post('/connections', {
          proposalId: role === 'startup' ? v.proposalId : proposal.id,
          investorId: role === 'startup' ? investor.id : undefined,
          message: v.message
        });
        close();
        toast(res.mutual ? 'It’s a match! You’re connected.' : 'Sent! You’ll be notified when they reply.');
        onDone(res);
      }
    });
    body.append(form);
  });
}
