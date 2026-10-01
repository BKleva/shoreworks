// Polite, bounded crawler for county planning pages, ordinances and master-plan PDFs.
// Identifies itself, honours robots.txt, waits between requests to a host, stays on the source's site
// (PDFs elsewhere only if the link looks relevant), caps pages per source, and skips unchanged files.
// Sites that refuse bots (403 / JS-only viewers) are recorded as such, never worked around.
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { extractText, getDocumentProxy } from 'unpdf';
import { analyze, normalize } from './analyzer.mjs';
import { townFor, townIndex } from './towns.mjs';
import { getJSON, setJSON, setText, del } from './store.mjs';

export const UA = 'OutdoorImpactScout/1.0 (land-use research; contact ben@shoreworksnj.com)';
const DELAY_MS = 1000;
const MAX_BYTES = 30 * 1024 * 1024;   // functions have ~1 GB of memory; bigger PDFs are refused up front
const FRESH_HOURS = 20;
const HOST_KEYWORDS = ['ordinance', 'code', 'sign', 'zoning', 'land-use', 'landuse', 'land_use', 'master-plan', 'masterplan', 'master_plan',
  'planning', 'reexam', 're-exam', 'element', 'circulation', 'conservation', 'chapter', 'article', 'development-reg', 'regulations',
  'highway', 'corridor', 'billboard', 'advertis', 'scenic', 'land use', 'master plan'];
const SKIP_EXT = /\.(jpe?g|png|gif|svg|webp|ico|css|js|zip|mp[34]|mov|avi|xlsx?|pptx?|docx?|dwg|kmz?)($|\?)/i;
const BAD_HOST = /(facebook|twitter|instagram|youtube|linkedin|google)\./i;

export const docId = (url) => createHash('sha1').update(url).digest('hex').slice(0, 14);
const sha1 = (b) => createHash('sha1').update(b).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const d_ok = (jsOnly) => !jsOnly;   // a JS-only page has no links worth following

export function scoreLink(url, text) {
  const s = `${url} ${text || ''}`.toLowerCase();
  let sc = HOST_KEYWORDS.filter((k) => s.includes(k)).length;
  if (url.toLowerCase().split('?')[0].endsWith('.pdf')) sc += 1;
  return sc;
}

export function classify(url, title, text, forced = 'auto') {
  if (forced && forced !== 'auto') return forced;
  const mp = /master\s*-?plan|land\s+use\s+plan|circulation\s+(?:plan|element)|re-?examination|comprehensive\s+plan/;
  const od = /ordinance|chapter\s+\d|article\s+[ivx\d]+|§|code\s+of|zoning|development\s+regulations|land\s+use\s+and\s+development/;
  for (const blob of [`${url} ${title}`.toLowerCase(), text.length >= 1500 ? text.slice(0, 1500).toLowerCase() : '']) {
    if (mp.test(blob)) return 'master_plan';
    if (od.test(blob)) return 'ordinance';
  }
  return 'other';
}

