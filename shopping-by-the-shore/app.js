/* Shopping by the Shore LLC — interactions + booking wizard */
(() => {
'use strict';

/* ------------------------------------------------------------------ *
 *  CONFIG — easy things to change
 * ------------------------------------------------------------------ */
const FEE_RATE = 0.23;          // 23% of groceries …
const FEE_MIN = 50;             // … with a $50 minimum
const CLOSED_DAYS = [5];        // 0=Sun … 5=Fri (Celeste is off Fridays)
const DRAFT_KEY = 'sbts-draft-v1';

const SERVICES = [
  { id:'grocery',  kind:'shop', emoji:'🛒', color:'#e6dcf8', title:'Grocery shopping & fridge stocking', blurb:'Stocked, organized, and ready for you.' },
  { id:'personal', kind:'shop', emoji:'🛍️', color:'#ffe3dd', title:'Personal shopping & errands',        blurb:'Pharmacy, pet store, gifts — any store, several stops in one trip.' },
  { id:'home',     kind:'care', emoji:'🏠', color:'#d8f1f7', title:'Home & vacation check-ins',          blurb:"Peace of mind while you're away.", noun:'homes' },
  { id:'pets',     kind:'care', emoji:'🐾', color:'#fff0c9', title:'Pet sitting & vacation check-ins',   blurb:'Loving care for your pets and home.', noun:'pets' },
  { id:'plants',   kind:'care', emoji:'🪴', color:'#dcf3e0', title:'Flower & plant watering',            blurb:'Keep your plants happy and healthy.', noun:'plants' },
];
const STORES = ['ACME','Aldi',"Casel's Marketplace",'CVS','Lidl','PetSmart','Randalls','Rite Aid','ShopRite','Target','Tilton Market'];
const QUICK = ['Milk','Eggs','Bread','Bananas','Chicken','Coffee','Paper towels','Pasta','Ice cream','Apples'];
const SUBS = ['Text me first','Pick a similar item','Skip it'];
const FREQ = ['Once a day','Every other day','A few times a week','Just once','Not sure — let’s chat'];
const WINDOWS = [['Morning','🌅'],['Midday','☀️'],['Afternoon','🌤️'],['Evening','🌙'],['I’m flexible','🙌']];
const CONTACT = ['Call','Text','Email'];
const TOWNS = {
  'Atlantic County':['Absecon','Atlantic City','Brigantine','Buena','Egg Harbor City','Egg Harbor Township','Estell Manor','Folsom','Galloway','Hammonton','Linwood','Longport','Margate','Mullica','Northfield','Pleasantville','Port Republic','Somers Point','Ventnor','Weymouth'],
  'Cape May County':['Avalon','Cape May','Cape May Point','Dennis Township','Lower Township','Middle Township','North Wildwood','Ocean City','Sea Isle City','Stone Harbor','Upper Township','West Cape May','West Wildwood','Wildwood','Wildwood Crest','Woodbine'],
};
const EMOJI = [
  [/milk/,'🥛'],[/egg/,'🥚'],[/bread|bagel|roll/,'🍞'],[/banana/,'🍌'],[/chicken|turkey/,'🍗'],[/coffee/,'☕'],[/paper towel|toilet|tissue/,'🧻'],
  [/pasta|spaghetti|noodle/,'🍝'],[/ice cream/,'🍦'],[/apple/,'🍎'],[/cheese/,'🧀'],[/butter/,'🧈'],[/water/,'💧'],[/wine/,'🍷'],[/avocado/,'🥑'],
  [/tomato/,'🍅'],[/lettuce|salad|spinach|kale/,'🥬'],[/cereal|oat/,'🥣'],[/juice/,'🧃'],[/fish|salmon|tuna/,'🐟'],[/shrimp/,'🦐'],[/steak|beef|burger/,'🥩'],
  [/pizza/,'🍕'],[/potato|chip/,'🥔'],[/carrot/,'🥕'],[/lemon|lime/,'🍋'],[/grape/,'🍇'],[/strawberr|berr/,'🍓'],[/orange/,'🍊'],[/cookie|cake|dessert/,'🍪'],
  [/dog|cat|pet/,'🐾'],[/flower/,'💐'],[/soap|shampoo|detergent|clean/,'🧼'],[/vitamin|medicine|prescription/,'💊'],
];
const emojiFor = n => { const s = n.toLowerCase(); for (const [re, e] of EMOJI) if (re.test(s)) return e; return '🛍️'; };

/* ------------------------------------------------------------------ *
 *  tiny helpers
 * ------------------------------------------------------------------ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const money = n => '$' + n.toFixed(2);
const money0 = n => '$' + Math.round(n).toLocaleString();
const feeFor = g => Math.max(FEE_MIN, Math.round(g * FEE_RATE * 100) / 100);
const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = d => d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
const svc = id => SERVICES.find(s => s.id === id);
const safe = fn => { try { return fn(); } catch (e) { return null; } };

let toastTimer;
function toast(msg, ms = 2800) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/* ------------------------------------------------------------------ *
 *  confetti
 * ------------------------------------------------------------------ */
function confetti(n = 160) {
  if (reduced) return;
  const c = $('#confetti'), ctx = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const cols = ['#4b2a8a','#7b5bc4','#1d8fae','#9edbe9','#ff7a6b','#ffc857','#6bbf7a'];
  const ps = Array.from({ length: n }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .6,
    vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6,
    s: Math.random() * 8 + 5, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
    c: cols[Math.random() * cols.length | 0], round: Math.random() > .6,
  }));
  const t0 = performance.now();
  (function frame(t) {
    const age = t - t0;
    ctx.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => {
      p.vy += .35; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, 1 - age / 3200);
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 7); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6);
      ctx.restore();
    });
    if (age < 3200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, c.width, c.height);
  })(t0);
}

