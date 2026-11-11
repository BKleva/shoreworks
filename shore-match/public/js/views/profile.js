import { put, post } from '../api.js';
import { state } from '../state.js';
import { h, buildForm, toast, confirmDialog, modal } from '../ui.js';
import { refreshMe } from '../main.js';

export const title = 'Profile';

export default function profile({ query, navigate }) {
  const me = state.me;
  const c = state.config;
  const isInv = me.user.role === 'investor';
  const townList = h('datalist', { id: 'towns' }, c.towns.map((t) => h('option', { value: t })));

  const fields = isInv ? [
    { name: 'displayName', label: 'Display name', type: 'text', required: true, maxlength: 120 },
    { name: 'firm', label: 'Firm / fund (optional)', type: 'text', maxlength: 120 },
    { name: 'town', label: 'Town', type: 'text', required: true, list: 'towns' },
    { name: 'website', label: 'Website / LinkedIn', type: 'url' },
    { name: 'bio', label: 'Investment thesis', type: 'textarea', required: true, rows: 6, maxlength: 3000, hint: 'What do you look for in a founder or business? Founders will read this.' },
    { name: 'industries', label: 'Industries you invest in', type: 'multi', options: c.industries, hint: 'Leave empty to be open to anything.' },
    { name: 'stages', label: 'Stages', type: 'multi', options: c.stages.map((s) => ({ value: s.id, label: s.label })) },
    { name: 'instruments', label: 'Deal types', type: 'multi', options: c.instruments.map((s) => ({ value: s.id, label: s.label })) },
    { name: 'checkMin', label: 'Minimum check ($)', type: 'text', inputmode: 'numeric', placeholder: '5000' },
    { name: 'checkMax', label: 'Maximum check ($)', type: 'text', inputmode: 'numeric', placeholder: '50000' },
    { name: 'openToPitches', label: 'I’m open to receiving pitches from founders', type: 'checkbox' }
  ] : [
    { name: 'companyName', label: 'Company name', type: 'text', required: true, maxlength: 120 },
    { name: 'tagline', label: 'One-line description', type: 'text', required: true, maxlength: 140, placeholder: 'e.g. Small-batch coffee roasted at the shore' },
    { name: 'town', label: 'Town', type: 'text', required: true, list: 'towns' },
    { name: 'industry', label: 'Industry', type: 'select', required: true, options: c.industries },
    { name: 'website', label: 'Website', type: 'url' },
    { name: 'founded', label: 'Year founded', type: 'text', inputmode: 'numeric', placeholder: '2024' },
    { name: 'teamSize', label: 'Team size', type: 'text', inputmode: 'numeric' },
    { name: 'about', label: 'About the company', type: 'textarea', rows: 6, maxlength: 3000, hint: 'Your story, product and customers.' }
  ];

  const initial = me.profile ? { ...me.profile } : (isInv ? { openToPitches: true, displayName: me.user.name } : {});
  const form = buildForm(fields, initial, {
    submitLabel: me.profile ? 'Save profile' : 'Create profile',
    onSubmit: async (v) => {
      await put('/profile', v);
      await refreshMe();
      toast('Profile saved.');
      navigate(isInv ? '/browse' : '/dashboard');
    }
  });

  return h('div', { class: 'wrap narrow' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, me.profile ? 'Your profile' : 'Set up your profile'),
      h('p', {}, query.welcome ? 'Just a minute and you’ll be ready to connect.' : isInv ? 'This is what founders see when they browse investors.' : 'This is what investors see next to your proposals.'))),
    h('div', { class: 'card' }, townList, form),
    accountCard(me, navigate));
}

function accountCard(me, navigate) {
  const pw = buildForm([
    { name: 'current', label: 'Current password', type: 'password', autocomplete: 'current-password' },
    { name: 'next', label: 'New password', type: 'password', autocomplete: 'new-password', hint: 'At least 8 characters.' }
  ], {}, { submitLabel: 'Change password', onSubmit: async (v) => { await post('/me/password', v); pw.reset?.(); toast('Password updated.'); } });

  const del = h('button', { class: 'btn danger sm', onclick: () => {
    modal('Delete your account?', (body, close) => {
      body.append(h('p', {}, 'This permanently deletes your profile, proposals, conversations and account. This cannot be undone.'));
      const f = buildForm([{ name: 'password', label: 'Confirm with your password', type: 'password', required: true }], {}, {
        submitLabel: 'Delete everything',
        extra: h('button', { type: 'button', class: 'btn secondary', onclick: close }, 'Cancel'),
        onSubmit: async (v) => {
          await post('/me/delete', v);
          close();
          state.me = null;
          toast('Your account was deleted.');
          location.hash = '#/';
          location.reload();
        }
      });
      body.append(f);
    });
  } }, 'Delete my account');

  return h('div', { class: 'card stack mt-lg' },
    h('h2', {}, 'Account'), h('p', { class: 'muted' }, 'Signed in as ', h('b', {}, me.user.email)),
    h('div', {}, h('h3', {}, 'Change password'), pw),
    h('div', {}, h('h3', {}, 'Danger zone'), del));
}
