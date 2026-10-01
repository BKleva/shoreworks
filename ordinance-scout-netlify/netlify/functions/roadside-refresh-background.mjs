// Background function: reload one county's roadside parcels, then continue down the queue (if any).
import { requireAuth } from '../lib/auth.mjs';
import { getJSON, setJSON } from '../lib/store.mjs';
import { refreshCounty } from '../lib/roadside.mjs';
import { siteOrigin, trigger } from '../lib/trigger.mjs';

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { county } = await req.json();
  await refreshCounty(county, { isStopped: async () => (await getJSON('job/roadside'))?.stop === true });
  const q = (await getJSON('job/roadside-queue')) || [];
  const next = q.filter((c) => c !== county);
  await setJSON('job/roadside-queue', next);
  if (next.length && !(await getJSON('job/roadside'))?.stop) await trigger(siteOrigin(req), 'roadside-refresh-background', { county: next[0] });
};
