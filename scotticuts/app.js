(() => {
  'use strict';
  const PHONE = '(609) 365-2539';
  const TZ = 'America/New_York';
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Baked-in fallback so the menu and hours still render if the API is unreachable.
  let cfg = {
    step: 30, leadMinutes: 60, maxDays: 60,
    hours: { 0: null, 1: null, 2: [600, 1080], 3: [600, 1080], 4: [600, 1080], 5: [600, 1080], 6: [600, 1080] },
    services: [
      { id: 'basic-cut', name: 'Basic Cut', priceLabel: '$20', duration: 30, desc: 'Clean, classic cut — clippers and scissor work.' },
      { id: 'premium-cut', name: 'Premium Cut', priceLabel: '$25', duration: 45, desc: 'Extra detail, fade work and a sharp finish.' },
      { id: 'cut-facial', name: 'Cut & Facial Hair', priceLabel: '$25–$30', duration: 45, desc: 'Your cut plus a beard or mustache trim and line-up.' },
      { id: 'facial-only', name: 'Facial Hair Only', priceLabel: '$10–$15', duration: 30, desc: 'Beard shape-up, trim and line-up.' },
      { id: 'razor-shave', name: 'Razor Steam Shave', priceLabel: '$25', duration: 30, desc: 'Hot towel, steam and a traditional straight-razor shave.' },
      { id: 'cut-shave', name: 'Cut & Shave', priceLabel: '$40', duration: 60, desc: 'The full treatment — premium cut plus a razor steam shave.' },
    ],
  };
  let apiOk = false;

  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else if (v !== false && v != null) n.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(kid));
    return n;
  };

  /* ---------- NJ clock ---------- */
  function nowNJ() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute };
  }
  const dow = (d) => new Date(d + 'T12:00:00Z').getUTCDay();
  const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const fmt = (m) => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
  const fmtShort = (m) => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}${m % 60 ? ':' + String(m % 60).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`; };
  const longDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  /* ---------- static sections ---------- */
  function renderMenu() {
    const ul = $('#menu');
    ul.replaceChildren(...cfg.services.map((s) => el('li', {},
      el('div', { class: 'row' }, el('span', { class: 'name' }, s.name), el('span', { class: 'dots' }), el('span', { class: 'price' }, s.priceLabel)),
      s.desc ? el('p', { class: 'desc' }, s.desc) : null,
    )));
  }

  function renderHours() {
    const today = dow(nowNJ().date);
    const order = [1, 2, 3, 4, 5, 6, 0];
    $('#hours').replaceChildren(...order.map((i) => {
      const h = cfg.hours[i];
      return el('tr', { class: i === today ? 'today' : '' },
        el('td', {}, DAYS[i]),
        el('td', { class: h ? '' : 'closed' }, h ? `${fmt(h[0])} – ${fmt(h[1])}` : 'Closed'));
    }));
  }

  function renderOpenBadge() {
    const b = $('#openBadge');
    const n = nowNJ();
    const h = cfg.hours[dow(n.date)];
    const open = h && n.minutes >= h[0] && n.minutes < h[1];
    b.hidden = false;
    b.classList.toggle('closed', !open);
    if (open) b.textContent = `Open now · until ${fmtShort(h[1])}`;
    else {
      let d = n.date, label = '';
      for (let i = 0; i < 8; i++) {
        const hh = cfg.hours[dow(d)];
        if (hh && (i > 0 || n.minutes < hh[0])) { label = i === 0 ? `today ${fmtShort(hh[0])}` : `${DAYS[dow(d)]} ${fmtShort(hh[0])}`; break; }
        d = addDays(d, 1);
      }
      b.textContent = `Closed · opens ${label}`;
    }
  }

  /* ---------- booking wizard ---------- */
  const S = { step: 1, service: null, month: null, date: null, slot: null, slots: null, loading: false, error: '', sending: false, done: null };
  const panel = $('#panel');

  function setStep(n) {
    S.step = n; S.error = '';
    document.querySelectorAll('#steps li').forEach((li) => {
      const k = +li.dataset.step;
      li.classList.toggle('on', k === n);
      li.classList.toggle('done', k < n || !!S.done);
    });
    draw();
  }

  const back = (to) => el('button', { class: 'link-btn', type: 'button', onclick: () => setStep(to) }, '← Back');

  function drawService() {
    panel.replaceChildren(
      el('h3', {}, 'What are we doing?'),
      el('p', { class: 'sub' }, 'Pick a service to see open times.'),
      el('div', { class: 'svc-grid' }, cfg.services.map((s) => el('button', {
        class: 'svc', type: 'button', 'aria-pressed': S.service?.id === s.id ? 'true' : 'false',
        onclick: () => { S.service = s; S.date = null; S.slot = null; S.slots = null; setStep(2); },
      }, el('span', { class: 't' }, s.name, el('b', {}, s.priceLabel)), el('div', { class: 'm' }, `About ${s.duration} min`)))),
    );
  }

  function drawDate() {
    const now = nowNJ();
    const last = addDays(now.date, cfg.maxDays);
    if (!S.month) S.month = now.date.slice(0, 7);
    const [Y, M] = S.month.split('-').map(Number);
    const first = new Date(Date.UTC(Y, M - 1, 1));
    const daysIn = new Date(Date.UTC(Y, M, 0)).getUTCDate();
    const prevOk = S.month > now.date.slice(0, 7);
    const nextOk = `${Y}-${String(M).padStart(2, '0')}-${String(daysIn).padStart(2, '0')}` < last;

    const cells = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => el('div', { class: 'dow' }, d));
    for (let i = 0; i < first.getUTCDay(); i++) cells.push(el('div', { class: 'blank' }));
    for (let d = 1; d <= daysIn; d++) {
      const ds = `${Y}-${String(M).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const h = cfg.hours[dow(ds)];
      let off = !h || ds < now.date || ds > last;
      if (!off && ds === now.date && now.minutes + cfg.leadMinutes + S.service.duration > h[1]) off = true;
      cells.push(el('button', {
        type: 'button', disabled: off, class: ds === now.date ? 'today' : '', 'aria-pressed': S.date === ds ? 'true' : 'false',
        'aria-label': longDate(ds),
        onclick: () => { S.date = ds; S.slot = null; S.slots = null; loadSlots(); setStep(3); },
      }, String(d)));
    }

    panel.replaceChildren(
      el('div', { class: 'summary' }, el('span', {}, el('b', {}, S.service.name), ` · ${S.service.priceLabel}`)),
      el('h3', {}, 'Pick a day'),
      el('p', { class: 'sub' }, 'Open Tuesday – Saturday. Closed days are crossed out.'),
      el('div', { class: 'cal-head' },
        el('button', { class: 'cal-nav', type: 'button', disabled: !prevOk, 'aria-label': 'Previous month', onclick: () => { S.month = shiftMonth(S.month, -1); drawDate(); } }, '‹'),
        el('strong', {}, `${MONTHS[M - 1]} ${Y}`),
        el('button', { class: 'cal-nav', type: 'button', disabled: !nextOk, 'aria-label': 'Next month', onclick: () => { S.month = shiftMonth(S.month, 1); drawDate(); } }, '›')),
      el('div', { class: 'cal' }, cells),
      el('div', { class: 'nav-row' }, back(1)),
    );
  }
  const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };

  async function loadSlots() {
    S.loading = true; S.slots = null;
    try {
      const r = await fetch(`/api/availability?date=${S.date}&service=${encodeURIComponent(S.service.id)}`);
      if (!r.ok) throw new Error();
      S.slots = (await r.json()).slots;
      apiOk = true;
    } catch {
      S.slots = null; S.error = 'api';
    }
    S.loading = false;
    if (S.step === 3) draw();
  }

  function drawTime() {
    const head = [
      el('div', { class: 'summary' }, el('span', {}, el('b', {}, S.service.name), ` · ${S.service.priceLabel}`), el('span', {}, longDate(S.date))),
      el('h3', {}, 'Pick a time'),
    ];
    let body;
    if (S.loading || (S.slots === null && S.error !== 'api')) body = el('div', { class: 'empty' }, 'Checking the chair…');
    else if (S.error === 'api') body = el('div', { class: 'empty' }, 'Online booking is unavailable right now. Please call ', el('a', { href: 'tel:+16093652539' }, PHONE), '.');
    else if (!S.slots.length) body = el('div', { class: 'empty' }, 'No openings that day — try another date, or call ', el('a', { href: 'tel:+16093652539' }, PHONE), '.');
    else {
      const groups = [['Morning', (t) => t < 720], ['Afternoon', (t) => t >= 720 && t < 1080], ['Evening', (t) => t >= 1080]];
      body = el('div', {}, groups.map(([label, test]) => {
        const list = S.slots.filter((s) => test(s.t));
        if (!list.length) return null;
        return el('div', {}, el('p', { class: 'slots-label' }, label), el('div', { class: 'slots' }, list.map((s) =>
          el('button', { class: 'slot', type: 'button', 'aria-pressed': S.slot === s.t ? 'true' : 'false', onclick: () => { S.slot = s.t; setStep(4); } }, s.label))));
      }));
    }
    panel.replaceChildren(...head, body, el('div', { class: 'nav-row' }, back(2)));
  }

  function drawDetails() {
    const f = (id, label, attrs = {}) => el('div', { class: 'field' + (attrs.full ? ' full' : '') }, el('label', { for: id }, label),
      attrs.tag === 'textarea' ? el('textarea', { id, name: id, maxlength: 300, placeholder: attrs.ph || '' }) : el('input', { id, name: id, type: attrs.type || 'text', autocomplete: attrs.ac || 'off', required: !!attrs.req, placeholder: attrs.ph || '', maxlength: 120, inputmode: attrs.mode }));
    const form = el('form', { class: 'form', novalidate: true, onsubmit: submit },
      f('name', 'Your name', { req: true, ac: 'name' }),
      f('phone', 'Phone', { req: true, type: 'tel', ac: 'tel', mode: 'tel', ph: '(609) 555-0123' }),
      f('email', 'Email (for your confirmation)', { type: 'email', ac: 'email', full: true }),
      f('notes', 'Anything we should know? (optional)', { tag: 'textarea', full: true, ph: 'Style, reference photo, first visit…' }),
      el('div', { class: 'hp', 'aria-hidden': 'true' }, el('label', { for: 'website' }, 'Website'), el('input', { id: 'website', name: 'website', tabindex: '-1', autocomplete: 'off' })),
      el('div', { class: 'full' }, el('div', { class: 'err', id: 'formErr', role: 'alert' }, S.error)),
      el('div', { class: 'full nav-row', style: 'margin-top:0' }, back(3), el('button', { class: 'btn', type: 'submit', id: 'sendBtn' }, 'Confirm booking')),
    );
    panel.replaceChildren(
      el('div', { class: 'summary' }, el('span', {}, el('b', {}, S.service.name), ` · ${S.service.priceLabel}`), el('span', {}, `${longDate(S.date)} at ${fmt(S.slot)}`)),
      el('h3', {}, 'Almost done'),
      el('p', { class: 'sub' }, 'No payment now — pay at the shop.'),
      form,
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (S.sending) return;
    const fd = Object.fromEntries(new FormData(e.target));
    const err = $('#formErr');
    if (fd.name.trim().length < 2) { err.textContent = 'Please enter your name.'; return; }
    if (fd.phone.replace(/\D/g, '').length < 10) { err.textContent = 'Please enter a phone number we can reach you at.'; return; }
    S.sending = true;
    const btn = $('#sendBtn'); btn.disabled = true; btn.textContent = 'Booking…'; err.textContent = '';
    try {
      const r = await fetch('/api/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: S.service.id, date: S.date, start: S.slot, ...fd }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        err.textContent = data.error || 'Something went wrong. Please call the shop.';
        if (r.status === 409) { S.slot = null; S.slots = null; loadSlots(); setTimeout(() => setStep(3), 1400); }
        return;
      }
      S.done = data;
      setStep(5);
    } catch {
      err.textContent = `Couldn’t reach the server. Please try again or call ${PHONE}.`;
    } finally {
      S.sending = false;
      if (btn.isConnected) { btn.disabled = false; btn.textContent = 'Confirm booking'; }
    }
  }

  function icsFor(b) {
    const d = b.date.replace(/-/g, '');
    const t = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}00`;
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ScottiCuts//Booking//EN', 'BEGIN:VEVENT',
      `UID:${b.id}@scotticuts`, `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d+/g, '')}`,
      `DTSTART;TZID=${TZ}:${d}T${t(b.start)}`, `DTEND;TZID=${TZ}:${d}T${t(b.start + b.duration)}`,
      `SUMMARY:${b.serviceName} at ScottiCuts`, 'LOCATION:426 Shore Rd Unit E\\, Somers Point\\, NJ 08244',
      `DESCRIPTION:Call ${PHONE} to change your appointment.`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }

  function drawDone() {
    const { booking: b, manageUrl } = S.done;
    const blob = new Blob([icsFor(b)], { type: 'text/calendar' });
    panel.replaceChildren(el('div', { class: 'done-card' },
      el('div', { class: 'check', 'aria-hidden': 'true' }, '✓'),
      el('h3', {}, `You’re booked, ${b.name.split(' ')[0]}!`),
      el('p', { class: 'when' }, `${longDate(b.date)} · ${fmt(b.start)}`),
      el('p', {}, `${b.serviceName} · ${b.priceLabel} · 426 Shore Rd Unit E, Somers Point`),
      el('div', { class: 'done-actions' },
        el('a', { class: 'btn', href: URL.createObjectURL(blob), download: 'scotticuts-appointment.ics' }, 'Add to calendar'),
        el('a', { class: 'btn btn-ghost', href: manageUrl }, 'Change or cancel'),
        el('button', { class: 'btn btn-ghost', type: 'button', onclick: reset }, 'Book another')),
      el('p', { style: 'margin-top:22px;color:var(--mute);font-size:.92rem' }, 'Save your “Change or cancel” link — it’s the only way to manage this booking online. Running late? Call ', el('a', { href: 'tel:+16093652539' }, PHONE), '.'),
    ));
    try { localStorage.setItem('scotticuts:last', JSON.stringify({ url: manageUrl, when: `${longDate(b.date)} ${fmt(b.start)}` })); } catch { /* optional */ }
  }

  function reset() {
    Object.assign(S, { step: 1, service: null, month: null, date: null, slot: null, slots: null, loading: false, error: '', sending: false, done: null });
    setStep(1);
  }

  function draw() {
    if (S.step === 1) drawService();
    else if (S.step === 2) drawDate();
    else if (S.step === 3) drawTime();
    else if (S.step === 4) drawDetails();
    else drawDone();
  }

  /* ---------- barbers ---------- */
  const LB = { list: [], i: 0 };
  const lb = $('#lightbox');
  function lbShow() {
    const im = LB.list[LB.i];
    $('img', lb).src = im.url; $('img', lb).alt = im.caption || 'Portfolio photo';
    $('figcaption', lb).textContent = im.caption || '';
    lb.classList.toggle('single', LB.list.length < 2);
  }
  function lbOpen(list, i) { LB.list = list; LB.i = i; lbShow(); if (!lb.open) lb.showModal(); }
  const lbStep = (n) => { LB.i = (LB.i + n + LB.list.length) % LB.list.length; lbShow(); };
  $('.lb-x', lb).onclick = () => lb.close();
  $('.prev', lb).onclick = () => lbStep(-1);
  $('.next', lb).onclick = () => lbStep(1);
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') lbStep(-1); if (e.key === 'ArrowRight') lbStep(1); });

  async function renderTeam() {
    let team = [];
    try { const r = await fetch('/api/team'); if (r.ok) team = (await r.json()).team; } catch { /* no team yet */ }
    if (!team.length) return;
    const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const SHOWN = 6;
    $('#teamGrid').replaceChildren(...team.map((b) => {
      const photo = el('div', { class: 'b-photo', role: b.photo ? 'img' : null, 'aria-label': b.photo ? b.name : null, style: b.photo ? `background-image:url("${b.photo}")` : '' }, b.photo ? null : initials(b.name));
      const work = b.images.length ? el('div', { class: 'b-work' }, b.images.slice(0, SHOWN).map((im, i) => {
        const extra = i === SHOWN - 1 ? b.images.length - SHOWN : 0;
        return el('button', { type: 'button', 'aria-label': `View ${b.name} photo ${i + 1}`, onclick: () => lbOpen(b.images, i) },
          el('img', { src: im.url, alt: im.caption || `${b.name} portfolio`, loading: 'lazy' }), extra > 0 ? el('span', { class: 'more' }, `+${extra}`) : null);
      })) : null;
      return el('article', { class: 'barber' }, photo, el('div', {},
        el('h3', { class: 'b-name' }, b.name), b.title ? el('p', { class: 'b-title' }, b.title) : null,
        b.bio ? el('p', { class: 'b-bio' }, b.bio) : null, work,
        el('a', { class: 'btn btn-sm', href: '#book' }, `Book a cut`)));
    }));
    $('#team').hidden = false; $('#navTeam').hidden = false;
  }

  /* ---------- boot ---------- */
  async function boot() {
    $('#yr').textContent = nowNJ().date.slice(0, 4);
    try {
      const r = await fetch('/api/services');
      if (r.ok) { cfg = { ...cfg, ...(await r.json()) }; apiOk = true; }
    } catch { /* keep fallback */ }
    renderMenu(); renderHours(); renderOpenBadge(); renderTeam();
    setStep(1);
  }
  boot();

  // hide the mobile sticky button while the booking section is on screen
  const sticky = $('.sticky-book');
  if (sticky && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => sticky.classList.toggle('hide', e.isIntersecting)), { threshold: 0.15 });
    io.observe($('#book'));
  }
})();