export async function pdfText(buf) {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export function htmlText(html, baseUrl) {
  const $ = cheerio.load(html);
  const title = ($('title').first().text() || '').trim();
  const links = [];
  $('a[href]').each((_, a) => {
    try { links.push([new URL($(a).attr('href'), baseUrl).href, $(a).text().replace(/\s+/g, ' ').trim()]); } catch { /* bad href */ }
  });
  $('script,style,noscript,nav,footer,header').remove();
  return { title, links, text: $.root().text().replace(/\s+/g, ' ').trim() };
}

/** Everything one crawl of a group of sources needs: per-host politeness, robots cache, log/progress reporting. */
export class Crawler {
  constructor({ jobKey, deadlineMs = 13 * 60 * 1000, force = false, isStopped = async () => false }) {
    this.jobKey = jobKey; this.deadline = Date.now() + deadlineMs; this.force = force; this.isStopped = isStopped;
    this.robots = new Map(); this.lastHit = new Map(); this.log = []; this.pages = 0; this.skipped = 0; this.current = ''; this.dirty = 0;
  }

  async report(line, extra = {}) {
    if (line) this.log = [...this.log, `${new Date().toISOString().slice(11, 19)}  ${line}`].slice(-80);
    this.dirty++;
    if (this.dirty >= 3 || extra.force) {
      this.dirty = 0;
      const cur = (await getJSON(this.jobKey)) || {};
      await setJSON(this.jobKey, { ...cur, log: this.log, pages: this.pages, skipped: this.skipped, current: this.current, ...extra, updated: Date.now() });
    }
  }

  async allowed(url) {
    const u = new URL(url);
    if (!this.robots.has(u.host)) {
      let txt = '';
      try {
        const r = await fetch(`${u.protocol}//${u.host}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10000) });
        if (r.ok) txt = await r.text();
      } catch { /* no robots.txt reachable: allowed */ }
      this.robots.set(u.host, robotsParser(`${u.protocol}//${u.host}/robots.txt`, txt));
    }
    return this.robots.get(u.host).isAllowed(url, UA) !== false;
  }

  async wait(url) {
    const host = new URL(url).host;
    const gap = Date.now() - (this.lastHit.get(host) || 0);
    if (gap < DELAY_MS) await sleep(DELAY_MS - gap);
    this.lastHit.set(host, Date.now());
  }

  /** -> {kind: html|pdf|unchanged|null, text, title, links, err, meta} */
  async fetchPage(url, prior) {
    const fail = (err, meta = {}) => ({ kind: null, text: '', title: '', links: [], err, meta });
    if (prior && prior.links && !this.force && prior.age_h < FRESH_HOURS) return { kind: 'unchanged', links: prior.links, meta: { fresh: true } };
    if (prior && prior.status !== 'ok' && !this.force && prior.age_h < 72) return { kind: 'unchanged', links: [], meta: { fresh: true } };
    if (!(await this.allowed(url))) return fail('robots.txt disallows this URL');
    await this.wait(url);
    const headers = { 'user-agent': UA, accept: 'text/html,application/pdf;q=0.9,*/*;q=0.5' };
    if (prior && prior.links && !this.force) {
      if (prior.etag) headers['if-none-match'] = prior.etag;
      if (prior.last_modified) headers['if-modified-since'] = prior.last_modified;
    }
    let res;
    try { res = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(45000) }); }
    catch (e) { return fail(`network error: ${e.name}`); }
    if (res.status === 304 && prior?.links) return { kind: 'unchanged', links: prior.links, meta: {} };
    if ([401, 403, 429].includes(res.status)) return fail(`HTTP ${res.status}: site blocks automated access; use Import instead`);
    if (res.status >= 400) return fail(`HTTP ${res.status}`);
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    const len = Number(res.headers.get('content-length') || 0) || null;
    const meta = { etag: res.headers.get('etag'), last_modified: res.headers.get('last-modified'), size: len };
    if (len && len > MAX_BYTES) return fail(`file too large (>${MAX_BYTES >> 20}MB)`, meta);
    const isPdf = ctype.includes('pdf') || url.toLowerCase().split('?')[0].endsWith('.pdf');
    if (isPdf && prior && prior.status === 'ok' && !this.force) {
      const same = (meta.etag && meta.etag === prior.etag) || (meta.last_modified && meta.last_modified === prior.last_modified)
        || (!meta.etag && !meta.last_modified && len && len === prior.size);
      if (same) return { kind: 'unchanged', links: [], meta };
    }
    let buf;
    try { buf = Buffer.from(await res.arrayBuffer()); } catch (e) { return fail(`download failed: ${e.name}`); }
    if (buf.length > MAX_BYTES) return fail(`file too large (>${MAX_BYTES >> 20}MB)`, meta);
    if (isPdf || buf.subarray(0, 5).toString() === '%PDF-') {
      meta.size = meta.size || buf.length;
      meta.bytes_hash = sha1(buf);
      if (prior?.bytes_hash === meta.bytes_hash && !this.force) return { kind: 'unchanged', links: [], meta };
      try { return { kind: 'pdf', text: await pdfText(buf), title: url.split('/').pop(), links: [], meta }; }
      catch (e) { return fail(`could not read PDF: ${e.message?.slice(0, 60)}`, meta); }
    }
    if (ctype.includes('html') || ctype.includes('xml') || !ctype) {
      const { title, links, text } = htmlText(buf.toString('utf8'), res.url || url);
      return { kind: 'html', text, title, links, meta };
    }
    if (ctype.includes('text/plain')) return { kind: 'html', text: buf.toString('utf8'), title: url, links: [], meta };
    return fail(`unsupported type ${ctype}`);
  }

  /** Crawl one source; results are written to blobs as it goes so a timeout never loses work. */
  async crawlSource(src) {
    const base = new URL(src.url);
    const host = base.host.toLowerCase().replace(/^www\./, '');
    const cap = Number(src.max_pages) || 40;
    await this.report(`> ${src.label}  (${src.url})`, { force: true });
    const rec = (await getJSON(`docs/${src.id}`)) || { source_id: src.id, county: src.county, docs: [] };
    rec.county = src.county;
    const byUrl = new Map(rec.docs.map((d) => [d.url, d]));
    const queue = [[src.url, 0, 99]];
    const seen = new Set([src.url.split('#')[0]]);
    let fetched = 0, partial = false;

    while (queue.length && fetched < cap) {
      if (Date.now() > this.deadline) { partial = true; break; }
      if (fetched % 4 === 0 && (await this.isStopped())) { partial = true; break; }
      queue.sort((a, b) => b[2] - a[2] || a[1] - b[1]);
      const [url, depth] = queue.shift();
      this.current = url;
      const old = byUrl.get(url);
      let prior = null;
      if (old) {
        prior = { ...old, age_h: (Date.now() - new Date(old.fetched_at).getTime()) / 36e5 };
        prior.links = old.has_links ? ((await getJSON(`links/${old.id}`)) || []) : undefined;   // saved links keep the crawl fanning out
      }
      const r = await this.fetchPage(url, prior);
      fetched++; this.pages++;
      let links = r.links;

      if (r.kind === 'unchanged') {
        this.skipped++;
        if (!r.meta?.fresh) { old.fetched_at = new Date().toISOString(); old.has_links = true; }
      } else if (!r.kind) {
        await this.report(`  x ${r.err}: ${url}`);
        const status = /blocks|robots/.test(r.err) ? 'blocked' : 'error';
        byUrl.set(url, { id: docId(url), url, title: '', doc_type: 'other', status, error: r.err, chars: 0, fetched_at: new Date().toISOString(), findings: [] });
        links = [];
      } else {
        const text = r.text || '';
        const jsOnly = text.length < 200 && r.kind === 'html' && /javascript/i.test(text);
        const d = { id: docId(url), url, title: r.title || '', doc_type: classify(url, r.title || '', text, src.kind), status: jsOnly ? 'js_required' : 'ok',
          error: jsOnly ? 'Page needs JavaScript; use Import for this document' : null, chars: text.length, fetched_at: new Date().toISOString(),
          etag: r.meta?.etag || null, last_modified: r.meta?.last_modified || null, size: r.meta?.size || null, bytes_hash: r.meta?.bytes_hash || null,
          has_links: d_ok(jsOnly), findings: [] };
        if (r.kind === 'html' && r.links.length && !jsOnly) await setJSON(`links/${docId(url)}`, r.links.slice(0, 500));
        const hash = sha1(text);
        if (old && old.content_hash === hash && old.status === 'ok') d.findings = old.findings;
        else if (d.status === 'ok') d.findings = await this.findingsFor(d, text, src.county);
        if (d.status === 'ok') await setText(`text/${d.id}`, text);
        d.content_hash = hash;
        byUrl.set(url, d);
        await this.report(`  + ${r.kind.toUpperCase()} ${text.length.toLocaleString('en-US')} chars, ${d.findings.length} findings: ${(d.title || url).slice(0, 70)}`);
      }

      if (depth < 3 && links?.length) {
        for (let [link, atext] of links) {
          link = link.split('#')[0];
          let p; try { p = new URL(link); } catch { continue; }
          if (!/^https?:$/.test(p.protocol) || seen.has(link) || SKIP_EXT.test(link) || BAD_HOST.test(p.host)) continue;
          const sc = scoreLink(link, atext);
          const same = p.host.toLowerCase().replace(/^www\./, '') === host;
          const isPdf = p.pathname.toLowerCase().endsWith('.pdf');
          if ((same && (sc >= 1 || depth === 0)) || (!same && isPdf && sc >= 2)) { seen.add(link); queue.push([link, depth + 1, sc]); }
        }
      }
      if (fetched % 6 === 0) await setJSON(`docs/${src.id}`, { ...rec, docs: [...byUrl.values()] });
    }
    rec.docs = [...byUrl.values()];
    await setJSON(`docs/${src.id}`, rec);
    await this.report(`= ${partial ? 'paused (time/stop)' : 'done'}: ${fetched} page(s) fetched`, { force: true });
    return { partial };
  }

  async findingsFor(d, text, county) {
    const found = analyze(text);
    const idx = county ? townIndex(normalize(text), county, d.title, d.url) : { def: null, pos: [], names: [] };
    return found.map((f) => ({ ...f, township: townFor(idx, f.position) }));
  }
}

/** Remove a source's stored documents and text. */
export async function dropSourceData(sourceId) {
  const rec = await getJSON(`docs/${sourceId}`);
  for (const d of rec?.docs || []) await del(`text/${d.id}`);
  await del(`docs/${sourceId}`);
}
