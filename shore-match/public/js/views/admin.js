import { get, post } from '../api.js';
import { h, money, statusBadge, toast, confirmDialog, timeAgo, fill } from '../ui.js';

export const title = 'Admin';

const th = (t) => h('th', {}, t);
const table = (heads, rows) => h('div', { class: 'card table-wrap' },
  h('table', {}, h('thead', {}, h('tr', {}, heads.map(th))), h('tbody', {}, rows)));

export default async function admin() {
  const root = h('div', { class: 'wrap' });

  const load = async () => {
    const d = await get('/admin/overview');
    const run = (fn, msg) => async () => {
      try { await fn(); toast(msg); await load(); } catch (e) { toast(e.message, 'error'); }
    };

    const userRow = (u) => {
      const buttons = [];
      if (u.hasProfile) {
        buttons.push(h('button', { class: 'btn sm secondary',
          onclick: run(() => post(`/admin/profiles/${u.id}/verified`, { verified: !u.verified }), u.verified ? 'Unverified' : 'Verified') },
        u.verified ? 'Unverify' : 'Verify'));
      }
      if (!u.isAdmin) {
        buttons.push(h('button', { class: 'btn sm secondary',
          onclick: run(() => post(`/admin/users/${u.id}/disabled`, { disabled: !u.disabled }), u.disabled ? 'Enabled' : 'Disabled') },
        u.disabled ? 'Enable' : 'Disable'));
        buttons.push(h('button', { class: 'btn sm danger', onclick: async () => {
          const ok = await confirmDialog('Delete member?', `Permanently delete ${u.name} and all their data?`, 'Delete', true);
          if (ok) await run(() => post(`/admin/users/${u.id}/delete`), 'Deleted')();
        } }, 'Delete'));
      }
      return h('tr', {},
        h('td', {}, h('b', {}, u.name), u.disabled ? h('span', { class: 'badge bad ml' }, 'disabled') : null,
          h('div', { class: 'small muted' }, u.email)),
        h('td', {}, u.role, u.isAdmin ? h('span', { class: 'badge primary ml' }, 'admin') : null),
        h('td', {}, u.hasProfile ? [u.label, ' ', u.verified ? h('span', { class: 'verified' }, '✔') : null] : h('span', { class: 'muted' }, 'none')),
        h('td', {}, timeAgo(u.createdAt)),
        h('td', {}, h('div', { class: 'row end' }, buttons)));
    };

    const proposalRow = (p) => h('tr', {},
      h('td', {}, h('b', {}, p.title)),
      h('td', {}, p.startup ? p.startup.companyName : '—'),
      h('td', {}, money(p.ask)),
      h('td', {}, statusBadge(p.status), p.hidden ? h('span', { class: 'badge bad ml' }, 'hidden') : null),
      h('td', {}, h('div', { class: 'row end' },
        h('button', { class: 'btn sm secondary',
          onclick: run(() => post(`/admin/proposals/${p.id}/hidden`, { hidden: !p.hidden }), p.hidden ? 'Unhidden' : 'Hidden') },
        p.hidden ? 'Unhide' : 'Hide'))));

    const s = d.stats;
    const stats = [['Startups', s.startups], ['Investors', s.investors], ['Open proposals', s.openProposals],
      ['Connections', s.connections], ['Connected', s.accepted]];

    fill(root, 
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Admin'), h('p', {}, 'Verify members, moderate proposals and manage accounts.'))),
      h('div', { class: 'tiles' }, stats.map(([l, n]) => h('div', { class: 'tile' }, h('div', { class: 'n' }, String(n)), h('div', { class: 'l' }, l)))),
      h('section', { class: 'section' }, h('h2', {}, 'Members'), table(['Name', 'Type', 'Profile', 'Joined', ''], d.users.map(userRow))),
      h('section', { class: 'section' }, h('h2', {}, 'Proposals'), table(['Proposal', 'Company', 'Ask', 'Status', ''], d.proposals.map(proposalRow))));
  };

  await load();
  return root;
}
