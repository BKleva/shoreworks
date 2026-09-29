(function () {
  // year
  var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();

  // mobile nav
  var toggle = document.querySelector('.nav-toggle'), nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
    });
  }

  // booking form -> Netlify Forms (submissions are saved in the Netlify dashboard and can be emailed)
  var form = document.getElementById('bookingForm');
  if (!form) return;
  var msg = document.getElementById('formMsg');
  var date = document.getElementById('date');
  if (date) { date.min = new Date().toISOString().slice(0, 10); }

  function show(ok, title, text) {
    var card = document.getElementById('bookingCard');
    if (ok) {
      form.hidden = true;
      card.querySelectorAll('h3, .hint').forEach(function (el) { el.hidden = true; });
    }
    msg.className = 'form-msg show' + (ok ? '' : ' error');
    msg.innerHTML = '<div class="tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ok ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>' : '<path d="M6 6l12 12M18 6L6 18"/>') + '</svg></div><h3>' + title + '</h3><p>' + text + '</p>';
    msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  var svcGroup = document.getElementById('svcGroup');
  svcGroup.addEventListener('change', function () {
    svcGroup.querySelector('input[name="Services"]').setCustomValidity('');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.querySelector('input[name="Services"]:checked')) {
      var first = form.querySelector('input[name="Services"]');
      first.setCustomValidity('Please choose at least one service.');
      first.reportValidity();
      return;
    }
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Sending…';
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString()
    }).then(function (r) {
      if (!r.ok) throw new Error('bad status');
      show(true, 'Thanks — your request is in!', 'We\u2019ll call or text you shortly to set up a time to see your property.');
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Request My Free Estimate';
      show(false, 'Something went wrong', 'Please call or text us at <a href="tel:+16095411922">609.541.1922</a> and we\u2019ll get you booked.');
    });
  });
})();

// gallery: filters + lightbox
(function () {
  var grid = document.querySelector('.g-grid'); if (!grid) return;
  var items = [].slice.call(grid.querySelectorAll('.g-item'));
  var filters = [].slice.call(document.querySelectorAll('.g-filter'));
  var lb = document.getElementById('lightbox'), img = document.getElementById('lbImg'), cap = document.getElementById('lbCap');
  var current = 0;

  function visible() { return items.filter(function (i) { return !i.hidden; }); }

  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = btn.getAttribute('data-filter');
      filters.forEach(function (b) { var on = b === btn; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
      items.forEach(function (i) { i.hidden = !(f === 'all' || i.getAttribute('data-cat') === f); });
    });
  });

  function show(list, idx) {
    current = (idx + list.length) % list.length;
    var it = list[current], thumb = it.querySelector('img');
    img.src = it.getAttribute('data-full'); img.alt = thumb.alt; cap.textContent = thumb.alt;
  }
  items.forEach(function (it) {
    it.addEventListener('click', function () {
      var list = visible(); show(list, list.indexOf(it));
      if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
    });
  });
  lb.querySelector('.lb-close').addEventListener('click', function () { lb.close(); });
  lb.querySelector('.lb-prev').addEventListener('click', function () { var l = visible(); show(l, current - 1); });
  lb.querySelector('.lb-next').addEventListener('click', function () { var l = visible(); show(l, current + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', function (e) {
    var l = visible();
    if (e.key === 'ArrowLeft') show(l, current - 1);
    if (e.key === 'ArrowRight') show(l, current + 1);
  });
})();
