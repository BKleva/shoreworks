(function () {
  document.documentElement.classList.add('js');

  // mobile nav
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');
  function setNav(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  toggle.addEventListener('click', function () { setNav(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });

  // open / closed status + today's hours (shop time, America/New_York)
  var HOURS = [20, 20, 20, 20, 21, 21, 21]; // closing hour by weekday, Sun=0; opens at noon
  function shopNow() {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
    }).formatToParts(new Date());
    var get = function (t) { return parts.filter(function (p) { return p.type === t; })[0].value; };
    var day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { day: day, mins: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10) };
  }
  function fmt(h) { return (h > 12 ? h - 12 : h) + ' PM'; }
  try {
    var n = shopNow();
    var close = HOURS[n.day];
    var open = n.mins >= 12 * 60 && n.mins < close * 60;
    var status = document.getElementById('status');
    status.classList.add(open ? 'open' : 'closed');
    status.querySelector('span').textContent = open
      ? 'Open now · until ' + fmt(close)
      : (n.mins < 12 * 60 ? 'Opens today at 12 PM' : 'Closed · opens tomorrow at 12 PM');
    var today = document.querySelector('#hours li[data-day="' + n.day + '"]');
    if (today) today.classList.add('today');
  } catch (e) { /* leave defaults */ }

  // menu filter
  var chips = document.querySelectorAll('.chip');
  var cards = document.querySelectorAll('#pie-grid .card');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.dataset.filter;
      chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); });
      cards.forEach(function (c) { c.classList.toggle('hide', f !== 'all' && c.dataset.base !== f); });
    });
  });

  // lightbox
  var lb = document.getElementById('lightbox');
  var lbImg = lb.querySelector('img');
  var lbCap = lb.querySelector('p');
  document.querySelectorAll('button.card-photo').forEach(function (btn) {
    btn.addEventListener('click', function () {
      lbImg.src = btn.dataset.full;
      lbImg.alt = btn.querySelector('img').alt;
      lbCap.textContent = btn.dataset.cap;
      lb.showModal();
    });
  });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target.closest('.lb-close')) lb.close(); });

  // scroll reveal
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.15 });
    items.forEach(function (el, i) { el.style.transitionDelay = (i % 3) * 80 + 'ms'; io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }
})();
