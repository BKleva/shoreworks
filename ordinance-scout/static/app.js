const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUS = {
  prohibited: "Prohibited", mixed: "Mixed: review", restricted: "Restricted / scenic",
  scenic: "Scenic language", permitted: "Permitted", no_signal: "No signal", no_data: "No data yet",
};
const TYPE = { ordinance: "Ordinance", master_plan: "Master plan", other: "Other" };
let county = "", statusFilter = "", findOffset = 0, lastOverview = null, munis = [];

async function api(path, opts = {}) {
  const o = { ...opts };
  if (o.json) { o.method = o.method || "POST"; o.headers = { "Content-Type": "application/json" }; o.body = JSON.stringify(o.json); }
  const r = await fetch(path, o);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 4200);
}
const muniName = r => r.township ? r.township : r.muni_name ? `${r.muni_name} ${r.muni_kind || ""}`.trim() : `${r.county} County (county-level)`;
const qs = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== "" && v != null && v !== false)).toString();

/* highlight: escape first, then wrap key terms */
const HL = /(billboards?|off[- ]?premises?(?: signs?)?|outdoor advertising|scenic|beautif\w*|viewsheds?|prohibited|not (?:be )?(?:permitted|allowed)|no billboards?|preserv\w+)/gi;
function hl(text, extra) {
  let out = esc(text).replace(HL, "<mark>$1</mark>");
  if (extra) {
    const safe = esc(extra).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    out = out.replace(new RegExp(`(?![^<]*>)(${safe})`, "gi"), m => m.startsWith("<mark>") ? m : `<mark>${m}</mark>`);
  }
  return out;
}

/* ---------- tabs ---------- */
function showTab(name) {
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
  $$(".tab").forEach(t => t.classList.toggle("on", t.id === "tab-" + name));
  $("#countyBar").style.display = ["import", "roadside"].includes(name) ? "none" : "";
  if (name === "roadside" && window.initRoadside) window.initRoadside();
  if (name === "overview") loadOverview();
  if (name === "findings") loadFindings(true);
  if (name === "sources") loadSources();
  history.replaceState(null, "", "#" + name);
}
$("#tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) showTab(b.dataset.tab); });
$("#countyBar").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  county = b.dataset.county;
  $$("#countyBar .chip").forEach(c => c.classList.toggle("on", c === b));
  $("#exportBtn").href = "/api/export.csv" + (county ? "?county=" + county : "");
  showTab(($(".tab.on").id || "tab-overview").slice(4));
});

/* ---------- overview ---------- */
async function loadOverview() {
  const d = await api("/api/overview?" + qs({ county }));
  lastOverview = d;
  const townMode = d.rows.length > 0;
  $("#muniCard").hidden = !townMode;
  const counts = townMode ? d.summary : Object.fromEntries(Object.keys(STATUS).map(s => [s, d.county_level.filter(c => c.status === s).length]));
  $("#tiles").innerHTML = Object.keys(STATUS).map(s => `
    <button class="tile s-${s} ${statusFilter === s ? "on" : ""}" data-s="${s}">
      <span class="n">${counts[s] || 0}</span><span class="t">${STATUS[s]}</span></button>`).join("");
  $("#countyLevel").innerHTML = d.county_level.filter(c => !county || c.county === county).map(c => `
    <div class="cl click" data-county="${esc(c.county)}"><b>${esc(c.county)} County</b>
      <div><span class="badge s-${c.status}">${STATUS[c.status]}</span></div>
      <small>${c.docs} county document(s). ${esc(c.reason)}</small></div>`).join("");
  renderMuniTable();
}
$("#countyLevel").addEventListener("click", e => {
  const c = e.target.closest(".cl"); if (!c) return;
  const chip = $(`#countyBar .chip[data-county="${c.dataset.county}"]`); if (chip) chip.click();
  showTab("findings");
});
function renderMuniTable() {
  const rows = lastOverview.rows.filter(r => !statusFilter || r.status === statusFilter);
  $("#muniTable tbody").innerHTML = rows.length ? rows.map(r => `
    <tr class="click" data-id="${r.id}">
      <td><b>${esc(r.name)}</b> <span class="muted">${esc(r.kind)}</span></td><td>${esc(r.county)}</td>
      <td><span class="badge s-${r.status}">${STATUS[r.status]}</span></td>
      <td>${esc(r.reason)}${r.blocked ? ` <span class="tag">${r.blocked} blocked/failed</span>` : ""}</td>
      <td class="num">${r.ordinances}</td><td class="num">${r.master_plans}</td><td class="num">${r.sources}</td></tr>`).join("")
    : `<tr><td colspan="7" class="empty">No municipalities match.</td></tr>`;
}
$("#tiles").addEventListener("click", e => {
  const t = e.target.closest(".tile"); if (!t) return;
  statusFilter = statusFilter === t.dataset.s ? "" : t.dataset.s;
  $$("#tiles .tile").forEach(x => x.classList.toggle("on", x.dataset.s === statusFilter));
  renderMuniTable();
});
$("#muniTable tbody").addEventListener("click", e => { const tr = e.target.closest("tr.click"); if (tr) openMuni(tr.dataset.id); });

