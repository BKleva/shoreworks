// Background function: look up business names/emails for the parcels in one map area.
import { requireAuth } from '../lib/auth.mjs';
import { setJSON } from '../lib/store.mjs';
import { enrichBbox } from '../lib/roadside.mjs';

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { id, bbox } = await req.json();
  try {
    await setJSON(`rs/enrich/${id}`, { done: true, rows: await enrichBbox(bbox) });
  } catch (e) {
    await setJSON(`rs/enrich/${id}`, { done: true, error: `Business lookup (OpenStreetMap) failed: ${e.message}` });
  }
};