/* ------------------------------------------------------------------ *
 *  page chrome: nav, reveal, counters, rotator, year
 * ------------------------------------------------------------------ */
const nav = $('#nav'), burger = $('#burger'), navLinks = $('#navLinks');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 10), { passive: true });
burger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  burger.setAttribute('aria-expanded', open);
});
navLinks.addEventListener('click', e => { if (e.target.closest('a')) { navLinks.classList.remove('open'); burger.setAttribute('aria-expanded', false); } });
$('#yr').textContent = new Date().getFullYear();

const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: .12 }) : null;
$$('.reveal').forEach(el => io ? io.observe(el) : el.classList.add('in'));

// count-up stats
const countIO = io && new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  countIO.unobserve(e.target);
  const el = e.target, to = parseFloat(el.dataset.count), dec = +el.dataset.decimals || 0;
  if (reduced) return;
  const t0 = performance.now();
  (function tick(t) {
    const p = Math.min(1, (t - t0) / 1400), v = to * (1 - Math.pow(1 - p, 3));
    el.textContent = dec ? v.toFixed(dec) : Math.round(v).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}), { threshold: .5 });
$$('[data-count]').forEach(el => countIO ? countIO.observe(el) : 0);

// rotating word
(() => {
  const r = $('#rotator'); if (!r || reduced) return;
  const words = JSON.parse(r.dataset.words); let i = 0;
  setInterval(() => {
    r.classList.add('out');
    setTimeout(() => { i = (i + 1) % words.length; r.textContent = words[i]; r.classList.remove('out'); }, 350);
  }, 2600);
})();

/* ------------------------------------------------------------------ *
 *  hero game: tap floating goodies to fill the basket
 * ------------------------------------------------------------------ */
(() => {
  const box = $('#floaters'), pill = $('#basketPill'), txt = $('#basketText'), be = $('#basketEmoji');
  const spots = [['🍎',4,10],['🥖',86,2],['🍋',46,-3],['🧀',-4,50],['🍇',94,44],['🥑',10,88],['🥛',44,96],['🍅',84,86],['🥕',66,12],['🌿',22,2]];
  let count = 0, total = 0;
  spots.forEach(([e, x, y], i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'floater'; b.textContent = e; b.setAttribute('aria-hidden', 'true'); b.tabIndex = -1;
    b.style.left = x + '%'; b.style.top = y + '%'; b.style.setProperty('--d', (5.5 + (i % 4)) + 's'); b.style.animationDelay = (-i * .7) + 's';
    b.addEventListener('click', () => {
      const from = b.getBoundingClientRect(), to = be.getBoundingClientRect();
      b.classList.add('gone');
      if (!reduced) {
        const f = document.createElement('div'); f.className = 'fly'; f.textContent = e;
        f.style.left = from.left + 'px'; f.style.top = from.top + 'px'; document.body.appendChild(f);
        f.animate([{ transform: 'translate(0,0) scale(1) rotate(0)' }, { transform: `translate(${to.left - from.left}px,${to.top - from.top}px) scale(.5) rotate(300deg)` }], { duration: 650, easing: 'cubic-bezier(.5,-.4,.7,1)' }).onfinish = () => { f.remove(); landed(); };
      } else landed();
      setTimeout(() => b.classList.remove('gone'), 4500);
    });
    box.appendChild(b);
  });
  function landed() {
    count++; total++;
    be.classList.remove('bump'); void be.offsetWidth; be.classList.add('bump');
    if (count >= 8) {
      confetti(120); txt.textContent = "Basket's full! Tap here to book 🎉"; count = 0;
    } else txt.textContent = `${count} in my basket… keep going!`;
  }
  pill.addEventListener('click', () => { $('#book').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); });
})();

/* ------------------------------------------------------------------ *
 *  pricing calculator (public section)
 * ------------------------------------------------------------------ */
