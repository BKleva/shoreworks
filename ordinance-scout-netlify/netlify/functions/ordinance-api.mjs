// Ordinance side of the API: overview, findings, townships, search, sources, crawl control, import, CSV export.
import { requireAuth } from '../lib/auth.mjs';
import { CATEGORY_LABELS, analyze, normalize, rollup, snippet } from '../lib/analyzer.mjs';
import { COUNTIES, townList } from '../lib/towns.mjs';
import { del, getJSON, getText, keys, setJSON, setText } from '../lib/store.mjs';
import { analyzeDoc, classify, docId, dropSourceData, htmlText, pdfText } from '../lib/crawl.mjs';
import { loadSources, saveSources, startCrawl } from '../lib/sources.mjs';

const json = (data, status = 200) => Response.json(data, { status });
const err = (msg, status = 400) => json({ error: msg }, status);
const STATUS_ORDER = ['restrictive', 'leaning', 'mixed', 'conditional', 'welcoming', 'no_signal', 'no_data'];
const CAT_RANK = { prohibited: 0, no_signage: 1, scenic: 2, regulated: 3, permitted: 4 };
const STANCE_RANK = { negative: 0, positive: 1, neutral: 2 };

/** All stored documents (from every source and manual import), each tagged with its county. */
async function allDocs() {
  const recs = await Promise.all((await keys('docs/')).map((k) => getJSON(k)));
  return recs.filter(Boolean).flatMap((r) => r.docs.map((d) => ({ ...d, county: r.county, source_id: r.source_id })));
}
const findingsOf = (docs) => docs.filter((d) => d.status === 'ok').flatMap((d) => (d.findings || []).map((f, i) => ({
  id: `${d.id}-${i}`, ...f, county: d.county, muni_id: null, muni_name: null, muni_kind: null,
  doc_id: d.id, url: d.url, title: d.title, doc_type: d.doc_type })));

