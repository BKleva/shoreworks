import { get } from './api.js';
import { state } from './state.js';
import { h, clear, spinner, errorPanel, toast } from './ui.js';

// [pattern, access, module]  access: public | user | startup | investor | admin
const ROUTES = [
  ['/', 'public', 'landing'],
  ['/login', 'public', 'auth'],
  ['/signup', 'public', 'auth'],
  ['/terms', 'public', 'legal'],
  ['/privacy', 'public', 'legal'],
  ['/dashboard', 'user', 'dashboard'],
  ['/profile', 'user', 'profile'],
  ['/inbox', 'user', 'inbox'],
  ['/inbox/:id', 'user', 'thread'],
  ['/proposals/new', 'startup', 'proposalForm'],
  ['/proposals/:id/edit', 'startup', 'proposalForm'],
  ['/proposals/:id', 'user', 'proposalDetail'],
  ['/investors', 'startup', 'investors'],
  ['/investors/:id', 'startup', 'investorDetail'],
  ['/browse', 'investor', 'browse'],
  ['/watchlist', 'investor', 'watchlist'],
  ['/admin', 'admin', 'admin']
];

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path: path.replace(/\/+$/, '') || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

function matchRoute(path) {
  const parts = path.split('/').filter(Boolean);
  for (const [pattern, access, mod] of ROUTES) {
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {};
    if (pp.every((seg, i) => (seg[0] === ':' ? ((params[seg.slice(1)] = decodeURIComponent(parts[i])), true) : seg === parts[i]))) {
      return { access, mod, params, pattern };
    }
  }
  return null;
}

export function navigate(to) {
  if (location.hash === '#' + to) render();
  else location.hash = to;
}

export async function refreshMe() {
  try {
    state.me = await get('/me');
  } catch (e) {
    state.me = null;
  }
  renderHeader();
}

function renderHeader() {
  const el = document.getElementById('header');
  const { path } = parseHash();
  const me = state.me;
  const role = me && me.user.role;
  const items = [];
  if (me) {
    items.push(['/dashboard', 'Dashboard']);
    if (role === 'startup') items.push(['/investors', 'Find investors']);
    if (role === 'investor') items.push(['/browse', 'Browse startups'], ['/watchlist', 'Watchlist']);
    items.push(['/inbox', 'Inbox', (me.unread || 0) + (me.pendingForMe || 0)]);
    items.push(['/profile', 'Profile']);
    if (me.user.isAdmin) items.push(['/admin', 'Admin']);
  }
  const nav = h('nav', { class: 'nav', id: 'nav', 'aria-label': 'Main' },
    items.map(([href, label, badge]) => h('a', { href: '#' + href, 'aria-current': path === href || path.startsWith(href + '/') ? 'page' : null },
      label, badge ? h('span', { class: 'dot', 'aria-label': badge + ' new' }, badge) : null)),
    me ? h('button', { onclick: logout }, 'Log out') : [h('a', { href: '#/login' }, 'Log in'), h('a', { class: 'cta', href: '#/signup' }, 'Join free')]);
  const menu = h('button', { class: 'menu-btn', 'aria-label': 'Menu', 'aria-expanded': 'false',
    onclick: (e) => { const open = nav.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(open)); } }, '☰');
  clear(el).append(h('div', { class: 'wrap bar' },
    h('a', { class: 'brand', href: me ? '#/dashboard' : '#/' },
      h('img', { src: '/favicon.svg', alt: '', width: 28, height: 28 }), 'Shore Match'), menu, nav));
}

async function logout() {
  const { post } = await import('./api.js');
  await post('/auth/logout');
  state.me = null;
  renderHeader();
  navigate('/');
  toast('You are logged out.');
}

let renderToken = 0;
async function render() {
  const token = ++renderToken;
  const app = document.getElementById('app');
  const { path, query } = parseHash();
  const route = matchRoute(path);

  if (!state.me && route && route.access !== 'public') {
    return navigate('/login?next=' + encodeURIComponent(path));
  }
  if (state.me && path === '/') return navigate('/dashboard');
  if (state.me && route && ['startup', 'investor'].includes(route.access) && state.me.user.role !== route.access) {
    return navigate('/dashboard');
  }
  if (state.me && route && route.access === 'admin' && !state.me.user.isAdmin) return navigate('/dashboard');

  document.getElementById('nav')?.classList.remove('open');
  app.classList.toggle('landing-main', path === '/' && !state.me);
  clear(app).append(spinner());
  window.scrollTo(0, 0);

  try {
    if (!route) {
      const { default: nf } = await import('./views/notFound.js');
      return clear(app).append(nf());
    }
    if (state.me) await refreshMe(); // keep inbox badge fresh
    else renderHeader();
    const mod = await import(`./views/${route.mod}.js`);
    const node = await mod.default({ params: route.params, query, path, navigate });
    if (token !== renderToken) return; // user navigated away while loading
    clear(app).append(node);
    document.title = (mod.title ? mod.title + ' — ' : '') + 'Shore Match';
  } catch (err) {
    if (token !== renderToken) return;
    if (err.status === 401) { state.me = null; renderHeader(); return navigate('/login'); }
    clear(app).append(h('div', { class: 'wrap' }, errorPanel(err)));
  }
}

async function boot() {
  document.getElementById('year').textContent = new Date().getFullYear();
  try {
    state.config = await get('/config');
  } catch (e) {
    clear(document.getElementById('app')).append(errorPanel(e));
    return;
  }
  await refreshMe();
  window.addEventListener('hashchange', render);
  render();
}

boot();