(() => {
  const r = $('#calcRange');
  const run = () => {
    const g = +r.value, f = feeFor(g), t = g + f;
    $('#calcGroceries').textContent = money0(g);
    $('#calcG2').textContent = money(g); $('#calcFee').textContent = money(f); $('#calcTotal').textContent = money(t);
    $('#barG').style.width = (g / t * 100) + '%'; $('#barF').style.width = (f / t * 100) + '%';
    $('#calcNote').textContent = f === FEE_MIN
      ? `The $${FEE_MIN} minimum applies until groceries pass about $${Math.ceil(FEE_MIN / FEE_RATE)}.`
      : `That's ${Math.round(FEE_RATE * 100)}% of your groceries. Estimates only — Celeste confirms your final price.`;
  };
  r.addEventListener('input', run); run();
})();

/* ------------------------------------------------------------------ *
 *  booking state
 * ------------------------------------------------------------------ */
const fresh = () => ({
  step: 1, services: [], stores: [], items: [], sub: SUBS[0], budget: 150,
  cCount: 1, freq: FREQ[0], start: null, end: null, win: null, contact: 'Text', listByText: false,
  tip: { pct: 0, custom: '' },
});
let S = fresh();
const DRAFT_FIELDS = ['services','stores','items','sub','budget','cCount','freq','start','end','win','contact','listByText'];
function saveDraft() {
  safe(() => { const o = {}; DRAFT_FIELDS.forEach(k => o[k] = S[k]); localStorage.setItem(DRAFT_KEY, JSON.stringify(o)); });
}
function loadDraft() {
  const o = safe(() => JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'));
  if (!o || typeof o !== 'object') return;
  DRAFT_FIELDS.forEach(k => {
    if (!(k in o)) return;
    if (['start', 'end', 'win'].includes(k)) { if (o[k] === null || typeof o[k] === 'string') S[k] = o[k]; }
    else if (typeof o[k] === typeof S[k]) S[k] = o[k];
  });
  // drop anything stale (e.g. dates now in the past)
  if (S.start && fromKey(S.start) <= today()) { S.start = S.end = null; }
  S.services = S.services.filter(id => svc(id));
  S.items = S.items.filter(i => i && typeof i.name === 'string').slice(0, 100);
}
function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
const hasShop = () => S.services.some(id => svc(id).kind === 'shop');
const careSel = () => S.services.map(svc).filter(s => s.kind === 'care');
const itemCount = () => S.items.reduce((n, i) => n + i.qty, 0);

/* ------------------------------------------------------------------ *
 *  service cards (public + picker)
 * ------------------------------------------------------------------ */
function cardHTML(s, pick) {
  return `<button type="button" class="card" data-id="${s.id}" style="--c:${s.color}"${pick ? ' aria-pressed="false"' : ''}>
    <span class="tick" aria-hidden="true">✓</span><span class="ico" aria-hidden="true">${s.emoji}</span>
    <h3>${s.title}</h3><p>${s.blurb}</p><span class="cta">Book this →</span></button>`;
}
$('#serviceCards').innerHTML = SERVICES.map(s => cardHTML(s, false)).join('');
$('#serviceCardsPick').innerHTML = SERVICES.map(s => cardHTML(s, true)).join('');

$('#serviceCards').addEventListener('click', e => {
  const c = e.target.closest('.card'); if (!c) return;
  const id = c.dataset.id;
  if (!S.services.includes(id)) S.services.push(id);
  syncAll(); goStep(1, true);
  toast(`${svc(id).emoji} ${svc(id).title} — added! Pick more or hit Next.`);
});
$('#serviceCardsPick').addEventListener('click', e => {
  const c = e.target.closest('.card'); if (!c) return;
  const id = c.dataset.id;
  S.services = S.services.includes(id) ? S.services.filter(x => x !== id) : [...S.services, id];
  syncAll();
});

/* ------------------------------------------------------------------ *
 *  generic chip builders
 * ------------------------------------------------------------------ */
function singleChips(container, opts, get, set, labelOf = o => o) {
  container.innerHTML = '';
  opts.forEach(o => {
    const v = Array.isArray(o) ? o[0] : o, b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.setAttribute('role', 'radio'); b.dataset.v = v;
    b.textContent = Array.isArray(o) ? `${o[1]} ${v}` : labelOf(v);
    b.addEventListener('click', () => { set(v); paint(); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); saveDraft(); });
    container.appendChild(b);
  });
  const paint = () => $$('.chip', container).forEach(b => b.setAttribute('aria-checked', b.dataset.v === get()));
  paint();
  return paint;
}
const paintSub = singleChips($('#subChips'), SUBS, () => S.sub, v => S.sub = v);
const paintFreq = singleChips($('#freqChips'), FREQ, () => S.freq, v => S.freq = v);
const paintWin = singleChips($('#winChips'), WINDOWS, () => S.win, v => S.win = v);
const paintContact = singleChips($('#contactChips'), CONTACT, () => S.contact, v => S.contact = v);

