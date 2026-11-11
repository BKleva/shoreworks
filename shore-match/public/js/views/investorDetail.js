import { get } from '../api.js';
import { state, stageLabel, instrumentLabel } from '../state.js';
import { h, range, tag, matchPill, verifiedBadge, statusBadge, money } from '../ui.js';
import { openConnectDialog } from './components.js';

export const title = 'Investor';

export default async function investorDetail({ params, navigate }) {
  const { investor: i, proposals } = await get('/investors/' + params.id);
  const available = proposals.filter((p) => p.status === 'open' && !p.connection);

  const pitch = !i.openToPitches ? h('p', { class: 'banner' }, 'This investor isn’t accepting pitches right now.')
    : !state.me.profile ? h('a', { class: 'btn', href: '#/profile' }, 'Set up your profile to pitch')
    : !available.length ? h('p', { class: 'banner' }, proposals.some((p) => p.status === 'open') ? 'You’ve already reached out with all your open proposals.' : 'Publish a proposal to pitch this investor. ',
        proposals.some((p) => p.status === 'open') ? null : h('a', { href: '#/proposals/new' }, 'New proposal'))
    : h('button', { class: 'btn accent', onclick: () => openConnectDialog({ role: 'startup', investor: i, proposals: available, onDone: (r) => navigate('/inbox/' + r.connectionId) }) }, 'Pitch this investor');

  return h('div', { class: 'wrap' }, h('p', {}, h('a', { href: '#/investors' }, '← All investors')),
    h('div', { class: 'layout2' },
      h('div', { class: 'card stack' },
        h('div', {}, h('div', { class: 'muted' }, i.firm || 'Independent investor', ' ', verifiedBadge(i.verified)), h('h1', {}, i.displayName)),
        h('div', { class: 'meta' }, tag(i.town)),
        h('section', {}, h('h3', {}, 'Investment thesis'), h('p', { class: 'prose' }, i.bio)),
        h('section', {}, h('h3', {}, 'Invests in'), h('div', { class: 'meta' }, (i.industries.length ? i.industries : ['Any industry']).map(tag))),
        h('section', {}, h('h3', {}, 'Stages'), h('div', { class: 'meta' }, (i.stages.length ? i.stages.map(stageLabel) : ['Any stage']).map(tag))),
        h('section', {}, h('h3', {}, 'Deal types'), h('div', { class: 'meta' }, (i.instruments.length ? i.instruments.map(instrumentLabel) : ['Flexible']).map(tag))),
        i.website ? h('p', {}, h('a', { href: i.website, target: '_blank', rel: 'noopener noreferrer' }, 'Website ↗')) : null),
      h('div', { class: 'stack' },
        h('div', { class: 'card stack' }, h('div', {}, h('div', { class: 'small muted' }, 'Typical check'), h('div', { class: 'bignum sm' }, range(i.checkMin, i.checkMax))), pitch),
        proposals.length ? h('div', { class: 'card' }, h('h3', {}, 'Fit with your proposals'),
          h('div', { class: 'list' }, proposals.map((p) => h('div', { class: 'row between' },
            h('a', { href: '#/proposals/' + p.id }, p.title), h('div', { class: 'row' }, p.connection ? h('a', { href: '#/inbox/' + p.connection.id }, statusBadge(p.connection.status)) : null, matchPill(p.match)))))) : null)));
}
