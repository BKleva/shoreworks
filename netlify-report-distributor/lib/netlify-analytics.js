// Thin client for Netlify's unofficial Analytics API (analytics.services.netlify.com).
// Undocumented by Netlify — endpoints/auth may change without notice. All
// endpoints are v2; the old v1 pageviews/visitors endpoints were retired.

const BASE = 'https://analytics.services.netlify.com';

function authHeaders() {
  return { Authorization: `Bearer ${process.env.NETLIFY_PAT}` };
}

async function getJSON(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Netlify Analytics API ${res.status} for ${url}`);
  }
  return res.json();
}

// Totals endpoints cap each request at ~30 days, so split longer ranges
// into <=30-day chunks and sum the "range" totals.
function chunkRange(fromMs, toMs, maxDays = 29) {
  const chunks = [];
  const maxSpan = maxDays * 24 * 60 * 60 * 1000;
  let start = fromMs;
  while (start < toMs) {
    const end = Math.min(start + maxSpan, toMs);
    chunks.push([start, end]);
    start = end;
  }
  return chunks;
}

async function sumTotal(siteId, metric, fromMs, toMs) {
  let total = 0;
  for (const [from, to] of chunkRange(fromMs, toMs)) {
    const url = `${BASE}/v2/${siteId}/${metric}?from=${from}&to=${to}&resolution=range`;
    const json = await getJSON(url);
    const point = (json.data || [])[0];
    total += point ? point[1] : 0;
  }
  return total;
}

async function getRanking(siteId, path, fromMs, toMs, limit = 5) {
  const url = `${BASE}/v2/${siteId}/ranking/${path}?from=${fromMs}&to=${toMs}&limit=${limit}&resolution=hour`;
  const json = await getJSON(url);
  return (json.data || []).map((row) => ({
    resource: row.resource,
    count: row.count
  }));
}

// Returns { pageviews, visitors, topPages, topReferrers } for the given range.
async function getSiteMetrics(siteId, fromMs, toMs) {
  const [pageviews, visitors, topPages, topReferrers] = await Promise.all([
    sumTotal(siteId, 'pageviews', fromMs, toMs),
    sumTotal(siteId, 'visitors', fromMs, toMs),
    getRanking(siteId, 'pages', fromMs, toMs, 5),
    getRanking(siteId, 'sources', fromMs, toMs, 5)
  ]);
  return { pageviews, visitors, topPages, topReferrers };
}

module.exports = { getSiteMetrics };