// stores — rendered in two places, kept in sync
function buildStoreChips(container, isPublic) {
  container.innerHTML = '';
  STORES.forEach(name => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.store = name; b.textContent = name; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      const on = !S.stores.includes(name);
      S.stores = on ? [...S.stores, name] : S.stores.filter(x => x !== name);
      $$(`[data-store="${CSS.escape(name)}"]`).forEach(x => { x.setAttribute('aria-pressed', on); x.classList.remove('pop'); void x.offsetWidth; x.classList.add('pop'); });
      if (isPublic && on) toast(`🛒 ${name} added — finish your order in “Build your order”.`);
      updateMini(); saveDraft();
    });
    container.appendChild(b);
  });
}
buildStoreChips($('#storeChipsPublic'), true);
buildStoreChips($('#storeChipsWizard'), false);
const paintStores = () => $$('[data-store]').forEach(b => b.setAttribute('aria-pressed', S.stores.includes(b.dataset.store)));

// towns
(() => {
  const sel = $('#fTown');
  Object.entries(TOWNS).forEach(([g, list]) => {
    const og = document.createElement('optgroup'); og.label = g;
    list.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; og.appendChild(o); });
    sel.appendChild(og);
  });
  const other = document.createElement('option'); other.value = 'Somewhere else (ask Celeste)'; other.textContent = 'Somewhere else — ask Celeste'; sel.appendChild(other);
})();

/* ------------------------------------------------------------------ *
 *  shopping list / cart
 * ------------------------------------------------------------------ */
$('#quickItems').innerHTML = QUICK.map(q => `<button type="button" data-q="${q}">${emojiFor(q)} ${q}</button>`).join('');
const cartList = $('#cartList');
let lastAdded = null;

function addItems(text) {
  const names = text.split(/[\n;,]+/).map(s => s.trim().slice(0, 80)).filter(Boolean);
  names.forEach(n => {
    if (S.items.length >= 100) return;
    const ex = S.items.find(i => i.name.toLowerCase() === n.toLowerCase());
    if (ex) { ex.qty = Math.min(99, ex.qty + 1); lastAdded = ex.name; }
    else { S.items.push({ name: n, qty: 1 }); lastAdded = n; }
  });
  renderCart(); updateMini(); saveDraft();
}
function renderCart() {
  cartList.innerHTML = '';
  S.items.forEach((it, idx) => {
    const li = document.createElement('li');
    if (it.name === lastAdded) li.classList.add('new');
    const em = document.createElement('span'); em.className = 'em'; em.textContent = emojiFor(it.name);
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = it.name;
    const q = document.createElement('span'); q.className = 'qty';
    const minus = Object.assign(document.createElement('button'), { type:'button', textContent:'−', ariaLabel:`Fewer ${it.name}` });
    const out = Object.assign(document.createElement('output'), { textContent: it.qty });
    const plus = Object.assign(document.createElement('button'), { type:'button', textContent:'+', ariaLabel:`More ${it.name}` });
    minus.addEventListener('click', () => { if (it.qty > 1) { it.qty--; out.textContent = it.qty; updateMini(); saveDraft(); updateCartCount(); } else removeAt(idx, li); });
    plus.addEventListener('click', () => { it.qty = Math.min(99, it.qty + 1); out.textContent = it.qty; updateMini(); saveDraft(); updateCartCount(); });
    q.append(minus, out, plus);
    const rm = Object.assign(document.createElement('button'), { type:'button', className:'rm', textContent:'✕', ariaLabel:`Remove ${it.name}` });
    rm.addEventListener('click', () => removeAt(idx, li));
    li.append(em, nm, q, rm); cartList.appendChild(li);
  });
  lastAdded = null;
  $('#cartEmpty').hidden = S.items.length > 0;
  updateCartCount();
}
function removeAt(idx, li) {
  li.classList.add('out');
  setTimeout(() => { S.items.splice(idx, 1); renderCart(); updateMini(); saveDraft(); }, reduced ? 0 : 230);
}
function updateCartCount() { const n = itemCount(); $('#cartCount').textContent = `${n} item${n === 1 ? '' : 's'}`; }

const itemInput = $('#itemInput');
const submitItem = () => { if (itemInput.value.trim()) { addItems(itemInput.value); itemInput.value = ''; } itemInput.focus(); };
$('#itemAdd').addEventListener('click', submitItem);
itemInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitItem(); } });
itemInput.addEventListener('paste', e => {
  const t = (e.clipboardData || window.clipboardData).getData('text');
  if (/[\n;]/.test(t)) { e.preventDefault(); addItems(t); toast('📝 List added to your cart!'); }
});
$('#quickItems').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) addItems(b.dataset.q); });
$('#listByText').addEventListener('change', e => { S.listByText = e.target.checked; saveDraft(); });

// budget slider (wizard)
const budget = $('#budget');
function paintBudget() {
  const g = S.budget, f = feeFor(g);
  budget.value = g;
  $('#mBudget').textContent = money0(g); $('#mFee').textContent = money(f); $('#mTotal').textContent = money(g + f);
}
budget.addEventListener('input', () => { S.budget = +budget.value; paintBudget(); saveDraft(); });

