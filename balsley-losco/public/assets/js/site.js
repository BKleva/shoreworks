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

  /* ---- map + list (Leaflet) ---- */
  var TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  function pinIcon(label) { return L.divIcon({ className: 'pmwrap', html: '<span class="pm">' + label + '</span>', iconSize: [0, 0] }); }
  function baseMap(el, view, zoom, wheel) {
    var m = L.map(el, { zoomControl: true, scrollWheelZoom: wheel }).setView(view, zoom);
    L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(m);
    return m;
  }
  $$('.ml-map.static').forEach(function (el) {
    if (!window.L) return;
    var p = el.dataset.pin.split(',').map(Number), m = baseMap(el, p, 14, false);
    L.marker(p, { icon: pinIcon(el.dataset.label) }).addTo(m);
  });

  $$('[data-maplist]').forEach(function (root) {
    var results = $('#results', root), cards = $$('.lcard', results), list = $('.ml-list', root), mapEl = $('.ml-map', root);
    var first = true, full = !!$('#f-q', root), sortEl = $('#sort', root), map = null, layer = null, programmatic = false, moveOpt = null;
    cards.forEach(function (c, i) { c.dataset.i = i; });
    var c0 = (root.dataset.center || '39.4,-74.55,10').split(',').map(Number);

    if (window.L && mapEl) {
      map = baseMap(mapEl, [c0[0], c0[1]], c0[2], true);
      layer = (L.markerClusterGroup ? L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 42, iconCreateFunction: function (cl) { return L.divIcon({ className: 'mcwrap', html: '<div class="mc">' + cl.getChildCount() + '</div>', iconSize: [38, 38] }); } }) : L.layerGroup()).addTo(map);
      cards.forEach(function (card) {
        var m = L.marker([+card.dataset.lat, +card.dataset.lng], { icon: pinIcon(card.dataset.label), riseOnHover: true });
        m.on('click', function () { setOn(card, true); list.scrollTo({ top: Math.max(0, card.offsetTop - 90), behavior: 'smooth' }); if (window.innerWidth <= 900) setView('list'); });
        card._m = m;
      });
      if (full) {
        moveOpt = document.createElement('label'); moveOpt.className = 'ml-moveopt';
        moveOpt.innerHTML = '<input type="checkbox" checked> Search as I move the map';
        mapEl.parentNode.appendChild(moveOpt);
        map.on('moveend', function () { if (!programmatic && $('input', moveOpt).checked) apply(true); });
        $('input', moveOpt).addEventListener('change', function () { apply(false); });
      }
    } else if (mapEl) { mapEl.classList.add('nomap'); mapEl.textContent = 'Map unavailable offline.'; }

    function pinEl(card) { var e = card._m && card._m.getElement(); return e && e.querySelector('.pm'); }
    function setOn(card, on) {
      cards.forEach(function (x) { if (x !== card || !on) { x.classList.remove('hl'); var e = pinEl(x); if (e) e.classList.remove('on'); if (x._m) x._m.setZIndexOffset(0); } });
      if (on) { card.classList.add('hl'); var pe = pinEl(card); if (pe) pe.classList.add('on'); if (card._m) card._m.setZIndexOffset(1000); }
    }
    cards.forEach(function (card) {
      card.addEventListener('mouseenter', function () { setOn(card, true); });
      card.addEventListener('mouseleave', function () { setOn(card, false); });
    });

    var val = function (id) { var e = $('#' + id, root); return e ? e.value : ''; };
    var chk = function (id) { var e = $('#' + id, root); return !!(e && e.checked); };
    var num = function (v) { return parseInt(String(v || '').replace(/[^0-9]/g, ''), 10) || 0; };

    function apply(keepView) {
      var q = val('f-q').trim().toLowerCase(), min = num(val('f-min')), max = num(val('f-max')), beds = num(val('f-beds')), baths = num(val('f-baths')), type = val('f-type');
      var useBounds = !!(map && keepView === true && moveOpt && $('input', moveOpt).checked), b = useBounds ? map.getBounds() : null, shown = 0;
      cards.forEach(function (c) {
        var d = c.dataset, price = +d.price, ok = true;
        if (q && d.search.indexOf(q) < 0) ok = false;
        if (type && d.type !== type) ok = false;
        if (full && !type && d.type === 'Rental') ok = false;
        if (min && price < min) ok = false;
        if (max && price > max) ok = false;
        if (beds && +d.beds < beds) ok = false;
        if (baths && +d.baths < baths) ok = false;
        if (chk('f-wf') && d.wf !== '1') ok = false;
        if (chk('f-open') && d.open !== '1') ok = false;
        if (chk('f-new') && d.new !== '1') ok = false;
        if (b && !b.contains([+d.lat, +d.lng])) ok = false;
        c.style.display = ok ? '' : 'none'; if (ok) shown++;
      });
      var s = sortEl ? sortEl.value : 'rec';
      cards.slice().sort(function (a, c) {
        var A = a.dataset, B = c.dataset;
        if (s === 'plh') return A.price - B.price; if (s === 'phl') return B.price - A.price;
        if (s === 'beds') return B.beds - A.beds; if (s === 'sqft') return B.sqft - A.sqft;
        return A.i - B.i;
      }).forEach(function (c) { results.appendChild(c); });
      var cnt = $('#count', root); if (cnt) cnt.textContent = shown;
      var em = $('#empty', root); if (em) em.style.display = shown ? 'none' : 'block';
      if (map) {
        layer.clearLayers(); var pts = [];
        cards.forEach(function (c) { if (c.style.display !== 'none') { layer.addLayer(c._m); pts.push([+c.dataset.lat, +c.dataset.lng]); } });
        var skipFit = first && full && !location.search;
        first = false;
        if (keepView !== true && pts.length && !skipFit) { programmatic = true; map.fitBounds(pts, { padding: [70, 70], maxZoom: 14, animate: false }); setTimeout(function () { programmatic = false; }, 60); }
      }
    }

    function setView(v) {
      root.dataset.view = v;
      $$('[data-mlview]', root).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.mlview === v); });
      if (v === 'map' && map) setTimeout(function () { map.invalidateSize(); apply(false); }, 30);
    }
    $$('[data-mlview]', root).forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.mlview); }); });

    if (full) {
      var qs2 = new URLSearchParams(location.search), set = function (id, v) { var e = $('#' + id, root); if (e && v) e.value = v; };
      set('f-q', qs2.get('q') || (qs2.get('town') || '').replace(/-/g, ' ')); set('f-type', qs2.get('type')); set('f-min', qs2.get('min')); set('f-max', qs2.get('max')); set('f-beds', qs2.get('beds')); set('f-baths', qs2.get('baths'));
      ['wf', 'open', 'new'].forEach(function (k) { if (qs2.get(k) === '1') $('#f-' + k, root).checked = true; });
      $$('input,select', $('.ml-bar', root)).forEach(function (el) { el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', function () { apply(false); }); });
      var more = $('#f-more', root), pane = $('#ml-more', root);
      more.addEventListener('click', function () { pane.hidden = !pane.hidden; more.setAttribute('aria-expanded', !pane.hidden); });
      $('#f-reset', root).addEventListener('click', function () { $$('input,select', $('.ml-bar', root)).forEach(function (e) { if (e.type === 'checkbox') e.checked = false; else e.value = ''; }); apply(false); });
      $('#save-search', root).addEventListener('click', function () {
        var parts = [], q = val('f-q'); if (q) parts.push(q); if (val('f-type')) parts.push(val('f-type')); if (val('f-beds')) parts.push(val('f-beds') + '+ beds');
        if (val('f-min') || val('f-max')) parts.push((val('f-min') ? money(num(val('f-min'))) : '$0') + '–' + (val('f-max') ? money(num(val('f-max'))) : 'any'));
        if (chk('f-wf')) parts.push('Waterfront');
        var pq = new URLSearchParams();
        [['q', 'f-q'], ['type', 'f-type'], ['min', 'f-min'], ['max', 'f-max'], ['beds', 'f-beds'], ['baths', 'f-baths']].forEach(function (x) { if (val(x[1])) pq.set(x[0], val(x[1])); });
        ['wf', 'open', 'new'].forEach(function (k) { if (chk('f-' + k)) pq.set(k, '1'); });
        var s = store.get('bl_searches', []); s.push({ label: parts.join(' · ') || 'All homes', url: '/search/' + (pq.toString() ? '?' + pq.toString() : ''), d: new Date().toLocaleDateString() });
        store.set('bl_searches', s); toast('Search saved to your account');
      });
    }
    var bar = $('.ml-bar', root);
    function barH() { if (bar) root.style.setProperty('--barh', bar.offsetHeight + 'px'); if (map) map.invalidateSize(); }
    if (bar) { barH(); window.addEventListener('resize', barH); }
    if (sortEl) sortEl.addEventListener('change', function () { apply(false); });
    apply(false);
    if (map) setTimeout(function () { map.invalidateSize(); apply(false); }, 150);
  });

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
        var l = L[k]; return '<article class="card lcard"><div class="img"><img src="' + l.img + '" alt="" width="800" height="600" referrerpolicy="no-referrer"><button class="fav" data-fav="' + k + '" aria-pressed="true" aria-label="Remove ' + l.addr + '"><svg viewBox="0 0 24 24"><path d="M12 21s-8-4.9-9.5-10C1.400 7.500 3.800 4.500 7 4.500c2 0 3.700 1 5 2.800 1.300-1.800 3-2.800 5-2.800 3.200 0 5.600 3 4.500 6.500C20 16.100 12 21 12 21z"/></svg></button></div><div class="body"><div class="price">' + l.price + '</div><p class="addr">' + l.addr + '</p><p class="town">' + l.town + ', NJ</p><ul class="facts"><li><b>' + l.beds + '</b> bd</li><li><b>' + l.baths + '</b> ba</li><li><b>' + l.sqft.toLocaleString() + '</b> sf</li></ul></div><a class="cover" href="/listing/' + k + '/">View</a></article>';
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