/* ---------- drawer ---------- */
function findCard(f, withMuni) {
  return `<div class="find f-${f.category}">
    <div class="meta">${withMuni ? `<b>${esc(f.township || muniName(f))}</b><span class="muted">${esc(f.county)} County</span>${f.township ? "" : `<span class="tag">no town named</span>`}` : ""}
      <span class="badge" style="background:var(--cb);color:var(--c)">${esc(window.CATS[f.category])}</span>
      <span class="tag">${TYPE[f.doc_type] || f.doc_type}</span>
      ${f.strong ? `<span class="tag strong">explicit wording</span>` : ""}
      ${f.near_billboard ? "" : `<span class="tag">not tied to billboard text</span>`}</div>
    <p>${hl(f.snippet)}</p>
    <div class="src">${esc(f.title || "")} &middot; ${/^https?:/.test(f.url) ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.url)}</a>` : esc(f.url)}</div></div>`;
}
async function openMuni(id) {
  const d = await api("/api/muni/" + id);
  $("#dTitle").innerHTML = `${esc(d.muni.name)} ${esc(d.muni.kind)} <span class="muted" style="font-weight:500">${esc(d.muni.county)} County</span>`;
  const groups = {};
  d.findings.forEach(f => (groups[f.category] ||= []).push(f));
  const order = ["prohibited", "scenic", "regulated", "permitted", "state_law", "land_restriction"];
  $("#dBody").innerHTML = `
    <p><span class="badge s-${d.status}">${STATUS[d.status]}</span> &nbsp;${esc(d.reason)}</p>
    <div class="row wrap-row" style="margin:.8rem 0"><button class="btn primary" id="dCrawl" ${d.sources.length ? "" : "disabled"}>Crawl this town</button>
      <button class="btn ghost" id="dAdd">Add source / import</button></div>
    <h4>Documents (${d.docs.length})</h4>
    ${d.docs.length ? d.docs.map(x => `<div class="doc"><div><b>${esc(x.title || x.url)}</b><br>
      ${/^https?:/.test(x.url) ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.url)}</a>` : esc(x.url)}
      <br><span class="muted">${TYPE[x.doc_type]} &middot; ${x.chars.toLocaleString()} chars &middot; ${x.findings} findings${x.status !== "ok" ? ` &middot; <b>${esc(x.status)}</b>: ${esc(x.error || "")}` : ""}</span></div>
      <button class="linkbtn" data-del="${x.id}">Remove</button></div>`).join("")
      : `<p class="muted">Nothing collected yet. Add a source URL or import a file.</p>`}
    ${order.filter(c => groups[c]).map(c => `<h4>${esc(window.CATS[c])} (${groups[c].length})</h4>${groups[c].map(f => findCard(f, false)).join("")}`).join("")}`;
  $("#drawer").hidden = false;
  $("#dCrawl")?.addEventListener("click", async () => { try { await api("/api/crawl", { json: { muni_id: id } }); toast("Crawl started"); $("#drawer").hidden = true; showTab("sources"); } catch (e) { toast(e.message); } });
  $("#dAdd").addEventListener("click", () => { $("#drawer").hidden = true; showTab("sources"); $("#srcMuni").value = "m" + id; $("#srcUrl").focus(); });
  $$("[data-del]", $("#dBody")).forEach(b => b.addEventListener("click", async () => { await api("/api/docs/" + b.dataset.del, { method: "DELETE" }); openMuni(id); loadOverview(); }));
}
$("#dClose").addEventListener("click", () => $("#drawer").hidden = true);
document.addEventListener("keydown", e => { if (e.key === "Escape") $("#drawer").hidden = true; });