// care stepper
const paintCare = () => { $('#cVal').textContent = S.cCount; };
$('#cMinus').addEventListener('click', () => { S.cCount = Math.max(1, S.cCount - 1); paintCare(); saveDraft(); });
$('#cPlus').addEventListener('click', () => { S.cCount = Math.min(50, S.cCount + 1); paintCare(); saveDraft(); });

/* ------------------------------------------------------------------ *
 *  calendar
 * ------------------------------------------------------------------ */
// open on the month of the first bookable day (tomorrow)
let view = (() => { const d = today(); d.setDate(d.getDate() + 1); d.setDate(1); return d; })();
const cal = $('#cal');
function renderCal() {
  const t = today(), min = new Date(t); min.setDate(min.getDate() + 1);
  const maxView = new Date(t.getFullYear(), t.getMonth() + 12, 1);
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = S.start && fromKey(S.start), end = S.end && fromKey(S.end);
  let h = `<div class="cal-head"><button type="button" data-nav="-1" aria-label="Previous month"${first <= new Date(t.getFullYear(), t.getMonth(), 1) ? ' disabled' : ''}>‹</button>
    <h4>${first.toLocaleDateString('en-US', { month:'long', year:'numeric' })}</h4>
    <button type="button" data-nav="1" aria-label="Next month"${first >= maxView ? ' disabled' : ''}>›</button></div><div class="cal-grid">`;
  ['S','M','T','W','T','F','S'].forEach(d => h += `<span class="dow">${d}</span>`);
  for (let i = 0; i < first.getDay(); i++) h += '<i></i>';
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const dt = new Date(first.getFullYear(), first.getMonth(), d);
    const dis = dt < min || CLOSED_DAYS.includes(dt.getDay());
    const cls = [];
    if (+dt === +t) cls.push('today');
    if (start && +dt === +start || end && +dt === +end) cls.push('sel');
    else if (start && end && dt > start && dt < end) cls.push('inrange');
    h += `<button type="button" data-d="${key(dt)}" class="${cls.join(' ')}"${dis ? ' disabled' : ''} aria-label="${dt.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}"${cls.includes('sel') ? ' aria-pressed="true"' : ''}>${d}</button>`;
  }
  cal.innerHTML = h + '</div>';
  const pick = $('#calPick');
  if (!start) pick.textContent = 'No date picked yet';
  else if (!end) pick.textContent = `📅 ${fmtDay(start)}`;
  else pick.textContent = `📅 ${fmtDay(start)} → ${fmtDay(end)} (${Math.round((end - start) / 864e5) + 1} days)`;
}
cal.addEventListener('click', e => {
  const nb = e.target.closest('[data-nav]');
  if (nb) { view = new Date(view.getFullYear(), view.getMonth() + +nb.dataset.nav, 1); renderCal(); return; }
  const b = e.target.closest('[data-d]'); if (!b || b.disabled) return;
  const k = b.dataset.d;
  if (!S.start || S.end) { S.start = k; S.end = null; }
  else if (k === S.start) { S.start = null; }
  else if (k < S.start) { S.start = k; }
  else S.end = k;
  saveDraft(); renderCal();
});

/* ------------------------------------------------------------------ *
 *  wizard flow
 * ------------------------------------------------------------------ */
const STEP_LABELS = ['What','Details','When','Where','Checkout'];
const TOTAL = 5;
const form = $('#booking'), wizard = $('#wizard'), err = $('#err');
const btnBack = $('#btnBack'), btnNext = $('#btnNext'), btnSend = $('#btnSend');
$('#track').innerHTML = STEP_LABELS.map((l, i) => `<li data-i="${i + 1}"><button type="button" tabindex="-1" aria-label="Step ${i + 1}: ${l}"><b>${i + 1}</b><span>${l}</span></button></li>`).join('');
$('#track').addEventListener('click', e => {
  const li = e.target.closest('li'); if (!li || !li.classList.contains('done')) return;
  goStep(+li.dataset.i, true);
});

function syncAll() {
  $$('#serviceCardsPick .card').forEach(c => c.setAttribute('aria-pressed', S.services.includes(c.dataset.id)));
  paintStores(); paintSub(); paintFreq(); paintWin(); paintContact(); paintBudget(); paintCare();
  $('#listByText').checked = S.listByText;
  renderCart(); updateMini(); saveDraft();
}