/** One row of the township table: what the findings tagged to this town (plus its own documents) say. */
function townRow(t, docs, findings, sources) {
  const mine = findings.filter((f) => f.county === t.county && f.township === t.label);
  const docIds = new Set(mine.map((f) => f.doc_id));
  const own = docs.filter((d) => d.county === t.county && d.township === t.label);
  const ok = docs.filter((d) => d.county === t.county && d.status === 'ok' && (d.township === t.label || docIds.has(d.id)));
  let [status, reason, basis] = rollup(mine, ok.length);
  if (!ok.length) reason = 'No documents about this town yet. Only county-wide documents are collected so far; add its ordinance or master plan on the Sources tab.';
  return { ...t, status, reason, basis, ordinances: ok.filter((d) => (d.basis || d.doc_type) === 'ordinance').length, master_plans: ok.filter((d) => (d.basis || d.doc_type) === 'master_plan').length,
    blocked: own.filter((d) => d.status !== 'ok').length, sources: sources.filter((x) => x.muni_id === t.id).length,
    counts: Object.fromEntries(Object.keys(CATEGORY_LABELS).map((c) => [c, mine.filter((f) => f.category === c).length])) };
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

function filterFindings(all, q) {
  let rows = all.filter((f) => f.township);   // town level only: passages not tied to a specific town are left out
  if (q.get('county')) rows = rows.filter((f) => f.county === q.get('county'));
  if (q.get('town')) rows = rows.filter((f) => f.township === q.get('town'));
  if (q.get('category')) rows = rows.filter((f) => f.category === q.get('category'));
  if (q.get('stance')) rows = rows.filter((f) => f.stance === q.get('stance'));
  if (q.get('basis')) rows = rows.filter((f) => f.basis === q.get('basis'));
  if (q.get('doc_type')) rows = rows.filter((f) => f.doc_type === q.get('doc_type'));
  if (q.get('near') === '1') rows = rows.filter((f) => f.near_billboard);
  if (q.get('strong') === '1') rows = rows.filter((f) => f.strong);
  if (q.get('q')) rows = rows.filter((f) => f.snippet.toLowerCase().includes(q.get('q').toLowerCase()));
  return rows.sort((a, b) => (a.basis === 'ordinance' ? 0 : 1) - (b.basis === 'ordinance' ? 0 : 1) || (STANCE_RANK[a.stance] ?? 3) - (STANCE_RANK[b.stance] ?? 3) || (CAT_RANK[a.category] ?? 5) - (CAT_RANK[b.category] ?? 5) || b.strong - a.strong || b.near_billboard - a.near_billboard
    || String(a.township || '').localeCompare(String(b.township || '')));
}

const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');

async function crawlStatus() {
  const m = await getJSON('job/crawl');
  const base = { running: false, log: [], pages: 0, skipped: 0, current: '', sources_total: 0, sources_done: 0 };
  if (!m) return base;
  const groups = await Promise.all(Array.from({ length: m.groups }, (_, i) => getJSON(`job/crawl-g/${m.run}-${i}`)));
  const g = groups.filter(Boolean);
  // a group that stopped reporting for 20 minutes has crashed or timed out
  const alive = g.filter((x) => x.running && Date.now() - (x.updated || m.started) < 20 * 60 * 1000);
  return {
    running: alive.length > 0, pages: g.reduce((a, x) => a + (x.pages || 0), 0), skipped: g.reduce((a, x) => a + (x.skipped || 0), 0),
    current: alive[0]?.current || '', sources_total: m.ids.length, sources_done: g.reduce((a, x) => a + (x.done || 0), 0),
    log: g.flatMap((x) => x.log || []).sort().slice(-120),
  };
}

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, ''), q = url.searchParams, m = req.method;
  let mm;

  if (path === '/api/overview') {
    const docs = (await allDocs()).filter((d) => !q.get('county') || d.county === q.get('county'));
    const findings = findingsOf(docs), sources = await loadSources();
    // the main view is by township
    const rows = townList().filter((t) => !q.get('county') || t.county === q.get('county')).map((t) => townRow(t, docs, findings, sources))
      .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.county.localeCompare(b.county) || a.name.localeCompare(b.name));
    const summary = Object.fromEntries(STATUS_ORDER.map((st) => [st, rows.filter((r) => r.status === st).length]));
    return json({ rows, summary });
  }

  if (path === '/api/municipalities') return json({ rows: townList() });

  mm = path.match(/^\/api\/muni\/(\d+)$/);
  if (mm) {
    const t = townList().find((x) => x.id === Number(mm[1]));
    if (!t) return err('Unknown township', 404);
    const docs = await allDocs(), findings = findingsOf(docs.filter((d) => d.county === t.county)), sources = await loadSources();
    const row = townRow(t, docs, findings, sources), mine = findings.filter((f) => f.township === t.label);
    const ids = new Set(mine.map((f) => f.doc_id));
    const tdocs = docs.filter((d) => d.county === t.county && (d.township === t.label || ids.has(d.id)))
      .map((d) => ({ id: d.id, url: d.url, title: d.title, doc_type: d.doc_type, status: d.status, error: d.error, chars: d.chars, fetched_at: d.fetched_at, findings: (d.findings || []).filter((f) => f.township === t.label).length }));
    return json({ muni: t, docs: tdocs, findings: mine, status: row.status, reason: row.reason, sources: sources.filter((x) => x.muni_id === t.id) });
  }

  if (path === '/api/findings') {
    const rows = filterFindings(findingsOf(await allDocs()), q);
    const limit = Math.min(Number(q.get('limit') || 100), 500), off = Number(q.get('offset') || 0);
    return json({ rows: rows.slice(off, off + limit), total: rows.length });
  }

  if (path === '/api/townships') {
    const by = new Map();
    for (const f of findingsOf(await allDocs())) {
      if (!f.township || (q.get('county') && f.county !== q.get('county'))) continue;
      const k = `${f.county}|${f.township}`;
      const r = by.get(k) || { township: f.township, county: f.county, n: 0, prohibited: 0, permitted: 0 };
      r.n++; if (f.category === 'prohibited' || f.category === 'no_signage') r.prohibited++; if (f.category === 'permitted') r.permitted++;
      by.set(k, r);
    }
    return json({ rows: [...by.values()].sort((a, b) => a.county.localeCompare(b.county) || a.township.localeCompare(b.township)) });
  }

  if (path === '/api/export.csv') {
    const rows = filterFindings(findingsOf(await allDocs()), q);
    const SIGN = { positive: '+ welcoming', negative: 'ALERT: discourages', neutral: 'regulated' };
    const body = csv([['County', 'Township', 'Indicator', 'Category', 'Rule', 'Applies to', 'Source is', 'Explicit wording', 'Doc type', 'Document', 'URL', 'Passage'],
      ...rows.map((r) => [r.county, r.township || '(no town named)', SIGN[r.stance] || '', CATEGORY_LABELS[r.category], r.rule,
        { all_zones: 'every district', some_zones: 'some districts', unspecified: 'not stated' }[r.scope] || '', r.basis === 'ordinance' ? 'ordinance text' : r.basis === 'master_plan' ? 'master plan / policy' : 'other',
        r.strong ? 'yes' : '', r.doc_type, r.title, r.url, r.snippet])]);
    return new Response(body, { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename=outdoor-impact-ordinance-findings.csv' } });
  }

  if (path === '/api/search') {
    const term = (q.get('q') || '').trim();
    if (term.length < 3) return err('Enter at least 3 characters');
    let docs = (await allDocs()).filter((d) => d.status === 'ok');
    if (q.get('county')) docs = docs.filter((d) => d.county === q.get('county'));
    if (q.get('doc_type')) docs = docs.filter((d) => d.doc_type === q.get('doc_type'));
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'gi');
    const found = await pool(docs.slice(0, 400), 24, async (d) => {
      const text = await getText(`text/${d.id}`);
      if (!text) return null;
      const t = normalize(text), hits = []; re.lastIndex = 0; let mm;
      while ((mm = re.exec(t)) && hits.length < 8) hits.push(snippet(t, mm.index, mm.index + mm[0].length));
      return hits.length ? { id: d.id, url: d.url, title: d.title, doc_type: d.doc_type, county: d.county, muni_name: null, muni_kind: null, hits } : null;
    });
    return json({ rows: found.filter(Boolean), query: term });
  }

  if (path === '/api/sources' && m === 'GET') {
    const docsBy = new Map();
    for (const k of await keys('docs/')) { const r = await getJSON(k); if (r) docsBy.set(r.source_id, r); }
    const towns = townList();
    const rows = (await loadSources()).map((s) => ({ ...s, scope_county: s.county, muni_name: towns.find((t) => t.id === s.muni_id)?.name ?? null, muni_kind: towns.find((t) => t.id === s.muni_id)?.kind ?? null,
      docs: docsBy.get(s.id)?.docs.length || 0, last_crawled: docsBy.get(s.id)?.last_crawled || null }));
    return json({ rows: rows.sort((a, b) => a.county.localeCompare(b.county) || a.label.localeCompare(b.label)) });
  }
  if (path === '/api/sources' && m === 'POST') {
    const d = await req.json();
    const u = String(d.url || '').trim();
    if (!/^https?:\/\/\S+$/.test(u)) return err('Enter a full http(s) URL');
    const town = d.muni_id ? townList().find((t) => t.id === Number(d.muni_id)) : null;
    if (!town && !COUNTIES.includes(d.county)) return err('Pick a county or a township');
    const list = await loadSources();
    const id = Math.max(0, ...list.map((s) => s.id)) + 1;
    list.push({ id, county: town ? town.county : d.county, muni_id: town?.id ?? null, muni: town?.label ?? null, label: String(d.label || u).slice(0, 120), url: u, kind: ['ordinance', 'master_plan'].includes(d.kind) ? d.kind : 'auto',
      max_pages: Math.min(Number(d.max_pages) || 40, 300), created_at: new Date().toISOString() });
    await saveSources(list);
    return json({ id });
  }
  mm = path.match(/^\/api\/sources\/(\d+)$/);
  if (mm && m === 'DELETE') {
    const id = Number(mm[1]);
    await saveSources((await loadSources()).filter((s) => s.id !== id));
    await dropSourceData(id);
    return json({ ok: true });
  }

  if (path === '/api/crawl' && m === 'POST') {
    const d = await req.json().catch(() => ({}));
    const status = await crawlStatus();
    if (status.running) return err('A crawl is already running', 409);
    const list = await loadSources();
    let ids = d.source_ids?.length ? d.source_ids.map(Number) : d.muni_id ? list.filter((s) => s.muni_id === Number(d.muni_id)).map((s) => s.id) : d.county ? list.filter((s) => s.county === d.county).map((s) => s.id) : list.map((s) => s.id);
    ids = ids.filter((i) => list.some((s) => s.id === i));
    if (!ids.length) return err('No sources to crawl. Add source URLs first.');
    const r = await startCrawl(url.origin, ids, { force: !!d.force });
    return json({ started: r.sources });
  }
  if (path === '/api/rescan' && m === 'POST') {
    const list = await loadSources();
    await startCrawl(url.origin, list.map((s) => s.id), { mode: 'rescan' });
    return json({ rescanned: 'started' });
  }
  if (path === '/api/crawl/status') return json(await crawlStatus());
  if (path === '/api/crawl/stop' && m === 'POST') {
    const j = await getJSON('job/crawl');
    if (j) await setJSON('job/crawl', { ...j, stop: true });
    return json({ ok: true });
  }

  mm = path.match(/^\/api\/docs\/([0-9a-f]+)$/);
  if (mm && m === 'DELETE') {
    for (const k of await keys('docs/')) {
      const r = await getJSON(k);
      if (r?.docs.some((d) => d.id === mm[1])) { r.docs = r.docs.filter((d) => d.id !== mm[1]); await setJSON(k, r); await del(`text/${mm[1]}`); }
    }
    return json({ ok: true });
  }

  if (path === '/api/import' && m === 'POST') {
    const form = await req.formData();
    const town = form.get('muni_id') ? townList().find((t) => t.id === Number(form.get('muni_id'))) : null;
    const county = town ? town.county : form.get('county');
    if (!COUNTIES.includes(county)) return err('Pick a county or a township');
    const kind = form.get('kind') || 'auto';
    const key = town ? `docs/manual-${county}-${town.id}` : `docs/manual-${county}`;
    const rec = (await getJSON(key)) || { source_id: key.slice(5), county, docs: [] };
    const added = [];
    const add = async (name, url, text) => {
      const d = { id: docId(url), url, title: name, doc_type: classify(url, name, text, kind), status: 'ok', error: null, chars: text.length,
        fetched_at: new Date().toISOString(), has_links: true, findings: [] };
      d.findings = await analyzeDoc(d, text, county, town?.label || null);
      await setText(`text/${d.id}`, text);
      rec.docs = [...rec.docs.filter((x) => x.id !== d.id), d];
      added.push({ name, findings: d.findings.length });
    };
    const pasted = String(form.get('text') || '').trim();
    if (pasted) await add(form.get('title') || 'Pasted text', `pasted:${form.get('title') || 'text'}`, pasted);
    for (const f of form.getAll('files')) {
      if (typeof f === 'string' || !f.name) continue;
      try {
        const buf = Buffer.from(await f.arrayBuffer());
        const text = /\.pdf$/i.test(f.name) || buf.subarray(0, 5).toString() === '%PDF-' ? await pdfText(buf)
          : /\.html?$/i.test(f.name) ? htmlText(buf.toString('utf8'), 'http://x/').text : buf.toString('utf8');
        if (text.trim().length < 50) { added.push({ name: f.name, error: 'no extractable text (scanned PDF?)' }); continue; }
        await add(f.name, `file:${f.name}`, text);
      } catch (e) { added.push({ name: f.name, error: `could not read: ${e.message}` }); }
    }
    if (!added.length) return err('Attach a file or paste text');
    await setJSON(key, rec);
    return json({ added });
  }

  return err('Not found', 404);
};

export const config = {
  path: ['/api/overview', '/api/municipalities', '/api/muni/:id', '/api/findings', '/api/townships', '/api/export.csv', '/api/search', '/api/sources', '/api/sources/:id',
    '/api/crawl', '/api/crawl/status', '/api/crawl/stop', '/api/rescan', '/api/docs/:id', '/api/import'],
};
