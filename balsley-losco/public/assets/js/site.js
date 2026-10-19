/* Balsley Losco — site behavior (progressive enhancement: pages are fully readable without JS) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var toastT;
  function toast(msg) {
    var t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }
  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };

  /* ---- mobile nav ---- */
  var burger = $('.burger'), nav = $('#nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', o);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  }

  /* ---- favorites ---- */
  function saved() { return store.get('bl_saved', []); }
  function paintFavs() {
    var s = saved();
    $$('[data-fav]').forEach(function (b) { b.setAttribute('aria-pressed', s.indexOf(b.dataset.fav) > -1); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fav]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var s = saved(), i = s.indexOf(b.dataset.fav);
    if (i > -1) { s.splice(i, 1); toast('Removed from saved homes'); } else { s.push(b.dataset.fav); toast('Saved! Find it in your account'); }
    store.set('bl_saved', s); paintFavs();
  });
  paintFavs();

  /* ---- hero listing rotator ---- */
  var rot = $('[data-rotator]');
  if (rot) {
    var sl = $$('.slide', rot), fl = $$('.float', rot), dt = $$('.dots button', rot), cur = 0, timer;
    function show(n) {
      cur = (n + sl.length) % sl.length;
      sl.forEach(function (e, i) { e.classList.toggle('on', i === cur); });
      fl.forEach(function (e, i) { e.classList.toggle('on', i === cur); });
      dt.forEach(function (e, i) { if (i === cur) e.setAttribute('aria-current', 'true'); else e.removeAttribute('aria-current'); });
    }
    function start() { stop(); if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(function () { show(cur + 1); }, 4500); }
    function stop() { clearInterval(timer); }
    dt.forEach(function (b, i) { b.addEventListener('click', function () { show(i); start(); }); });
    rot.addEventListener('mouseenter', stop); rot.addEventListener('mouseleave', start);
    rot.addEventListener('focusin', stop); rot.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    start();
  }

  /* ---- forms (Netlify Forms via AJAX) ---- */
  $$('form[data-ajax]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('button[type=submit]', f), msg = $('.ok-msg', f), orig = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(f)).toString() })
        .then(function (r) {
          if (!r.ok) throw new Error('bad');
          f.reset(); msg.style.display = 'block'; msg.textContent = 'Thank you! A Balsley Losco agent will be in touch shortly.'; btn.style.display = 'none';
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = orig;
          msg.style.display = 'block'; msg.style.background = '#fdecea'; msg.style.borderColor = '#f3b4ad'; msg.style.color = '#8a1f17';
          msg.textContent = 'Sorry, that didn\'t send. Please call us at (609) 646-3207.';
        });
    });
  });
  var qs = new URLSearchParams(location.search);
  var topic = qs.get('topic'); if (topic && $('#ct')) $('#ct').value = topic;
  var townq = qs.get('town'); if (townq && $('#cm')) $('#cm').value = 'I\'m interested in homes in ' + townq + '.';

  /* ---- search page ---- */
  var results = $('#results');
  if (results && $('#f-q')) {
    var cards = $$('.lcard', results), F = {};
    ['q', 'town', 'type', 'min', 'max', 'beds', 'baths', 'wf', 'open', 'new'].forEach(function (k) { F[k] = $('#f-' + k); });
    var sort = $('#sort');
    var num = function (v) { return parseInt(String(v || '').replace(/[^0-9]/g, ''), 10) || 0; };
    var townNames = {}; $$('#f-town option').forEach(function (o) { if (o.value) townNames[o.textContent.toLowerCase()] = o.value; });
    // prefill from URL
    if (qs.get('q')) { var qv = qs.get('q'); var tk = townNames[qv.toLowerCase()]; if (tk) F.town.value = tk; else F.q.value = qv; }
    if (qs.get('type')) F.type.value = qs.get('type');
    if (qs.get('max')) F.max.value = qs.get('max');
    if (qs.get('min')) F.min.value = qs.get('min');
    if (qs.get('beds')) F.beds.value = qs.get('beds');
    if (qs.get('town')) F.town.value = qs.get('town');
    if (qs.get('baths')) F.baths.value = qs.get('baths');
    ['wf', 'open', 'new'].forEach(function (k) { if (qs.get(k) === '1') F[k].checked = true; });
    function apply() {
      var q = F.q.value.trim().toLowerCase(), min = num(F.min.value), max = num(F.max.value), beds = num(F.beds.value), baths = num(F.baths.value), shown = 0;
      var wantRental = F.type.value === 'Rental';
      cards.forEach(function (c) {
        var d = c.dataset, price = +d.price, ok = true;
        if (q && d.search.indexOf(q) < 0) ok = false;
        if (F.town.value && d.town !== F.town.value) ok = false;
        if (F.type.value && d.type !== F.type.value) ok = false;
        if (!F.type.value && d.type === 'Rental') ok = false;   // "all types" means for-sale only
        if (min && price < min) ok = false;
        if (max && price > max) ok = false;
        if (beds && +d.beds < beds) ok = false;
        if (baths && +d.baths < baths) ok = false;
        if (F.wf.checked && d.wf !== '1') ok = false;
        if (F.open.checked && d.open !== '1') ok = false;
        if (F.new.checked && d.new !== '1') ok = false;
        c.style.display = ok ? '' : 'none'; if (ok) shown++;
      });
      var s = sort.value, vis = cards.slice().sort(function (a, b) {
        var A = a.dataset, B = b.dataset;
        if (s === 'plh') return A.price - B.price; if (s === 'phl') return B.price - A.price;
        if (s === 'beds') return B.beds - A.beds; if (s === 'sqft') return B.sqft - A.sqft;
        return (B.new - A.new) || 0;
      });
      vis.forEach(function (c) { results.appendChild(c); });
      $('#count').textContent = shown; $('#empty').style.display = shown ? 'none' : 'block';
    }
    Object.keys(F).forEach(function (k) { var el = F[k]; el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', apply); });
    sort.addEventListener('change', apply);
    $('#f-reset').addEventListener('click', function () { Object.keys(F).forEach(function (k) { if (F[k].type === 'checkbox') F[k].checked = false; else F[k].value = ''; }); apply(); });
    $$('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-view]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        var map = b.dataset.view === 'map'; $('#mapph').classList.toggle('show', map); results.style.display = map ? 'none' : '';
      });
    });
    $('#save-search').addEventListener('click', function () {
      var parts = [];
      if (F.town.value) parts.push(F.town.options[F.town.selectedIndex].text); if (F.q.value) parts.push('“' + F.q.value + '”');
      if (F.type.value) parts.push(F.type.value); if (F.beds.value) parts.push(F.beds.value + '+ bd');
      if (F.min.value || F.max.value) parts.push((F.min.value ? money(num(F.min.value)) : '$0') + '–' + (F.max.value ? money(num(F.max.value)) : 'any'));
      if (F.wf.checked) parts.push('Waterfront');
      var s = store.get('bl_searches', []); var pq = new URLSearchParams();
      [['q', F.q], ['town', F.town], ['type', F.type], ['min', F.min], ['max', F.max], ['beds', F.beds], ['baths', F.baths]].forEach(function (x) { if (x[1].value) pq.set(x[0], x[1].value); });
      ['wf', 'open', 'new'].forEach(function (k) { if (F[k].checked) pq.set(k, '1'); });
      s.push({ label: parts.join(' · ') || 'All homes', url: '/search/' + (pq.toString() ? '?' + pq.toString() : ''), d: new Date().toLocaleDateString() });
      store.set('bl_searches', s); toast('Search saved to your account');
    });
    apply();
  }

  /* ---- agents directory ---- */
  var grid = $('#agrid');
  if (grid) {
    var ac = $$('.acard', grid), letter = '';
    var aq = $('#aq'), ar = $('#ar'), al = $('#al');
    function aapply() {
      var q = aq.value.trim().toLowerCase(), r = ar.value, l = al.value.toLowerCase(), n = 0;
      ac.forEach(function (c) {
        var d = c.dataset, ok = (!q || d.name.indexOf(q) > -1 || d.lang.indexOf(q) > -1) && (!r || d.role.indexOf(r) > -1) && (!l || d.lang.indexOf(l) > -1) && (!letter || d.name.charAt(0).toUpperCase() === letter);
        c.style.display = ok ? '' : 'none'; if (ok) n++;
      });
      $('#acount').textContent = n + ' agent' + (n === 1 ? '' : 's'); $('#aempty').style.display = n ? 'none' : 'block';
    }
    [aq, ar, al].forEach(function (el) { el.addEventListener('input', aapply); });
    $$('[data-letter]').forEach(function (b) {
      b.addEventListener('click', function () { letter = letter === b.dataset.letter ? '' : b.dataset.letter; $$('[data-letter]').forEach(function (x) { x.style.background = x === b && letter ? 'var(--navy)' : ''; x.style.color = x === b && letter ? '#fff' : ''; }); aapply(); });
    });
  }

  /* ---- mortgage calculator ---- */
  var calc = $('[data-calc]');
  if (calc) {
    var g = function (id) { return +($('#' + id).value) || 0; };
    var p0 = qs.get('price'); if (p0) $('#c-price').value = Math.min(3000000, Math.max(100000, +p0));
    function run() {
      var price = g('c-price'), dpPct = g('c-down'), rate = g('c-rate') / 100 / 12, n = g('c-term') * 12;
      var dp = price * dpPct / 100, loan = price - dp;
      var pi = rate ? loan * rate / (1 - Math.pow(1 + rate, -n)) : loan / n;
      var tax = g('c-tax') / 12, ins = (g('c-ins') + g('c-flood')) / 12, hoa = g('c-hoa'), total = pi + tax + ins + hoa;
      $('#o-price').textContent = money(price); $('#o-down').textContent = dpPct + '% (' + money(dp) + ')';
      $('#o-total').textContent = money(total); $('#o-pi').textContent = money(pi); $('#o-t').textContent = money(tax); $('#o-i').textContent = money(ins); $('#o-h').textContent = money(hoa);
      $('#o-loan').textContent = money(loan); $('#o-dp').textContent = money(dp);
      var cols = ['#f2b632', '#c8202f', '#7d1019', '#d9c7a8'], vals = [pi, tax, ins, hoa];
      $('#o-bar').innerHTML = vals.map(function (v, i) { return '<i style="width:' + (total ? v / total * 100 : 0) + '%;background:' + cols[i] + '"></i>'; }).join('');
    }
    $$('input,select', calc).forEach(function (el) { el.addEventListener('input', run); }); run();
  }

  /* ---- account ---- */
  var auth = $('#auth');
  if (auth) {
    var dash = $('#dash');
    function render() {
      var u = store.get('bl_user', null);
      auth.style.display = u ? 'none' : ''; dash.style.display = u ? '' : 'none';
      if (!u) return;
      $('#hello').textContent = 'Hi, ' + u.name.split(' ')[0];
      var s = saved(), L = window.BL_LISTINGS || {}, g2 = $('#saved-grid');
      g2.innerHTML = s.filter(function (k) { return L[k]; }).map(function (k) {
        var l = L[k]; return '<article class="card lcard"><div class="img"><img src="/assets/img/l-' + k + '.svg" alt="" width="800" height="600"><button class="fav" data-fav="' + k + '" aria-pressed="true" aria-label="Remove ' + l.addr + '"><svg viewBox="0 0 24 24"><path d="M12 21s-8-4.9-9.5-10C1.400 7.500 3.800 4.500 7 4.500c2 0 3.700 1 5 2.800 1.300-1.800 3-2.800 5-2.800 3.200 0 5.600 3 4.500 6.500C20 16.100 12 21 12 21z"/></svg></button></div><div class="body"><div class="price">' + l.price + '</div><p class="addr">' + l.addr + '</p><p class="town">' + l.town + ', NJ</p><ul class="facts"><li><b>' + l.beds + '</b> bd</li><li><b>' + l.baths + '</b> ba</li><li><b>' + l.sqft.toLocaleString() + '</b> sf</li></ul></div><a class="cover" href="/listing/' + k + '/">View</a></article>';
      }).join('');
      $('#saved-empty').style.display = s.length ? 'none' : 'block';
      var ss = store.get('bl_searches', []);
      $('#searches').innerHTML = ss.map(function (x, i) { return '<div class="panel" style="margin-bottom:12px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><b>' + x.label + '</b><br><span class="muted">Saved ' + x.d + '</span></div><div><a class="btn sm" href="' + x.url + '">Run search</a> <button class="btn sm ghost" data-del="' + i + '" type="button">Delete</button></div></div>'; }).join('');
      $('#searches-empty').style.display = ss.length ? 'none' : 'block';
      var al = store.get('bl_alerts', { 'al-new': true, 'al-price': true }); ['al-new', 'al-price', 'al-open', 'al-mkt'].forEach(function (id) { $('#' + id).checked = !!al[id]; });
    }
    $('#auth-form').addEventListener('submit', function (e) { e.preventDefault(); store.set('bl_user', { name: $('#au-n').value.trim() || 'Friend', email: $('#au-e').value.trim() }); render(); });
    $('#signout').addEventListener('click', function () { try { localStorage.removeItem('bl_user'); } catch (e) {} render(); });
    $$('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { $$('[data-tab]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); $$('.tab', dash).forEach(function (t) { t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab); }); });
    });
    document.addEventListener('click', function (e) {
      var d = e.target.closest('[data-del]'); if (d) { var ss = store.get('bl_searches', []); ss.splice(+d.dataset.del, 1); store.set('bl_searches', ss); render(); }
      if (e.target.closest('#saved-grid [data-fav]')) setTimeout(render, 0);
    });
    $('#al-save').addEventListener('click', function () { var a = {}; ['al-new', 'al-price', 'al-open', 'al-mkt'].forEach(function (id) { a[id] = $('#' + id).checked; }); store.set('bl_alerts', a); toast('Alert preferences saved'); });
    render();
  }

  /* ---- agent portal (demo) ---- */
  var pl = $('#plogin');
  if (pl) {
    var pd = $('#pdash');
    function ptoggle(on) { pl.style.display = on ? 'none' : ''; pd.style.display = on ? '' : 'none'; }
    ptoggle(store.get('bl_agent', false));
    $('#plogin-form').addEventListener('submit', function (e) { e.preventDefault(); store.set('bl_agent', true); ptoggle(true); });
    $('#pout').addEventListener('click', function () { store.set('bl_agent', false); ptoggle(false); });
    $$('[data-t]', pd).forEach(function (b) {
      b.addEventListener('click', function () { $$('[data-t]', pd).forEach(function (x) { x.removeAttribute('aria-current'); }); b.setAttribute('aria-current', 'true'); $$('.tab', pd).forEach(function (t) { t.classList.toggle('on', t.id === 't-' + b.dataset.t); }); });
    });
  }
})();