function goStep(n, scroll) {
  S.step = Math.max(1, Math.min(TOTAL, n));
  $$('.step', form).forEach(f => { f.hidden = +f.dataset.step !== S.step; });
  hideErr();
  $$('#track li').forEach(li => {
    const i = +li.dataset.i;
    li.classList.toggle('on', i === S.step); li.classList.toggle('done', i < S.step);
    $('button', li).tabIndex = i < S.step ? 0 : -1;
  });
  $('#trackFill').style.width = ((S.step - 1) / (TOTAL - 1) * 100) + '%';
  $('#trackCart').style.left = ((S.step - 1) / (TOTAL - 1) * 100) + '%';
  btnBack.hidden = S.step === 1;
  btnNext.hidden = S.step === TOTAL; btnSend.hidden = S.step !== TOTAL;
  if (S.step === 2) {
    $('#panelShop').hidden = !hasShop();
    const care = careSel();
    $('#panelCare').hidden = !care.length;
    if (care.length) {
      $('#careWhat').textContent = 'Tell me about: ' + care.map(c => c.title).join(', ');
      $('#careCountLabel').textContent = 'How many ' + care.map(c => c.noun).join(' / ') + '?';
    }
  }
  if (S.step === 3) { if (S.start) view = new Date(fromKey(S.start).getFullYear(), fromKey(S.start).getMonth(), 1); renderCal(); }
  if (S.step === 5) buildCheckout();
  if (scroll) {
    wizard.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => { const l = $(`.step[data-step="${S.step}"] legend`, form); l && l.focus({ preventScroll: true }); }, 350);
  }
}

function showErr(msg, fields = []) {
  err.textContent = msg; err.hidden = false; err.classList.remove('shake'); void err.offsetWidth; err.classList.add('shake');
  fields.forEach(f => f.closest('.field') && f.closest('.field').classList.add('bad'));
  if (fields[0]) fields[0].focus({ preventScroll: false });
}
function hideErr() { err.hidden = true; $$('.field.bad').forEach(f => f.classList.remove('bad')); }
form.addEventListener('input', e => { const f = e.target.closest('.field'); if (f) f.classList.remove('bad'); });

function validate(step) {
  hideErr();
  if (step === 1) {
    if (!S.services.length) return ['Pick at least one service to continue.'];
  }
  if (step === 2) {
    if (hasShop() && !S.items.length && !S.listByText) return ['Add at least one item to your cart — or tick “I’ll text my list to Celeste instead”.'];
  }
  if (step === 3) {
    if (!S.start) return ['Pick a date on the calendar.'];
    if (!S.win) return ['Choose a preferred time of day.'];
  }
  if (step === 4) {
    const bad = [], name = $('#fName'), ph = $('#fPhone'), em = $('#fEmail'), tw = $('#fTown'), ad = $('#fAddress');
    if (!name.value.trim()) bad.push(name);
    if (ph.value.replace(/\D/g, '').length < 10) bad.push(ph);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim())) bad.push(em);
    if (!tw.value) bad.push(tw);
    if (!ad.value.trim()) bad.push(ad);
    if (bad.length) return ['Please fill in the highlighted fields (a 10-digit phone and a valid email, too).', bad];
  }
  return null;
}
btnNext.addEventListener('click', () => {
  const v = validate(S.step);
  if (v) { showErr(v[0], v[1] || []); return; }
  goStep(S.step + 1, true);
});
btnBack.addEventListener('click', () => goStep(S.step - 1, true));

/* ---- summary ---- */
function summary() {
  const shop = hasShop(), care = careSel();
  const other = $('#otherStore').value.trim();
  const stores = [...S.stores, ...(other ? [other] : [])];
  const g = S.budget, f = feeFor(g);
  const lines = S.items.map(i => `${i.qty} × ${i.name}`);
  const s = fromKey(S.start || key(today())), e = S.end && fromKey(S.end);
  return {
    shop, care, stores, lines, g, f,
    services: S.services.map(id => svc(id).title),
    dates: S.start ? (e ? `${fmtDay(s)} → ${fmtDay(e)}` : fmtDay(s)) : '',
  };
}
function row(dl, k, v, cls, editStep) {
  const d = document.createElement('div'); if (cls) d.className = cls;
  const dt = document.createElement('dt'), dd = document.createElement('dd');
  dt.textContent = k; dd.textContent = v;
  if (editStep) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'edit'; b.textContent = 'Edit';
    b.setAttribute('aria-label', `Edit ${k}`); b.addEventListener('click', () => goStep(editStep, true)); dd.appendChild(b);
  }
  d.append(dt, dd); dl.appendChild(d);
}
function buildTicket() {
  const m = summary(), t = $('#ticket'); t.innerHTML = '';
  const dl = document.createElement('dl');
  row(dl, 'Services', m.services.join(' · '), '', 1);
  if (m.shop) {
    row(dl, 'Stores', m.stores.length ? m.stores.join(', ') : 'Celeste’s choice', '', 2);
    row(dl, 'Cart', S.listByText && !m.lines.length ? 'I’ll send my list by text' : `${itemCount()} item${itemCount() === 1 ? '' : 's'}${S.listByText ? ' (+ more by text)' : ''}`, '', 2);
    if (m.lines.length) row(dl, 'List', m.lines.join(', '));
    row(dl, 'If out of stock', S.sub);
  }
  if (m.care.length) {
    row(dl, 'Check-ins', `${S.cCount} ${m.care.map(c => c.noun).join(' / ')} · ${S.freq}`, '', 2);
    if ($('#careNotes').value.trim()) row(dl, 'Notes', $('#careNotes').value.trim());
  }
  row(dl, 'When', `${m.dates} · ${S.win}`, '', 3);
  row(dl, 'Where', `${$('#fAddress').value.trim()}, ${$('#fTown').value}`, '', 4);
  row(dl, 'Contact', `${$('#fName').value.trim()} · ${$('#fPhone').value.trim()} · ${$('#fEmail').value.trim()} (${S.contact.toLowerCase()} preferred)`, '', 4);
  t.appendChild(dl);
}

