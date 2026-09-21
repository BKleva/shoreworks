import { getStore } from '@netlify/blobs';
import { verifyToken, bearer } from './_auth.mjs';
import { runCrawl } from './crawl-run.mjs';

// This is the real "Refresh Results" button handler — signed-in admins
// only. The "-background" suffix in the filename is Netlify's own
// convention for a function that runs asynchronously with a longer
// time budget than a normal function gets, since a full four-county
// crawl can take a while; it returns 202 immediately and the caller
// polls /api/ordinance-data's `crawledAt` timestamp to know when fresh
// results have landed. NOTE: confirm this naming convention and its
// current time limit against Netlify's docs at deploy time — I
// couldn't test it live from this environment.
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  if (!verifyToken(bearer(req))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await runCrawl();
  const store = getStore({ name: 'ordinance-data', consistency: 'strong' });
  await store.setJSON('latest.json', result);
};

export const config = { path: '/api/crawl-now' };
