// Background function (15 min budget): crawl one website's sources, or re-scan stored text with the current rules.
import { requireAuth } from '../lib/auth.mjs';
import { getJSON, getText, setJSON } from '../lib/store.mjs';
import { Crawler } from '../lib/crawl.mjs';
import { loadSources } from '../lib/sources.mjs';

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { run, idx, ids, force, mode } = await req.json();
  const jobKey = `job/crawl-g/${run}-${idx}`;
  const master = () => getJSON('job/crawl');
  const crawler = new Crawler({ jobKey, force: !!force, isStopped: async () => (await master())?.stop === true });
  const sources = await loadSources();
  let done = 0;
  try {
    for (const id of ids) {
      const src = sources.find((s) => s.id === id);
      if (!src) continue;
      if (mode === 'rescan') await rescan(src, crawler);
      else {
        const { partial } = await crawler.crawlSource(src);
        const rec = await getJSON(`docs/${src.id}`);
        if (rec) await setJSON(`docs/${src.id}`, { ...rec, last_crawled: partial ? rec.last_crawled || null : new Date().toISOString(), partial });
      }
      done++;
      await crawler.report('', { force: true, done });
      if ((await master())?.stop) break;
    }
  } catch (e) {
    await crawler.report(`ERROR: ${e.message}`, { force: true });
  } finally {
    await crawler.report('Finished.', { force: true, running: false, done, finished: Date.now() });
  }
};

async function rescan(src, crawler) {
  const rec = await getJSON(`docs/${src.id}`);
  if (!rec) return;
  await crawler.report(`> re-scan ${src.label}`, { force: true });
  for (const d of rec.docs) {
    if (d.status !== 'ok') continue;
    const text = await getText(`text/${d.id}`);
    if (text) d.findings = await crawler.findingsFor(d, text, rec.county);
  }
  await setJSON(`docs/${src.id}`, rec);
}