/* ---- checkout: tip, totals, Square card form ---- */
const PAY = { configured: false, card: null, loading: false };
fetch('/api/square-config').then(r => r.ok ? r.json() : { configured: false }).catch(() => ({ configured: false }))
  .then(c => { if (c && c.configured) Object.assign(PAY, c); });

function tipAmount() {
  if (!hasShop()) return 0;
  if (S.tip.pct === 'custom') {
    const v = parseFloat(String(S.tip.custom || '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(v) ? Math.min(Math.round(v * 100) / 100, 1000) : 0;
  }
  return Math.round(S.budget * S.tip.pct) / 100;
}
function renderTipChips() {
  const box = $('#tipChips'); box.innerHTML = '';
  [0, 10, 15, 20, 'custom'].forEach(p => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', S.tip.pct === p);
    b.textContent = p === 0 ? 'No tip' : p === 'custom' ? 'Custom' : `${p}% · ${money(Math.round(S.budget * p) / 100)}`;
    b.addEventListener('click', () => {
      S.tip.pct = p; $('#tipCustomWrap').hidden = p !== 'custom';
      $$('#tipChips .chip').forEach(x => x.setAttribute('aria-checked', x === b));
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      if (p === 'custom') $('#tipCustom').focus();
      renderTotals();
    });
    box.appendChild(b);
  });
  $('#tipCustomWrap').hidden = S.tip.pct !== 'custom';
}
$('#tipCustom').addEventListener('input', e => { S.tip.custom = e.target.value; renderTotals(); });

function renderTotals() {
  const m = summary(), t = $('#totals'); t.innerHTML = '<h3>Order total</h3>';
  const dl = document.createElement('dl');
  const add = (k, v, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; const a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = k; b.textContent = v; d.append(a, b); dl.appendChild(d); };
  if (m.shop) {
    const tip = tipAmount();
    add('Groceries (est.)', money(m.g));
    add('Shopping & delivery', money(m.f));
    if (tip > 0) add('Tip', money(tip));
    add('Estimated total', money(m.g + m.f + tip), 'sum');
  } else {
    add('Check-in services', 'Quote to follow', 'sum');
  }
  t.appendChild(dl);
  const p = document.createElement('p'); p.className = 'small';
  p.textContent = m.shop
    ? `Groceries are billed at in-store prices from your actual receipt. Fee is ${Math.round(FEE_RATE * 100)}% of groceries ($${FEE_MIN} minimum). Additional fees may apply for travel, time, complexity or special requests.`
    : 'Celeste will contact you with a quote — nothing is charged now.';
  t.appendChild(p);
}
function sendLabel() { return hasShop() ? 'Place order 🚀' : 'Send request 🚀'; }
function buildCheckout() {
  buildTicket(); renderTipChips(); renderTotals();
  const shop = hasShop();
  $('#tipBox').hidden = !shop; $('#payBox').hidden = !shop;
  $('#coHint').textContent = shop ? 'Review your order, add a tip, and you’re done.' : 'Almost done — Celeste will send you a quote for your check-in services.';
  btnSend.textContent = sendLabel();
  if (shop) {
    $('#demoNote').hidden = PAY.configured;
    $('#card-container').hidden = !PAY.configured;
    $('#payLoading').hidden = !PAY.configured || !!PAY.card;
    initSquare();
  }
}
async function initSquare() {
  if (!PAY.configured || PAY.card || PAY.loading) return;
  PAY.loading = true;
  try {
    if (!window.Square) await new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = PAY.environment === 'production' ? 'https://web.squarecdn.com/v1/square.js' : 'https://sandbox.web.squarecdn.com/v1/square.js';
      s.onload = ok; s.onerror = () => no(new Error('Square SDK failed to load')); document.head.appendChild(s);
    });
    const card = await window.Square.payments(PAY.appId, PAY.locationId).card();
    await card.attach('#card-container');
    PAY.card = card; $('#payLoading').hidden = true;
  } catch (e) {
    console.error(e);
    $('#payLoading').hidden = false;
    $('#payLoading').textContent = 'We couldn’t load the secure card form. Please refresh the page, or call Celeste at 609.339.1600.';
  } finally { PAY.loading = false; }
}

