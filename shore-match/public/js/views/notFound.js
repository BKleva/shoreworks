import { h } from '../ui.js';
export default () => h('div', { class: 'wrap' }, h('div', { class: 'card' }, h('h1', {}, 'Page not found'),
  h('p', { class: 'muted' }, "We couldn't find that page."), h('a', { class: 'btn', href: '#/' }, 'Go home')));
