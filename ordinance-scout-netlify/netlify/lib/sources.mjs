// Crawl sources (seeded from the starter list) + starting background crawls.
import seeds from '../data/seeds.mjs';
import { getJSON, setJSON } from './store.mjs';

import { townList } from './towns.mjs';

function seedToSource(seed, id) {
  const [county, townName] = seed.scope.split(':');
  const t = townName ? townList().find((x) => x.county === county && x.name === townName) : null;
  return { id, county, muni_id: t?.id ?? null, muni: t?.label ?? null, label: seed.label, url: seed.url, kind: seed.kind, max_pages: seed.max_pages, created_at: new Date().toISOString() };
}

export async function loadSources() {
  let list = await getJSON('sources');
  const offered = new Set((await getJSON('sources_offered')) || (list ? list.map((s) => s.url) : []));
  if (!list) list = [];
  let changed = false;
  for (const seed of seeds) {   // starter sources added in later releases (e.g. Essex County) are appended once; deleted ones stay deleted
    if (offered.has(seed.url) || list.some((s) => s.url === seed.url)) { offered.add(seed.url); continue; }
    list.push(seedToSource(seed, Math.max(0, ...list.map((s) => s.id)) + 1)); offered.add(seed.url); changed = true;
  }
  if (changed || !(await getJSON('sources'))) { await setJSON('sources', list); await setJSON('sources_offered', [...offered]); }
  return list;
}
export const saveSources = (list) => setJSON('sources', list);

const hostOf = (u) => { try { return new URL(u).host.toLowerCase().replace(/^www\./, ''); } catch { return u; } };

/** One background run per website, so no site is hit by two crawls at once. */
export function hostGroups(sources) {
  const g = new Map();
  for (const s of sources) g.set(hostOf(s.url), [...(g.get(hostOf(s.url)) || []), s.id]);
  return [...g.values()];
}

export async function startCrawl(origin, ids, { force = false, mode = 'crawl' } = {}) {
  const sources = (await loadSources()).filter((s) => ids.includes(s.id));
  const groups = hostGroups(sources);
  const run = Date.now().toString(36);
  await setJSON('job/crawl', { run, started: Date.now(), groups: groups.length, ids, force, mode, stop: false });
  await Promise.all(groups.map((g, i) => setJSON(`job/crawl-g/${run}-${i}`, { running: true, log: [], pages: 0, skipped: 0, current: '', ids: g, done: 0 })));
  await Promise.all(groups.map((g, i) => fetch(new URL('/.netlify/functions/crawl-source-background', origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-oi-internal': process.env.INTERNAL_KEY || '' },
    body: JSON.stringify({ run, idx: i, ids: g, force, mode }),
  })));
  return { run, groups: groups.length, sources: sources.length };
}
