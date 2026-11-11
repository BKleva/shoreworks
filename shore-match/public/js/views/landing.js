import { h } from '../ui.js';
import { state } from '../state.js';

export const title = 'Local startups meet local investors';

export default function landing() {
  const region = state.config.regionName;
  return h('div', {},
    h('section', { class: 'hero' }, h('div', { class: 'wrap' },
      h('h1', {}, 'Where ', h('span', { class: 'hl' }, region), ' startups meet local capital.'),
      h('p', {}, 'Founders share funding proposals. Investors discover businesses in their own backyard. Every match is explained, and nobody’s contact details are shared until both sides agree.'),
      h('div', { class: 'row' },
        h('a', { class: 'btn accent lg', href: '#/signup?role=startup' }, 'I’m a founder'),
        h('a', { class: 'btn secondary lg', href: '#/signup?role=investor' }, 'I’m an investor')))),

    h('div', { class: 'wrap' },
      h('section', { class: 'section' }, h('h2', {}, 'How it works'),
        h('div', { class: 'steps' },
          h('div', { class: 'card step' }, h('h3', {}, 'Create your profile'), h('p', { class: 'muted' }, 'Founders describe the company. Investors share their thesis: industries, stages, check size and the towns they care about.')),
          h('div', { class: 'card step' }, h('h3', {}, 'Get matched'), h('p', { class: 'muted' }, 'Founders publish a funding proposal. We score every proposal against every investor and show exactly why they fit.')),
          h('div', { class: 'card step' }, h('h3', {}, 'Connect on your terms'), h('p', { class: 'muted' }, 'Either side can reach out. When the other agrees, you unlock messaging and contact details, then track the deal to a close.')))),

      h('section', { class: 'section split' },
        h('div', { class: 'card' }, h('h2', {}, 'For founders'),
          h('ul', { class: 'ticks' },
            h('li', {}, 'Publish proposals with your ask, deal type and traction'),
            h('li', {}, 'Browse investors ranked by fit with your proposal'),
            h('li', {}, 'Pitch directly, or accept inbound interest'),
            h('li', {}, 'Drafts stay private until you open them')),
          h('a', { class: 'btn', href: '#/signup?role=startup' }, 'Start a proposal')),
        h('div', { class: 'card' }, h('h2', {}, 'For investors'),
          h('ul', { class: 'ticks' },
            h('li', {}, 'Filter local proposals by industry, stage, town and check size'),
            h('li', {}, 'See a transparent match score for every opportunity'),
            h('li', {}, 'Save a watchlist and run a private deal pipeline'),
            h('li', {}, 'Keep private notes the founder never sees')),
          h('a', { class: 'btn', href: '#/signup?role=investor' }, 'Find local deals'))),

      h('section', { class: 'section card flat' }, h('h3', {}, 'Private by design'),
        h('p', { class: 'muted' }, 'Proposals are visible only to signed-in investors who have confirmed they understand the risks of private investing. Emails and phone numbers stay hidden until both sides accept a connection. Shore Match is a networking tool: it does not broker deals, hold funds, or offer securities.'))));
}
