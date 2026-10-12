(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(kid));
    return n;
  };

  // The owner can open /staff?emp=<id> from the admin portal to edit anyone's profile.
  const asEmp = new URLSearchParams(location.search).get('emp');
  const KEY = 'sc_staff';
  const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k) || ''; if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* private mode */ } return ''; };
  let token = asEmp ? ss('sc_admin') : ss(KEY);
  let emp = null;
  const isAdmin = !!asEmp;

  let toastT;
  const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); };

  async function api(payload) {
    const r = await fetch('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ emp: asEmp, ...payload }) });
    return done(r);
  }
  async function done(r) {
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { logout(); throw new Error('Session expired — please log in again.'); }
    if (!r.ok) throw new Error(d.error || 'Something went wrong.');
    return d;
  }

  /* ---------- login ---------- */
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginErr'); err.textContent = '';
    try {
      const r = await fetch('/api/staff-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $('#u').value, password: $('#p').value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { err.textContent = d.error || 'Login failed.'; return; }
      token = d.token; ss(KEY, token); $('#p').value = '';
      start();
    } catch { err.textContent = 'Couldn’t reach the server.'; }
  });
  function logout() { token = ''; if (!isAdmin) ss(KEY, null); $('#app').hidden = true; $('#login').hidden = false; }
  $('#logout').addEventListener('click', () => { if (isAdmin) window.close(); else logout(); });

  async function start() {
    if (!token) return;
    try { emp = (await api({ action: 'me' })).employee; } catch { return; }
    $('#login').hidden = true; $('#app').hidden = false;
    $('#who').textContent = emp.name;
    $('#curWrap').hidden = isAdmin;
    if (isAdmin) { const b = $('#asAdmin'); b.hidden = false; b.textContent = `Owner mode — you’re editing ${emp.name}’s profile.`; $('#logout').textContent = 'Close'; }
    fill();
  }

  /* ---------- profile ---------- */
  const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  function fill() {
    const av = $('#avatar');
    av.style.backgroundImage = emp.photo ? `url("${emp.photo}")` : '';
    av.textContent = emp.photo ? '' : initials(emp.name);
    $('#photoDel').hidden = !emp.photo;
    $('#pName').value = emp.name; $('#pTitle').value = emp.title; $('#pBio').value = emp.bio;
    countBio(); drawPortfolio();
  }
  const countBio = () => { $('#bioCount').textContent = `${$('#pBio').value.length} / 800`; };
  $('#pBio').addEventListener('input', countBio);

  $('#profForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#profMsg'); m.className = 'msg'; m.textContent = 'Saving…';
    try {
      emp = { ...emp, ...(await api({ action: 'saveProfile', name: $('#pName').value, title: $('#pTitle').value, bio: $('#pBio').value })).employee };
      m.textContent = 'Saved ✓'; $('#who').textContent = emp.name; toast('Profile saved');
    } catch (ex) { m.className = 'msg bad'; m.textContent = ex.message; }
  });

  /* ---------- images ---------- */
  // Shrink + re-encode in the browser so uploads stay small and fast.
  async function shrink(file, max, quality = 0.85) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Couldn’t read that image.'))), 'image/jpeg', quality));
  }

  async function upload(file, kind) {
    const blob = await shrink(file, kind === 'photo' ? 1000 : 1600);
    const q = new URLSearchParams({ kind, ...(asEmp ? { emp: asEmp } : {}) });
    const r = await fetch(`/api/staff-upload?${q}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${token}` }, body: blob });
    return (await done(r)).employee;
  }

  $('#photoIn').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { toast('Uploading photo…'); emp = { ...emp, ...(await upload(f, 'photo')) }; fill(); toast('Photo updated'); } catch (ex) { toast(ex.message); }
  });
  $('#photoDel').addEventListener('click', async () => {
    try { emp = { ...emp, ...(await api({ action: 'deleteImage', imageId: 'photo' })).employee }; fill(); } catch (ex) { toast(ex.message); }
  });

  $('#portIn').addEventListener('change', async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    const m = $('#portMsg'); m.className = 'msg';
    let ok = 0;
    for (const [i, f] of files.entries()) {
      m.textContent = `Uploading ${i + 1} of ${files.length}…`;
      try { emp = { ...emp, ...(await upload(f, 'portfolio')) }; ok++; drawPortfolio(); }
      catch (ex) { m.className = 'msg bad'; m.textContent = `${f.name}: ${ex.message}`; return; }
    }
    m.textContent = ok ? `Added ${ok} photo${ok > 1 ? 's' : ''} ✓` : '';
  });

  function drawPortfolio() {
    const grid = $('#port');
    if (!emp.images.length) { grid.replaceChildren(el('div', { class: 'empty' }, 'No photos yet — add your best cuts.')); return; }
    grid.replaceChildren(...emp.images.map((im) => {
      const cap = el('input', { value: im.caption, maxlength: 100, placeholder: 'Caption (optional)', 'aria-label': 'Caption' });
      cap.addEventListener('change', async () => {
        try { emp = { ...emp, ...(await api({ action: 'setCaption', imageId: im.id, caption: cap.value })).employee }; toast('Caption saved'); } catch (ex) { toast(ex.message); }
      });
      const card = el('div', { class: 'shot' },
        el('img', { src: im.url, alt: im.caption || `${emp.name} portfolio photo`, loading: 'lazy' }),
        el('div', { class: 'cap' }, cap, el('button', {
          class: 'x', type: 'button', 'aria-label': 'Delete photo',
          onclick: async () => {
            if (!confirm('Delete this photo?')) return;
            card.classList.add('busy');
            try { emp = { ...emp, ...(await api({ action: 'deleteImage', imageId: im.id })).employee }; drawPortfolio(); } catch (ex) { card.classList.remove('busy'); toast(ex.message); }
          },
        }, '✕')));
      return card;
    }));
  }

  /* ---------- password ---------- */
  $('#pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#pwMsg'); m.className = 'msg'; m.textContent = 'Saving…';
    try {
      await api({ action: 'changePassword', currentPassword: $('#pwCur').value, newPassword: $('#pwNew').value });
      $('#pwCur').value = ''; $('#pwNew').value = ''; m.textContent = 'Password changed ✓';
    } catch (ex) { m.className = 'msg bad'; m.textContent = ex.message; }
  });

  if (token) start();
  else if (isAdmin) { $('#loginErr').textContent = 'Open this from the admin portal’s Team tab while you’re logged in.'; }
})();
