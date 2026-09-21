// Shared crawl logic, called by both the scheduled function
// (crawl-scheduled.mjs, runs automatically) and the on-demand function
// (crawl-now-background.mjs, runs when a signed-in admin clicks
// "Refresh Results" in the app). Both just call runCrawl() and store
// what it returns — this file has no knowledge of Netlify Blobs or
// HTTP at all, so it's easy to test standalone with `node`.

import { fetchOrdinanceHosts, COUNTIES_IN_SCOPE } from './dca-directory.mjs';
import { findOrdinancePage, findMasterPlanDocument, fetchPageText, fetchPdfText } from './web-search.mjs';
import { ORDINANCE_PHRASES, SCENIC_PHRASES, matchPhrases } from './phrases.mjs';

function classifyOrdinanceStatus(hits) {
  const text = hits.map((h) => h.phrase.toLowerCase()).join(' ');
  if (/no billboards|prohibited|not be permitted|no new billboard/.test(text)) return 'prohibited';
  if (/conditional use|permitted principal use|permitted as/.test(text)) return 'restricted';
  return hits.length ? 'restricted' : 'open';
}

// eCode360, Municode, and American Legal Publishing are all free,
// publicly-readable government code hosts — no login or API key
// needed for any of them. Find the right page with a site-restricted
// search, then read that page's real text directly.
async function crawlOrdinanceForTown(row) {
  if (row.host === 'none') {
    return {
      town: row.town, county: row.county, cite: '—',
      excerpt: 'No online code found for this town in the DCA directory. Needs a manual check.',
      term: '—', status: 'open', source: null, sourceType: 'none', verified: false
    };
  }

  const results = await findOrdinancePage(row.town, row.host);
  const top = results[0];
  if (!top) {
    return {
      town: row.town, county: row.county, cite: '—',
      excerpt: 'No billboard-related result found via search.',
      term: '—', status: 'open', source: row.codeUrl || null, sourceType: row.host, verified: false
    };
  }

  let text = top.snippet || '';
  try {
    text = await fetchPageText(top.url);
  } catch {
    // Fall back to the search snippet if the live page fetch fails.
  }

  const hits = matchPhrases(text, ORDINANCE_PHRASES);
  return {
    town: row.town, county: row.county, cite: top.title,
    excerpt: hits[0] ? hits[0].excerpt : (top.snippet || 'No billboard-related phrase matched on this page.'),
    term: hits[0] ? hits[0].phrase : '—',
    status: classifyOrdinanceStatus(hits),
    source: top.url, sourceType: row.host, verified: true
  };
}

async function crawlMasterPlanForTown(row) {
  const results = await findMasterPlanDocument(row.town, row.county);
  const top = results[0];
  if (!top) {
    return {
      town: row.town, county: row.county, plan: 'Not found', scenic: false,
      excerpt: 'No master plan / reexamination report found via search.',
      source: null, verified: false
    };
  }

  let text = top.snippet || '';
  try {
    text = /\.pdf(\?|$)/i.test(top.url) ? await fetchPdfText(top.url) : await fetchPageText(top.url);
  } catch {
    // Fall back to just the search snippet if the fetch/parse fails.
  }

  const hits = matchPhrases(text, SCENIC_PHRASES);
  return {
    town: row.town, county: row.county, plan: top.title,
    scenic: hits.length > 0,
    excerpt: hits[0] ? hits[0].excerpt : text.slice(0, 240),
    source: top.url, verified: true
  };
}

/**
 * Runs the full crawl. `concurrency` caps how many towns are processed
 * at once — keep this low; these are small municipal sites and Brave
 * Search has real rate limits, not something to hammer.
 */
export async function runCrawl({ counties = COUNTIES_IN_SCOPE, concurrency = 3 } = {}) {
  const towns = await fetchOrdinanceHosts(counties);

  const ordinances = [];
  const masterPlans = [];
  const errors = [];

  let i = 0;
  async function worker() {
    while (i < towns.length) {
      const row = towns[i++];
      try {
        ordinances.push(await crawlOrdinanceForTown(row));
      } catch (err) {
        errors.push({ town: row.town, stage: 'ordinance', message: err.message });
      }
      try {
        masterPlans.push(await crawlMasterPlanForTown(row));
      } catch (err) {
        errors.push({ town: row.town, stage: 'masterPlan', message: err.message });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  return {
    crawledAt: new Date().toISOString(),
    counties,
    ordinances,
    masterPlans,
    errors
  };
}
