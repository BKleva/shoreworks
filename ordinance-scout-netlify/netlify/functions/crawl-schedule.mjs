// Runs daily; re-crawls any ordinance / master-plan source not crawled in the last 7 days (or left unfinished).
import { getJSON } from '../lib/store.mjs';
import { loadSources, startCrawl } from '../lib/sources.mjs';

export default async () => {
  const sources = await loadSources();
  const due = [];
  for (const s of sources) {
    const rec = await getJSON(`docs/${s.id}`);
    if (!rec?.last_crawled || Date.now() - new Date(rec.last_crawled).getTime() > 7 * 864e5 - 36e5) due.push(s.id);
  }
  if (due.length) await startCrawl(process.env.URL, due, {});
};

export const config = { schedule: '30 6 * * *' };