/* ---------- findings ---------- */
async function loadTowns() {
  const d = await api("/api/townships?" + qs({ county })), cur = $("#fTown").value;
  $("#fTown").innerHTML = `<option value="">All townships</option>` + d.rows.map(t =>
    `<option value="${esc(t.township)}">${esc(t.township)} (${esc(t.county)}) · ${t.n}${t.prohibited ? " · " + t.prohibited + " prohibit" : ""}</option>`).join("");
  $("#fTown").value = cur;
}
async function loadFindings(reset) {
  if (reset) { findOffset = 0; await loadTowns(); }
  const p = { county, town: $("#fTown").value, category: $("#fCat").value, doc_type: $("#fType").value, q: $("#fText").value.trim(),
    near: $("#fNear").checked ? 1 : "", strong: $("#fStrong").checked ? 1 : "", limit: 60, offset: findOffset };
  const d = await api("/api/findings?" + qs(p));
  const html = d.rows.map(f => findCard(f, true)).join("");
  $("#findList").innerHTML = (reset ? "" : $("#findList").innerHTML) + (html || (reset ? `<div class="empty">No findings yet. Add sources on "Sources &amp; Crawl" and run a crawl, or import documents.</div>` : ""));
  findOffset += d.rows.length;
  $("#moreFind").hidden = findOffset >= d.total;
  $("#moreFind").textContent = `Load more (${d.total - findOffset} left)`;
  $("#exportBtn").href = "/api/export.csv?" + qs({ county, category: p.category, doc_type: p.doc_type, near: p.near, strong: p.strong });
}
["fCat", "fTown", "fType", "fNear", "fStrong"].forEach(id => $("#" + id).addEventListener("change", () => loadFindings(true)));
let ft; $("#fText").addEventListener("input", () => { clearTimeout(ft); ft = setTimeout(() => loadFindings(true), 300); });
$("#moreFind").addEventListener("click", () => loadFindings(false));

