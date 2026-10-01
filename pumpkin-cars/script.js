(function () {
  'use strict';

  /* Mobile nav */
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('site-nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    });
  }

  /* Open / closed status, computed in showroom time (America/New_York) */
  // Tue-Fri 9:00-18:30, Sat 9:00-15:00, closed Sun & Mon
  var HOURS = { 2: [9, 18.5], 3: [9, 18.5], 4: [9, 18.5], 5: [9, 18.5], 6: [9, 15] };
  function nowInNJ() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
      }).formatToParts(new Date());
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { day: days[map.weekday], t: (parseInt(map.hour, 10) % 24) + parseInt(map.minute, 10) / 60 };
    } catch (e) {
      var d = new Date();
      return { day: d.getDay(), t: d.getHours() + d.getMinutes() / 60 };
    }
  }
  var now = nowInNJ();
  var h = HOURS[now.day];
  var isOpen = !!h && now.t >= h[0] && now.t < h[1];
  document.querySelectorAll('[data-open-status]').forEach(function (el) {
    el.innerHTML = '<span class="dot' + (isOpen ? '' : ' closed') + '"></span>' +
      (isOpen ? 'Showroom open now' : 'Showroom closed right now');
  });
  var todayRow = document.querySelector('.hours tr[data-day="' + now.day + '"]');
  if (todayRow) todayRow.classList.add('today');

  /* Duplicate ticker content for a seamless loop */
  var track = document.querySelector('.ticker-track');
  if (track) track.innerHTML += track.innerHTML;

  /* Footer year */
  document.querySelectorAll('[data-current-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* Vehicle gallery */
  var main = document.getElementById('gallery-main');
  var thumbs = document.querySelectorAll('.thumbs button');
  if (main && thumbs.length) {
    thumbs.forEach(function (t) {
      t.addEventListener('click', function () {
        main.src = t.getAttribute('data-full');
        thumbs.forEach(function (o) { o.removeAttribute('aria-current'); });
        t.setAttribute('aria-current', 'true');
      });
    });
  }

  /* Inventory filtering + sorting */
  var grid = document.getElementById('inv-grid');
  if (grid) {
    var cards = Array.prototype.slice.call(grid.children);
    cards.forEach(function (c, i) { c._i = i; });
    var f = {
      q: document.getElementById('f-q'), make: document.getElementById('f-make'),
      body: document.getElementById('f-body'), max: document.getElementById('f-max'),
      miles: document.getElementById('f-miles'), sort: document.getElementById('f-sort')
    };
    var count = document.getElementById('inv-count');
    var empty = document.getElementById('inv-empty');

    var params = new URLSearchParams(location.search);
    ['make', 'body', 'max', 'q'].forEach(function (k) {
      if (params.get(k) && f[k]) f[k].value = params.get(k);
    });

    function apply() {
      var q = f.q.value.trim().toLowerCase();
      var make = f.make.value, body = f.body.value;
      var max = parseInt(f.max.value, 10) || Infinity;
      var miles = parseInt(f.miles.value, 10) || Infinity;
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (!make || c.dataset.make === make) &&
          (!body || c.dataset.body === body) &&
          (+c.dataset.price <= max) && (+c.dataset.miles <= miles) &&
          (!q || c.dataset.search.indexOf(q) > -1);
        c.hidden = !ok;
        if (ok) shown++;
      });
      var s = f.sort.value;
      var sorted = cards.slice().sort(function (a, b) {
        if (s === 'price-asc') return a.dataset.price - b.dataset.price;
        if (s === 'price-desc') return b.dataset.price - a.dataset.price;
        if (s === 'miles') return a.dataset.miles - b.dataset.miles;
        if (s === 'year') return (b.dataset.year - a.dataset.year) || (a.dataset.price - b.dataset.price);
        return a._i - b._i;
      });
      sorted.forEach(function (c) { grid.appendChild(c); });
      count.textContent = shown + (shown === 1 ? ' vehicle' : ' vehicles');
      empty.style.display = shown ? 'none' : 'block';
    }
    Object.keys(f).forEach(function (k) {
      f[k].addEventListener(k === 'q' ? 'input' : 'change', apply);
    });
    var reset = document.getElementById('f-reset');
    if (reset) reset.addEventListener('click', function (e) {
      e.preventDefault();
      Object.keys(f).forEach(function (k) { f[k].value = k === 'sort' ? 'featured' : ''; });
      apply();
    });
    apply();
  }
})();

/* Inventory: collapsible filters on phones */
(function () {
  var t = document.querySelector('.filter-toggle');
  var panel = document.getElementById('filters');
  if (!t || !panel) return;
  t.addEventListener('click', function () {
    var open = panel.classList.toggle('open');
    t.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  var badge = document.getElementById('f-active');
  function update() {
    var n = 0;
    panel.querySelectorAll('select, input').forEach(function (el) {
      if (el.id !== 'f-sort' && el.value) n++;
    });
    if (badge) badge.textContent = n ? '(' + n + ')' : '';
  }
  panel.addEventListener('input', update);
  panel.addEventListener('change', update);
  update();
})();
