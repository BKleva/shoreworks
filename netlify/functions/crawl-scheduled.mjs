import { getStore } from '@netlify/blobs';
import { runCrawl } from './crawl-run.mjs';

// Runs automatically on the schedule below — this is the "always
// crawling" part. Adjust the cron expression to taste; weekly is a
// reasonable starting cadence for municipal ordinances, which don't
// change often. NOTE: confirm Netlify's current execution-time limit
// for scheduled functions on your plan before relying on this for the
// full four-county town list — a slow run may need `concurrency`
// lowered in crawl-run.mjs, or the town list split across more than
// one scheduled function, to stay inside whatever that limit is.
export default async () => {
  const result = await runCrawl();
  const store = getStore({ name: 'ordinance-data', consistency: 'strong' });
  await store.setJSON('latest.json', result);
  console.log(
    `Ordinance Scout crawl complete: ${result.ordinances.length} ordinances, ` +
    `${result.masterPlans.length} master plans, ${result.errors.length} errors.`
  );
};

export const config = { schedule: '0 9 * * 1' }; // Mondays, 9am UTC