/* ---------- search ---------- */
async function doSearch(q) {
  $("#searchOut").innerHTML = `<div class="empty">Searching…</div>`;
  try {
    const d = await api("/api/search?" + qs({ q, county, doc_type: $("#sType").value }));
    $("#searchOut").innerHTML = d.rows.length ? `<p class="note" style="margin:0 0 .8rem">${d.rows.length} document(s) contain “${esc(q)}”.</p>` + d.rows.map(r => `
      <div class="find f-scenic"><div class="meta"><b>${esc(muniName(r))}</b><span class="muted">${esc(r.county)}</span><span class="tag">${TYPE[r.doc_type]}</span></div>
      ${r.hits.map(h => `<p style="margin-bottom:.5rem">${hl(h, q)}</p>`).join("")}
      <div class="src">${esc(r.title || "")} &middot; ${/^https?:/.test(r.url) ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>` : esc(r.url)}</div></div>`).join("")
      : `<div class="empty">No collected document contains “${esc(q)}”.</div>`;
  } catch (e) { $("#searchOut").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
$("#searchForm").addEventListener("submit", e => { e.preventDefault(); doSearch($("#sq").value.trim()); });
$(".quick").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) { $("#sq").value = b.dataset.q; doSearch(b.dataset.q); } });

/* ---------- sources & crawl ---------- */
async function fillMuniSelects() {
  if (fillMuniSelects.done) return; fillMuniSelects.done = true;
  munis = (await api("/api/municipalities")).rows;
  const counties = window.COUNTIES;
  const opts = counties.map(c => `<option value="c${esc(c)}">${esc(c)} County</option>`).join("");
  $("#srcMuni").innerHTML = opts; $("#impMuni").innerHTML = opts;

}
const scope = v => v.startsWith("m") ? { muni_id: +v.slice(1) } : { county: v.slice(1) };

async function loadSources() {
  await fillMuniSelects();
  const d = await api("/api/sources");
  const rows = d.rows.filter(r => !county || r.scope_county === county);
  $("#srcTable tbody").innerHTML = rows.length ? rows.map(r => `<tr>
    <td><b>${esc(r.muni_name ? r.muni_name + " " + r.muni_kind : r.county + ' County')}</b><br><span class="muted">${esc(r.scope_county)}</span></td>
    <td>${esc(r.label)}<br><a href="${esc(r.url)}" target="_blank" rel="noopener" class="muted">${esc(r.url)}</a></td>
    <td>${r.kind === "auto" ? "Auto" : TYPE[r.kind]}</td><td class="num">${r.docs}</td><td>${esc(r.last_crawled || "never")}</td>
    <td style="white-space:nowrap"><button class="linkbtn" data-crawl="${r.id}" style="color:var(--blue-dark)">Crawl</button> &nbsp; <button class="linkbtn" data-rm="${r.id}">Delete</button></td></tr>`).join("")
    : `<tr><td colspan="6" class="empty">No sources yet. Add the URL of a town's ordinance or master plan page above.</td></tr>`;
}
$("#srcTable tbody").addEventListener("click", async e => {
  const c = e.target.closest("[data-crawl]"), r = e.target.closest("[data-rm]");
  try {
    if (c) { await api("/api/crawl", { json: { source_ids: [+c.dataset.crawl] } }); pollCrawl(); }
    if (r && confirm("Delete this source and the documents collected from it?")) { await api("/api/sources/" + r.dataset.rm, { method: "DELETE" }); loadSources(); }
  } catch (err) { toast(err.message); }
});
$("#srcForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/sources", { json: { ...scope($("#srcMuni").value), url: $("#srcUrl").value, label: $("#srcLabel").value, kind: $("#srcKind").value, max_pages: +$("#srcMax").value } });
    $("#srcUrl").value = ""; $("#srcLabel").value = ""; toast("Source added"); loadSources();
  } catch (err) { toast(err.message); }
});
async function startCrawl(body) { try { await api("/api/crawl", { json: body }); pollCrawl(); } catch (e) { toast(e.message); } }
$("#crawlAll").addEventListener("click", () => startCrawl({}));
$("#crawlCounty").addEventListener("click", () => county ? startCrawl({ county }) : toast("Pick a county in the bar above first"));
$("#crawlForce").addEventListener("click", () => startCrawl({ force: true }));
$("#crawlStop").addEventListener("click", () => api("/api/crawl/stop", { method: "POST" }));
$("#rescan").addEventListener("click", async () => { const d = await api("/api/rescan", { method: "POST" }); toast(`Re-scanned ${d.rescanned} documents`); });

let polling = false;
async function pollCrawl() {
  if (polling) return; polling = true;
  try {
    while (true) {
      const s = await api("/api/crawl/status");
      $("#crawlLog").textContent = s.log.length ? s.log.join("\n") : "Idle.";
      $("#crawlLog").scrollTop = 1e9;
      $("#crawlStop").hidden = !s.running; $("#progress").hidden = !s.running;
      $("#progress div").style.width = (s.sources_total ? (s.sources_done / s.sources_total) * 100 : 0) + "%";
      ["crawlAll", "crawlCounty", "crawlForce"].forEach(id => $("#" + id).disabled = s.running);
      if (!s.running) { loadSources(); break; }
      await new Promise(r => setTimeout(r, 1200));
    }
  } finally { polling = false; }
}

/* ---------- import ---------- */
$("#impForm").addEventListener("submit", async e => {
  e.preventDefault();
  const fd = new FormData(), sc = scope($("#impMuni").value);
  Object.entries(sc).forEach(([k, v]) => fd.append(k, v));
  fd.append("kind", $("#impKind").value); fd.append("text", $("#impText").value); fd.append("title", $("#impTitle").value);
  [...$("#impFiles").files].forEach(f => fd.append("files", f));
  $("#impOut").innerHTML = `<p class="hint">Analyzing…</p>`;
  try {
    const d = await api("/api/import", { method: "POST", body: fd });
    $("#impOut").innerHTML = d.added.map(a => `<p class="hint">${a.error ? "✗" : "✓"} <b>${esc(a.name)}</b>: ${a.error ? esc(a.error) : a.findings + " finding(s)"}</p>`).join("");
    $("#impFiles").value = ""; $("#impText").value = "";
  } catch (err) { $("#impOut").innerHTML = ""; toast(err.message); }
});

/* ---------- boot ---------- */
fillMuniSelects().then(() => {
  const start = location.hash.slice(1);
  showTab(["overview", "findings", "search", "sources", "roadside", "import"].includes(start) ? start : "overview");
  pollCrawl();
});
