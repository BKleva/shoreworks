// Small DOM + UI toolkit. All user content is inserted as text nodes (never innerHTML),
// which is what keeps the app free of XSS even though it renders user-written text.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// Like el.replaceChildren but skips null/false and flattens arrays (replaceChildren would print "null").
export function fill(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const link = (href, text, cls) => h('a', { href, class: cls }, text);

// ---------- formatting ----------
export const money = (n) => (n == null || n === '' ? '—' : '$' + Number(n).toLocaleString('en-US'));
export function moneyShort(n) {
  if (n == null) return '—';
  if (n >= 1e6) return '$' + +(n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1e3) return '$' + +(n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return '$' + n;
}
export function range(min, max) {
  if (!min && !max) return 'Flexible';
  if (min && max) return `${moneyShort(min)} – ${moneyShort(max)}`;
  return min ? `${moneyShort(min)}+` : `Up to ${moneyShort(max)}`;
}
export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export const clock = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// ---------- feedback ----------
export function toast(message, kind) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: 'toast' + (kind === 'error' ? ' error' : '') }, message);
  box.append(t);
  setTimeout(() => t.remove(), kind === 'error' ? 6000 : 3500);
}

export const spinner = () => h('div', { class: 'spinner', role: 'progressbar', 'aria-label': 'Loading' });

export function empty(title, body, action) {
  return h('div', { class: 'empty' }, h('h3', {}, title), body ? h('p', {}, body) : null, action || null);
}

export function errorPanel(err) {
  return h('div', { class: 'card' }, h('h2', {}, 'Something went wrong'), h('p', { class: 'muted' }, err.message || 'Please try again.'),
    h('a', { class: 'btn secondary', href: '#/' }, 'Back to home'));
}

// ---------- small components ----------
export function matchPill(m) {
  if (!m) return null;
  const cls = m.score >= 75 ? 'high' : m.score >= 50 ? 'mid' : '';
  return h('span', { class: 'match ' + cls, title: (m.reasons || []).join(' • ') || 'Based on industry, stage, check size, location and deal type' }, `${m.score}% match`);
}
export const verifiedBadge = (v) => (v ? h('span', { class: 'verified', title: 'Verified by Shore Match' }, '✔ Verified') : null);
export const tag = (t) => (t ? h('span', { class: 'tag' }, t) : null);

const STATUS_BADGE = {
  pending: ['warn', 'Pending'], accepted: ['good', 'Connected'], declined: ['bad', 'Declined'], withdrawn: ['', 'Withdrawn'],
  open: ['good', 'Open'], draft: ['', 'Draft'], funded: ['primary', 'Funded'], closed: ['', 'Closed']
};
export function statusBadge(s) {
  const [cls, text] = STATUS_BADGE[s] || ['', s];
  return h('span', { class: 'badge ' + cls }, text);
}

// ---------- modal ----------
export function modal(title, build) {
  const dlg = h('dialog', {});
  const close = () => { dlg.close(); dlg.remove(); };
  const body = h('div', { class: 'dlg stack' }, h('h2', {}, title));
  dlg.append(body);
  build(body, close);
  dlg.addEventListener('cancel', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  dlg.showModal();
  return close;
}

export async function confirmDialog(title, text, okLabel = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    modal(title, (body, close) => {
      body.append(h('p', {}, text), h('div', { class: 'row end' },
        h('button', { class: 'btn secondary', onclick: () => { close(); resolve(false); } }, 'Cancel'),
        h('button', { class: 'btn ' + (danger ? 'danger' : ''), onclick: () => { close(); resolve(true); } }, okLabel)));
    });
  });
}

// ---------- forms ----------
let uid = 0;
/**
 * fields: [{ name, label, type, options, hint, required, rows, placeholder, full, maxlength, inputmode }]
 * type: text | textarea | select | multi | checkbox | email | password | url
 * options: [{value,label}] or [string]
 */
