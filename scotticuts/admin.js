(() => {
  'use strict';
  const TZ = 'America/New_York';
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const PX = 1.3; // pixels per minute on the day grid

  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'value') n.value = v;
      else if (v === true) n.setAttribute(k, '');
      else if (v !== false && v != null) n.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(kid));
    return n;
  };

  /* ---------- time helpers ---------- */
  function today() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute };
  }
  const dow = (d) => new Date(d + 'T12:00:00Z').getUTCDay();
  const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const fmt = (m) => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
  const hourLabel = (m) => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1} ${h >= 12 ? 'PM' : 'AM'}`; };
  const toHM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const fromHM = (v) => { const [h, m] = String(v).split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : NaN; };
  const longDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const shortDay = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const weekStart = (d) => addDays(d, -dow(d));

  /* ---------- state + api ---------- */
  let token = '';
  try { token = sessionStorage.getItem('sc_admin') || ''; } catch { /* private mode */ }
  const A = { cfg: null, date: today().date, days: {}, tab: 'calendar' };

  async function api(action, payload = {}) {
    const r = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { logout(); throw new Error('Session expired — please log in again.'); }
    if (!r.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }

  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }
  const fail = (e) => toast(e.message || 'Something went wrong.');

  /* ---------- login ---------- */
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginErr'); err.textContent = '';
    try {
      const r = await fetch('/api/admin-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $('#u').value, password: $('#p').value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { err.textContent = d.error || 'Login failed.'; return; }
      token = d.token;
      try { sessionStorage.setItem('sc_admin', token); } catch { /* ignore */ }
      $('#p').value = '';
      start();
    } catch { err.textContent = 'Couldn’t reach the server.'; }
  });

  function logout() {
    token = '';
    try { sessionStorage.removeItem('sc_admin'); } catch { /* ignore */ }
    $('#app').hidden = true; $('#login').hidden = false;
  }
  $('#logout').addEventListener('click', logout);

  async function start() {
    try {
      A.cfg = (await api('config')).config;
    } catch { return; }
    $('#login').hidden = true; $('#app').hidden = false;
    showTab(A.tab);
  }

  /* ---------- tabs ---------- */
  function showTab(t) {
    A.tab = t;
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    ['calendar', 'upcoming', 'team', 'settings'].forEach((k) => { $('#tab-' + k).hidden = k !== t; });
    if (t === 'calendar') loadCalendar();
    if (t === 'upcoming') loadUpcoming();
    if (t === 'team') loadTeam();
    if (t === 'settings') renderSettings();
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  /* ---------- calendar ---------- */
  const live = (b) => b.status !== 'cancelled';

  async function loadCalendar() {
    const from = weekStart(A.date);
    try {
      const { days } = await api('range', { from, to: addDays(from, 6) });
      Object.assign(A.days, days);
    } catch (e) { fail(e); }
    renderCalendar();
  }

  const dayOf = (d) => A.days[d] || { bookings: [], blocks: [], closed: false };

  function renderCalendar() {
    const d = A.date, day = dayOf(d), t = today();
    $('#dayTitle').textContent = d === t.date ? `Today · ${longDate(d)}` : longDate(d);
    $('#pick').value = d;

    // week strip
    const ws = weekStart(d);
    $('#week').replaceChildren(...Array.from({ length: 7 }, (_, i) => {
      const dd = addDays(ws, i), x = dayOf(dd), n = x.bookings.filter((b) => b.status === 'booked' || b.status === 'completed').length;
      const off = !A.cfg.hours[dow(dd)] || x.closed;
      return el('button', { class: (dd === d ? 'on ' : '') + (off ? 'off' : ''), onclick: () => { A.date = dd; renderCalendar(); } },
        el('small', {}, shortDay(dd)), el('b', {}, String(+dd.slice(8))), el('span', { class: 'n' }, off ? 'closed' : `${n} booked`));
    }));

    // banner
    const hours = A.cfg.hours[dow(d)];
    const banner = $('#banner');
    if (day.closed) {
      banner.hidden = false;
      banner.replaceChildren(el('span', {}, `Closed for the day${day.closedNote ? ' — ' + day.closedNote : ''}. Customers can’t book this date.`), el('button', { class: 'btn btn-sm', onclick: () => setClosed(false) }, 'Reopen'));
    } else if (!hours) {
      banner.hidden = false;
      banner.textContent = `${DAYS[dow(d)]} is a regular day off. Online booking is closed; you can still add bookings by hand.`;
    } else banner.hidden = true;
    $('#closeBtn').textContent = day.closed ? 'Reopen day' : 'Close day';

    drawGrid(d, day, hours);
  }

  function drawGrid(date, day, hours) {
    const shown = day.bookings.filter(live);
    const cancelled = day.bookings.filter((b) => !live(b));
    const [open, close] = hours || [600, 1080];
    let lo = open, hi = close;
    for (const b of shown) { lo = Math.min(lo, b.start); hi = Math.max(hi, b.start + b.duration); }
    for (const b of day.blocks) { lo = Math.min(lo, b.start); hi = Math.max(hi, b.end); }
    lo = Math.floor(lo / 60) * 60; hi = Math.ceil(hi / 60) * 60;
    const y = (m) => (m - lo) * PX;

    const grid = $('#grid');
    grid.style.height = `${(hi - lo) * PX}px`;
    const kids = [];
    for (let m = lo; m <= hi; m += 30) kids.push(el('div', { class: 'hr' + (m % 60 ? ' half' : ''), style: `top:${y(m)}px` }, m % 60 ? null : el('span', {}, hourLabel(m))));
    if (hours) {
      if (open > lo) kids.push(el('div', { class: 'shade', style: `top:0;height:${y(open)}px` }));
      if (close < hi) kids.push(el('div', { class: 'shade', style: `top:${y(close)}px;height:${y(hi) - y(close)}px` }));
    } else kids.push(el('div', { class: 'shade', style: 'top:0;bottom:0' }));

    // overlap layout (bookings only; blocks sit across the full width)
    const evs = shown.map((b) => ({ b, s: b.start, e: b.start + b.duration })).sort((p, q) => p.s - q.s || p.e - q.e);
    let cluster = [], clusterEnd = -1;
    const flush = () => {
      const cols = [];
      cluster.forEach((ev) => {
        let c = cols.findIndex((end) => end <= ev.s);
        if (c < 0) { c = cols.length; cols.push(0); }
        cols[c] = ev.e; ev.col = c;
      });
      cluster.forEach((ev) => { ev.cols = cols.length; });
      cluster = [];
    };
    evs.forEach((ev) => { if (cluster.length && ev.s >= clusterEnd) { flush(); clusterEnd = -1; } cluster.push(ev); clusterEnd = Math.max(clusterEnd, ev.e); });
    if (cluster.length) flush();

    day.blocks.forEach((bl) => kids.push(el('button', { class: 'ev block', type: 'button', style: `top:${y(bl.start)}px;height:${(bl.end - bl.start) * PX}px;left:0;right:0;z-index:2;opacity:.92`, onclick: (e) => { e.stopPropagation(); blockInfoModal(date, bl); } },
      el('b', {}, bl.note || 'Blocked'), el('small', {}, `${fmt(bl.start)} – ${fmt(bl.end)}`))));

    evs.forEach(({ b, col, cols }) => {
      kids.push(el('button', {
        class: `ev ${b.status} ${b.source === 'admin' ? 'admin' : ''}`, type: 'button',
        style: `top:${y(b.start)}px;height:${Math.max(b.duration * PX - 2, 26)}px;left:${(col / cols) * 100}%;width:calc(${100 / cols}% - 3px);z-index:3`,
        onclick: (e) => { e.stopPropagation(); bookingModal(date, b); },
      }, el('b', {}, b.name), el('small', {}, `${fmt(b.start)} · ${b.serviceName}`)));
    });

    const t = today();
    if (date === t.date && t.minutes >= lo && t.minutes <= hi) kids.push(el('div', { class: 'now', style: `top:${y(t.minutes)}px` }));
    grid.replaceChildren(...kids);

    grid.onclick = (e) => {
      if (e.target.closest('.ev')) return;
      const rect = grid.getBoundingClientRect();
      const m = lo + Math.floor((e.clientY - rect.top) / PX / 15) * 15;
      bookingFormModal(date, m);
    };

    // cancelled / no-show list under the grid
    $('#grid').parentElement.querySelector('.cx')?.remove();
    if (cancelled.length) {
      $('#grid').parentElement.append(el('div', { class: 'cx', style: 'padding:12px 14px;border-top:1px solid var(--line);color:var(--mute);font-size:.88rem' },
        'Cancelled / no-show: ', cancelled.map((b) => el('button', { class: 'link-btn', type: 'button', style: 'text-transform:none;letter-spacing:0;margin-right:10px;font-size:.88rem', onclick: () => bookingModal(date, b) }, `${b.name} (${fmt(b.start)})`))));
    }
  }

  function applyDay(date, day) { A.days[date] = day; renderCalendar(); }

  $('#prev').onclick = () => { A.date = addDays(A.date, -1); loadCalendar(); };
  $('#next').onclick = () => { A.date = addDays(A.date, 1); loadCalendar(); };
  $('#today').onclick = () => { A.date = today().date; loadCalendar(); };
  $('#pick').onchange = (e) => { if (e.target.value) { A.date = e.target.value; loadCalendar(); } };
  $('#addBtn').onclick = () => { const h = A.cfg.hours[dow(A.date)]; bookingFormModal(A.date, h ? h[0] : 600); };
  $('#blockBtn').onclick = () => blockFormModal(A.date);
  $('#closeBtn').onclick = () => setClosed(!dayOf(A.date).closed);

  async function setClosed(closed) {
    let note = '';
    if (closed) {
      note = prompt('Close this whole day. Optional note (e.g. "Vacation"):', '');
      if (note === null) return;
    }
    try { applyDay(A.date, (await api('setClosed', { date: A.date, closed, note })).day); toast(closed ? 'Day closed' : 'Day reopened'); } catch (e) { fail(e); }
  }

  /* ---------- modals ---------- */
  const dlg = $('#modal'), body = $('#modalBody');
  const openModal = (...kids) => { body.replaceChildren(...kids); if (!dlg.open) dlg.showModal(); };
  const closeModal = () => dlg.open && dlg.close();
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeModal(); });
  const field = (id, label, input, cls = '') => el('div', { class: 'field ' + cls }, el('label', { for: id }, label), input);
  const cancelBtn = () => el('button', { class: 'btn btn-ghost', type: 'button', onclick: closeModal }, 'Close');

  function bookingModal(date, b) {
    const act = (label, status, cls = 'btn btn-ghost') => el('button', {
      class: cls, type: 'button',
      onclick: async () => { try { const out = await api('setStatus', { date, id: b.id, status }); closeModal(); applyDay(date, out.day); toast(label); } catch (e) { fail(e); } },
    }, label);
    const del = el('button', {
      class: 'btn btn-danger', type: 'button',
      onclick: async () => { if (!confirm('Permanently delete this booking?')) return; try { const out = await api('deleteBooking', { date, id: b.id }); closeModal(); applyDay(date, out.day); toast('Deleted'); } catch (e) { fail(e); } },
    }, 'Delete');
    const status = { booked: 'Booked', completed: 'Completed', noshow: 'No-show', cancelled: 'Cancelled' }[b.status];
    openModal(
      el('h3', {}, b.name),
      el('dl', { class: 'kv' },
        el('dt', {}, 'When'), el('dd', {}, `${longDate(date)}, ${fmt(b.start)} – ${fmt(b.start + b.duration)}`),
        el('dt', {}, 'Service'), el('dd', {}, `${b.serviceName} · ${b.priceLabel}`),
        el('dt', {}, 'Phone'), el('dd', {}, b.phone ? el('a', { href: `tel:${b.phone}` }, b.phone) : '—'),
        el('dt', {}, 'Email'), el('dd', {}, b.email ? el('a', { href: `mailto:${b.email}` }, b.email) : '—'),
        el('dt', {}, 'Notes'), el('dd', {}, b.notes || '—'),
        el('dt', {}, 'Status'), el('dd', {}, status + (b.cancelledBy ? ` (by ${b.cancelledBy})` : '')),
        el('dt', {}, 'Source'), el('dd', {}, b.source === 'admin' ? 'Added by staff' : 'Booked online')),
      el('div', { class: 'acts' },
        b.status === 'booked' ? [act('Mark done', 'completed', 'btn'), act('No-show', 'noshow'), act('Cancel booking', 'cancelled', 'btn btn-danger')] : act('Restore', 'booked', 'btn'),
        del, cancelBtn()),
    );
  }

  function bookingFormModal(date, startMin) {
    const svcs = A.cfg.services;
    const sel = el('select', { id: 'f-svc' }, svcs.map((s) => el('option', { value: s.id }, `${s.name} — ${s.priceLabel}`)));
    const dur = el('input', { id: 'f-dur', type: 'number', min: '5', step: '5', value: svcs[0].duration });
    sel.onchange = () => { dur.value = svcs.find((s) => s.id === sel.value).duration; };
    const err = el('p', { class: 'err', role: 'alert' });
    const f = {
      date: el('input', { id: 'f-date', type: 'date', value: date, required: true, style: 'color-scheme:dark' }),
      time: el('input', { id: 'f-time', type: 'time', value: toHM(startMin), step: '300', required: true, style: 'color-scheme:dark' }),
      name: el('input', { id: 'f-name', required: true, maxlength: 80, autocomplete: 'off' }),
      phone: el('input', { id: 'f-phone', type: 'tel', maxlength: 25 }),
      email: el('input', { id: 'f-email', type: 'email', maxlength: 120 }),
      notes: el('input', { id: 'f-notes', maxlength: 300 }),
    };
    const save = el('button', { class: 'btn', type: 'submit' }, 'Add booking');
    const form = el('form', { style: 'display:grid;gap:12px', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = ''; save.disabled = true;
      try {
        const out = await api('addBooking', { date: f.date.value, start: fromHM(f.time.value), serviceId: sel.value, duration: Number(dur.value), name: f.name.value, phone: f.phone.value, email: f.email.value, notes: f.notes.value });
        closeModal(); A.date = f.date.value; applyDay(f.date.value, out.day); toast('Booking added');
        if (A.date !== date) loadCalendar();
      } catch (ex) { err.textContent = ex.message; } finally { save.disabled = false; }
    } },
      el('div', { class: 'grid2' }, field('f-date', 'Date', f.date), field('f-time', 'Start time', f.time)),
      el('div', { class: 'grid2' }, field('f-svc', 'Service', sel), field('f-dur', 'Minutes', dur)),
      field('f-name', 'Customer name', f.name),
      el('div', { class: 'grid2' }, field('f-phone', 'Phone', f.phone), field('f-email', 'Email', f.email)),
      field('f-notes', 'Notes', f.notes), err,
      el('div', { class: 'acts' }, save, cancelBtn()));
    openModal(el('h3', {}, 'New booking'), form);
    f.name.focus();
  }

  function blockFormModal(date) {
    const h = A.cfg.hours[dow(date)] || [600, 1080];
    const s = el('input', { id: 'b-s', type: 'time', value: toHM(h[0]), style: 'color-scheme:dark' });
    const e = el('input', { id: 'b-e', type: 'time', value: toHM(Math.min(h[0] + 60, h[1])), style: 'color-scheme:dark' });
    const n = el('input', { id: 'b-n', maxlength: 80, placeholder: 'Lunch, appointment, etc.' });
    const err = el('p', { class: 'err', role: 'alert' });
    openModal(el('h3', {}, 'Block off time'), el('p', { class: 'sub', style: 'color:var(--mute)' }, `${longDate(date)} — customers won’t be able to book these times.`),
      el('div', { class: 'grid2' }, field('b-s', 'From', s), field('b-e', 'To', e)), field('b-n', 'Note', n), err,
      el('div', { class: 'acts' }, el('button', { class: 'btn', type: 'button', onclick: async () => {
        try { const out = await api('addBlock', { date, start: fromHM(s.value), end: fromHM(e.value), note: n.value }); closeModal(); applyDay(date, out.day); toast('Time blocked'); } catch (ex) { err.textContent = ex.message; }
      } }, 'Block time'), cancelBtn()));
  }

  function blockInfoModal(date, bl) {
    openModal(el('h3', {}, bl.note || 'Blocked time'), el('p', {}, `${longDate(date)}, ${fmt(bl.start)} – ${fmt(bl.end)}`),
      el('div', { class: 'acts' }, el('button', { class: 'btn btn-danger', type: 'button', onclick: async () => {
        try { const out = await api('removeBlock', { date, id: bl.id }); closeModal(); applyDay(date, out.day); toast('Block removed'); } catch (e) { fail(e); }
      } }, 'Remove block'), cancelBtn()));
  }

  /* ---------- upcoming ---------- */
  async function loadUpcoming() {
    const box = $('#upcoming');
    box.textContent = 'Loading…';
    const from = today().date;
    try {
      const { days } = await api('range', { from, to: addDays(from, 13) });
      Object.assign(A.days, days);
      const out = [];
      for (const [d, day] of Object.entries(days).sort()) {
        const list = day.bookings.filter(live).sort((a, b) => a.start - b.start);
        if (!list.length) continue;
        out.push(el('div', { class: 'up-day' },
          el('h3', {}, d === from ? 'Today' : longDate(d), el('small', {}, `${list.length} appointment${list.length > 1 ? 's' : ''}`)),
          list.map((b) => el('button', { class: 'up-row', type: 'button', onclick: () => bookingModal(d, b) },
            el('span', { class: 't' }, fmt(b.start)),
            el('span', {}, el('b', {}, b.name), el('br'), el('small', {}, `${b.serviceName} · ${b.priceLabel}${b.phone ? ' · ' + b.phone : ''}`)),
            b.status !== 'booked' ? el('span', { class: `pill ${b.status}` }, b.status === 'noshow' ? 'No-show' : b.status) : el('span', { class: 'pill' }, b.source === 'admin' ? 'Phone' : 'Online')))));
      }
      box.replaceChildren(...(out.length ? out : [el('div', { class: 'empty' }, 'Nothing booked in the next two weeks.')]));
    } catch (e) { box.textContent = e.message; }
  }

  /* ---------- team ---------- */
  async function loadTeam() {
    const box = $('#teamList');
    box.textContent = 'Loading…';
    try {
      const { employees } = await api('listEmployees');
      if (!employees.length) { box.replaceChildren(el('div', { class: 'empty' }, 'No barbers yet. Add Scotti and the crew — they’ll show up on the website.')); return; }
      box.replaceChildren(...employees.map((e) => el('div', { class: 'emp-row' },
        el('div', { class: 'emp-av', style: e.photo ? `background-image:url("${e.photo}")` : '' }, e.photo ? '' : e.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()),
        el('div', { class: 'emp-info' }, el('b', {}, e.name), el('small', {}, `${e.title || 'Barber'} · login: ${e.username} · ${e.images.length} photo${e.images.length === 1 ? '' : 's'}`)),
        el('div', { class: 'emp-act' },
          el('a', { class: 'btn btn-ghost btn-sm', href: `/staff?emp=${encodeURIComponent(e.id)}`, target: '_blank' }, 'Edit profile & photos'),
          el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => {
            if (!confirm(`Remove ${e.name} and all of their photos? This can’t be undone.`)) return;
            try { await api('deleteEmployee', { id: e.id }); toast('Barber removed'); loadTeam(); } catch (ex) { fail(ex); }
          } }, 'Remove')))));
    } catch (e) { box.textContent = e.message; }
  }

  $('#addEmp').addEventListener('click', () => {
    const f = {
      name: el('input', { id: 'e-name', required: true, maxlength: 60 }),
      title: el('input', { id: 'e-title', maxlength: 60, placeholder: 'Barber, Owner…' }),
      user: el('input', { id: 'e-user', required: true, maxlength: 30, autocapitalize: 'none', autocomplete: 'off' }),
      pass: el('input', { id: 'e-pass', type: 'text', required: true, minlength: 8, autocomplete: 'off', placeholder: '8+ characters' }),
      bio: el('textarea', { id: 'e-bio', maxlength: 800, rows: 3 }),
    };
    f.name.addEventListener('input', () => { if (!f.user.dataset.touched) f.user.value = f.name.value.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, ''); });
    f.user.addEventListener('input', () => { f.user.dataset.touched = '1'; });
    const err = el('p', { class: 'err', role: 'alert' });
    openModal(el('h3', {}, 'Add barber'),
      el('p', { style: 'color:var(--mute)' }, 'Give them the username and password — they can change the password after logging in at /staff.'),
      field('e-name', 'Name', f.name), field('e-title', 'Title', f.title),
      el('div', { class: 'grid2' }, field('e-user', 'Username', f.user), field('e-pass', 'Starting password', f.pass)),
      field('e-bio', 'Bio (optional — they can edit it)', f.bio), err,
      el('div', { class: 'acts' }, el('button', { class: 'btn', type: 'button', onclick: async () => {
        try { await api('createEmployee', { name: f.name.value, title: f.title.value, username: f.user.value, password: f.pass.value, bio: f.bio.value }); closeModal(); toast('Barber added'); loadTeam(); } catch (ex) { err.textContent = ex.message; }
      } }, 'Add barber'), cancelBtn()));
    f.name.focus();
  });

  /* ---------- settings ---------- */
  let draft;
  function renderSettings() {
    draft = JSON.parse(JSON.stringify(A.cfg));
    drawServices(); drawHours(); drawRules();
    $('#saveMsg').textContent = '';
  }

  function drawServices() {
    const ed = $('#svcEditor');
    const row = (s, i) => el('div', { class: 'svc-row' },
      field(`sn${i}`, 'Name', el('input', { id: `sn${i}`, value: s.name, maxlength: 60, oninput: (e) => { s.name = e.target.value; } })),
      field(`sp${i}`, 'Price', el('input', { id: `sp${i}`, value: s.priceLabel, maxlength: 20, placeholder: '$25', oninput: (e) => { s.priceLabel = e.target.value; } })),
      field(`sd${i}`, 'Minutes', el('input', { id: `sd${i}`, type: 'number', min: '5', step: '5', value: s.duration, oninput: (e) => { s.duration = Number(e.target.value); } })),
      field(`sx${i}`, 'Description', el('input', { id: `sx${i}`, value: s.desc || '', maxlength: 200, oninput: (e) => { s.desc = e.target.value; } }), 'wide'),
      el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: s.active !== false, onchange: (e) => { s.active = e.target.checked; } }), 'Bookable'),
      el('button', { class: 'x', type: 'button', 'aria-label': `Remove ${s.name}`, onclick: () => { if (confirm(`Remove "${s.name}"?`)) { draft.services.splice(i, 1); drawServices(); } } }, '✕'));
    ed.replaceChildren(el('div', { class: 'card' }, draft.services.map(row)),
      el('button', { class: 'btn btn-ghost btn-sm add-row', type: 'button', onclick: () => { draft.services.push({ id: '', name: 'New service', priceLabel: '$0', duration: 30, desc: '', active: true }); drawServices(); } }, '+ Add service'));
  }

  function drawHours() {
    const order = [1, 2, 3, 4, 5, 6, 0];
    $('#hoursEditor').replaceChildren(el('div', { class: 'card' }, order.map((i) => {
      const h = draft.hours[i];
      const o = el('input', { type: 'time', value: toHM((h || [600])[0]), disabled: !h, 'aria-label': `${DAYS[i]} opens`, onchange: (e) => { draft.hours[i][0] = fromHM(e.target.value); } });
      const c = el('input', { type: 'time', value: toHM((h || [0, 1080])[1]), disabled: !h, 'aria-label': `${DAYS[i]} closes`, onchange: (e) => { draft.hours[i][1] = fromHM(e.target.value); } });
      return el('div', { class: 'hrs-row' }, el('b', {}, DAYS[i]), o, c,
        el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: !h, onchange: (e) => {
          draft.hours[i] = e.target.checked ? null : [fromHM(o.value) || 600, fromHM(c.value) || 1080];
          o.disabled = c.disabled = e.target.checked;
        } }), 'Closed'));
    })));
  }

  function drawRules() {
    const num = (id, label, key, attrs = {}) => field(id, label, el('input', { id, type: 'number', value: draft[key], ...attrs, oninput: (e) => { draft[key] = Number(e.target.value); } }));
    const step = el('select', { id: 'r-step', onchange: (e) => { draft.step = Number(e.target.value); } }, [15, 20, 30, 60].map((m) => el('option', { value: m, selected: draft.step === m }, `Every ${m} min`)));
    $('#rules').replaceChildren(
      num('r-chairs', 'Chairs working at once', 'chairs', { min: 1, max: 10 }),
      field('r-step', 'Start times', step),
      num('r-lead', 'Minimum notice (minutes)', 'leadMinutes', { min: 0 }),
      num('r-max', 'Book up to (days ahead)', 'maxDays', { min: 1, max: 180 }));
  }

  $('#saveCfg').addEventListener('click', async () => {
    const msg = $('#saveMsg'); msg.className = 'msg'; msg.textContent = 'Saving…';
    try {
      const out = await api('saveConfig', { config: draft });
      A.cfg = out.config; msg.textContent = 'Saved ✓'; toast('Settings saved');
      renderSettings(); $('#saveMsg').textContent = 'Saved ✓';
    } catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; }
  });

  if (token) start();
})();