/* ---- submit ---- */
function resetSend() { btnSend.disabled = false; btnSend.textContent = sendLabel(); }
form.addEventListener('submit', async e => {
  e.preventDefault();
  for (let i = 1; i < TOTAL; i++) { const v = validate(i); if (v) { goStep(i, true); showErr(v[0], v[1] || []); return; } }
  hideErr();
  const m = summary(), tip = tipAmount();
  const set = (n, v) => { form.elements[n].value = v; };
  set('services', m.services.join(' | '));
  set('stores', m.shop ? m.stores.join(', ') : '');
  set('shopping_list', m.shop ? m.lines.join('\n') : '');
  set('substitutions', m.shop ? S.sub : '');
  set('grocery_budget', m.shop ? money0(m.g) : '');
  set('estimated_fee', m.shop ? money(m.f) : '');
  set('tip', m.shop ? money(tip) : '');
  set('estimated_total', m.shop ? money(m.g + m.f + tip) : '');
  set('care_frequency', m.care.length ? S.freq : '');
  set('care_count', m.care.length ? `${S.cCount} ${m.care.map(c => c.noun).join(' / ')}` : '');
  set('dates', m.dates);
  set('time_window', S.win);
  set('contact_pref', S.contact);
  set('payment_status', m.shop ? (PAY.configured ? 'Card on file (Square) — charge after shopping' : 'Demo mode — no card collected') : 'Quote to follow');
  set('square_customer_id', ''); set('card_on_file', '');

  btnSend.disabled = true; btnSend.textContent = m.shop && PAY.configured ? 'Saving your card…' : 'Sending…';

  // 1) save the card with Square (Square's hosted fields tokenize it; we never see the number)
  let savedCard = null;
  if (m.shop && PAY.configured) {
    try {
      if (!PAY.card) throw new Error('The card form isn’t ready yet. Please wait a moment and try again.');
      const tr = await PAY.card.tokenize();
      if (tr.status !== 'OK') throw new Error((tr.errors && tr.errors[0] && tr.errors[0].message) || 'Please check your card details.');
      const res = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: tr.token, name: $('#fName').value, email: $('#fEmail').value, phone: $('#fPhone').value, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'We couldn’t save that card. Please try another card.');
      savedCard = data.card;
      set('square_customer_id', data.customerId);
      set('card_on_file', `${savedCard.brand} ending ${savedCard.last4}`);
    } catch (ex) {
      resetSend(); showErr(ex.message || 'Your card couldn’t be saved. Please try again.'); return;
    }
  }

  // 2) send the order to Celeste (Netlify Forms)
  btnSend.textContent = 'Sending…';
  try {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (!local) {
      const body = new URLSearchParams(new FormData(form)).toString();
      const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } else console.info('[dev] order not sent (localhost):', Object.fromEntries(new FormData(form)));
    success(savedCard);
  } catch (_) {
    resetSend();
    showErr(savedCard
      ? 'Your card was saved, but your order didn’t send. Please try again, or call/text Celeste at 609.339.1600.'
      : 'Hmm, that didn’t go through. Please try again, or call/text Celeste at 609.339.1600.');
  }
});
function success(savedCard) {
  safe(() => localStorage.removeItem(DRAFT_KEY));
  const first = $('#fName').value.trim().split(/\s+/)[0];
  $('#thanksName').textContent = first ? ', ' + first : '';
  const tp = $('#thanksPay');
  if (savedCard) { tp.textContent = `💳 Your ${savedCard.brand} ending ${savedCard.last4} is saved with Square. You’ll only be charged after shopping, for your actual receipt.`; tp.hidden = false; }
  else tp.hidden = true;
  form.hidden = true; $('#track').hidden = true; $('.track-bar').hidden = true;
  const th = $('#thanks'); th.hidden = false;
  wizard.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  th.focus({ preventScroll: true });
  confetti(220); $('#miniCart').hidden = true;
}
$('#btnAgain').addEventListener('click', () => {
  S = fresh(); form.reset(); form.hidden = false; $('#track').hidden = false; $('.track-bar').hidden = false; $('#thanks').hidden = true;
  resetSend();
  syncAll(); goStep(1, true);
});

/* ------------------------------------------------------------------ *
 *  floating mini-cart pill
 * ------------------------------------------------------------------ */
let wizardVisible = false;
function updateMini() {
  const n = S.items.length ? itemCount() : S.services.length + S.stores.length;
  const mc = $('#miniCart');
  mc.hidden = !n || wizardVisible || !$('#thanks').hidden;
  $('#miniCount').textContent = n;
  mc.classList.remove('bump'); void mc.offsetWidth; mc.classList.add('bump');
}
$('#miniCart').addEventListener('click', () => { wizard.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); });
if ('IntersectionObserver' in window) {
  new IntersectionObserver(es => { wizardVisible = es[0].isIntersecting; const mc = $('#miniCart'); if (wizardVisible) mc.hidden = true; else updateMini(); }, { threshold: .05 }).observe(wizard);
}

/* ------------------------------------------------------------------ *
 *  boot
 * ------------------------------------------------------------------ */
loadDraft();
syncAll();
goStep(1, false);
})();
