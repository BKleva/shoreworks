// Runs daily; reloads any county whose roadside data is older than OI_RS_REFRESH_DAYS (default 2).
import { getJSON, setJSON } from '../lib/store.mjs';
import { BBOX, REFRESH_DAYS } from '../lib/roadside.mjs';
import { trigger } from '../lib/trigger.mjs';

export default async () => {
  const due = [];
  for (const c of Object.keys(BBOX)) {
    const d = await getJSON(`rs/data/${c}`);
    if (!d?.refreshed_at || Date.now() - new Date(d.refreshed_at).getTime() > REFRESH_DAYS * 864e5 - 36e5) due.push(c);
  }
  if (!due.length || (await getJSON('job/roadside'))?.running) return;
  await setJSON('job/roadside-queue', due);
  await trigger(process.env.URL, 'roadside-refresh-background', { county: due[0] });
};

export const config = { schedule: '0 6 * * *' };
