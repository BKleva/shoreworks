import { getStore } from '@netlify/blobs';

// Serves whatever the most recent crawl (scheduled or on-demand)
// found. Public read, no auth — the underlying information is public
// government records, same as the sites it's crawled from; only
// triggering a new crawl (crawl-now-background.mjs) requires the
// admin login.
export default async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const store = getStore({ name: 'ordinance-data', consistency: 'strong' });
  const data = await store.get('latest.json', { type: 'json' });
  if (!data) {
    return Response.json({
      crawledAt: null,
      counties: [],
      ordinances: [],
      masterPlans: [],
      errors: [],
      note: 'No crawl has run yet. Wait for the scheduled run or trigger one from the admin panel.'
    });
  }
  return Response.json(data, { headers: { 'Cache-Control': 'public, max-age=300' } });
};

export const config = { path: '/api/ordinance-data' };