export function buildForm(fields, initial, { submitLabel = 'Save', onSubmit, extra } = {}) {
  initial = initial || {};
  const getters = {};
  const wrappers = {};
  const errEls = {};
  const grid = h('div', { class: 'grid2' });

  for (const f of fields) {
    const id = 'f' + ++uid;
    const opts = (f.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
    let control;
    if (f.type === 'textarea') {
      control = h('textarea', { id, name: f.name, rows: f.rows || 5, maxlength: f.maxlength, placeholder: f.placeholder });
      control.value = initial[f.name] || '';
      getters[f.name] = () => control.value;
    } else if (f.type === 'select') {
      control = h('select', { id, name: f.name },
        h('option', { value: '' }, f.placeholder || 'Select…'),
        opts.map((o) => h('option', { value: o.value }, o.label)));
      control.value = initial[f.name] || '';
      getters[f.name] = () => control.value;
    } else if (f.type === 'multi') {
      const sel = new Set(initial[f.name] || []);
      control = h('div', { class: 'chips', role: 'group', 'aria-labelledby': id + 'l' },
        opts.map((o) => {
          const cb = h('input', { type: 'checkbox', value: o.value });
          cb.checked = sel.has(o.value);
          cb.addEventListener('change', () => (cb.checked ? sel.add(o.value) : sel.delete(o.value)));
          return h('label', { class: 'chip-opt' }, cb, h('span', {}, o.label));
        }));
      getters[f.name] = () => [...sel];
    } else if (f.type === 'checkbox') {
      const cb = h('input', { type: 'checkbox', id, name: f.name });
      cb.checked = !!initial[f.name];
      control = h('label', { class: 'check', for: id }, cb, h('span', {}, f.label));
      getters[f.name] = () => cb.checked;
    } else {
      control = h('input', { id, name: f.name, type: f.type || 'text', maxlength: f.maxlength, placeholder: f.placeholder, inputmode: f.inputmode,
        autocomplete: f.autocomplete, list: f.list });
      control.value = initial[f.name] == null ? '' : initial[f.name];
      getters[f.name] = () => control.value;
    }
    const err = h('div', { class: 'err', role: 'alert' });
    errEls[f.name] = err;
    const showLabel = f.type !== 'checkbox';
    const wrap = h('div', { class: 'field' + (f.full || f.type === 'textarea' || f.type === 'multi' || f.type === 'checkbox' ? ' full' : '') },
      showLabel ? (f.type === 'multi' ? h('span', { class: 'lbl', id: id + 'l' }, f.label + (f.required ? ' *' : '')) :
        h('label', { for: id }, f.label + (f.required ? ' *' : ''))) : null,
      control, f.hint ? h('div', { class: 'hint' }, f.hint) : null, err);
    wrappers[f.name] = wrap;
    grid.append(wrap);
  }

  const formError = h('div', { class: 'form-error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn', type: 'submit' }, submitLabel);
  const form = h('form', { novalidate: true, class: 'stack' }, grid, formError, h('div', { class: 'row' }, submit, extra || null));

  const setErrors = (fieldsErr, message) => {
    for (const k of Object.keys(errEls)) { errEls[k].textContent = ''; wrappers[k].classList.remove('has-error'); }
    let first = null;
    for (const [k, v] of Object.entries(fieldsErr || {})) {
      if (errEls[k]) { errEls[k].textContent = v; wrappers[k].classList.add('has-error'); first = first || wrappers[k]; }
    }
    formError.hidden = !message;
    formError.textContent = message || '';
    if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = {};
    for (const k of Object.keys(getters)) values[k] = getters[k]();
    setErrors({}, '');
    submit.disabled = true;
    const orig = submit.textContent;
    submit.textContent = 'Saving…';
    try {
      await onSubmit(values);
    } catch (err) {
      setErrors(err.fields, err.fields ? 'Please fix the highlighted fields.' : err.message);
    } finally {
      submit.disabled = false;
      submit.textContent = orig;
    }
  });
  form.setErrors = setErrors;
  return form;
}
