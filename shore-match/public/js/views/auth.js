import { post } from '../api.js';
import { state } from '../state.js';
import { h, buildForm, toast } from '../ui.js';
import { refreshMe } from '../main.js';

export const title = 'Account';

export default function auth({ path, query, navigate }) {
  const isSignup = path === '/signup';
  if (!isSignup) return loginView(query, navigate);
  return signupView(query, navigate);
}

function loginView(query, navigate) {
  const form = buildForm([
    { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'username' },
    { name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'current-password' }
  ], {}, {
    submitLabel: 'Log in',
    onSubmit: async (v) => {
      await post('/auth/login', v);
      await refreshMe();
      navigate(query.next && query.next.startsWith('/') ? query.next : '/dashboard');
    }
  });
  return h('div', { class: 'wrap' }, h('div', { class: 'auth card' },
    h('h1', {}, 'Welcome back'), form,
    h('p', { class: 'muted small' }, 'New here? ', h('a', { href: '#/signup' }, 'Create an account'))));
}

function signupView(query, navigate) {
  let role = query.role === 'investor' ? 'investor' : 'startup';
  const ackWrap = h('div', {});
  const form = buildForm([
    { name: 'name', label: 'Your name', type: 'text', required: true, autocomplete: 'name', maxlength: 80 },
    { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
    { name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'new-password', hint: 'At least 8 characters.' },
    { name: 'agree', label: 'I agree to the Terms and Privacy Policy and understand Shore Match does not offer securities or investment advice.', type: 'checkbox' },
    { name: 'accreditedAck', label: 'Investors only: I confirm I am an accredited investor (or investing on behalf of one) and that I understand early-stage investments are high risk and I may lose everything. I will do my own due diligence.', type: 'checkbox' }
  ], {}, {
    submitLabel: 'Create account',
    onSubmit: async (v) => {
      await post('/auth/signup', { ...v, role });
      await refreshMe();
      toast('Welcome! Let’s set up your profile.');
      navigate('/profile?welcome=1');
    }
  });
  // Show the investor acknowledgement only for investors.
  const ackField = form.querySelector('[name="accreditedAck"]').closest('.field');
  const sync = () => { ackField.hidden = role !== 'investor'; };

  const pick = h('div', { class: 'role-pick', role: 'radiogroup', 'aria-label': 'Account type' },
    ...[['startup', 'I’m a founder', 'Raise from local investors'], ['investor', 'I’m an investor', 'Discover local startups']].map(([val, t, d]) => {
      const input = h('input', { type: 'radio', name: 'role', value: val });
      input.checked = role === val;
      input.addEventListener('change', () => { role = val; sync(); });
      return h('label', {}, input, h('b', {}, t), h('span', {}, d));
    }));
  sync();
  return h('div', { class: 'wrap' }, h('div', { class: 'auth card stack' },
    h('h1', {}, 'Join Shore Match'), pick, form,
    h('p', { class: 'muted small' }, 'Already have an account? ', h('a', { href: '#/login' }, 'Log in'))));
}
