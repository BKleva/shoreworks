(function () {
  // mobile nav
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');
  function setNav(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  toggle.addEventListener('click', function () { setNav(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });

  // menu filter
  var chips = document.querySelectorAll('.chip');
  var pies = document.querySelectorAll('#pie-grid .pie');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.dataset.filter;
      chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); });
      pies.forEach(function (p) {
        p.classList.toggle('hide', f !== 'all' && p.dataset.base !== f && p.dataset.base !== 'all');
      });
    });
  });

  // lightbox
  var lb = document.getElementById('lightbox');
  var lbImg = lb.querySelector('img');
  var lbCap = lb.querySelector('p');
  document.querySelectorAll('button.pie-photo').forEach(function (btn) {
    btn.addEventListener('click', function () {
      lbImg.src = btn.dataset.full;
      lbImg.alt = btn.querySelector('img').alt;
      lbCap.textContent = btn.dataset.cap;
      lb.showModal();
    });
  });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target.closest('.lb-close')) lb.close(); });
})();
