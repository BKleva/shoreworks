// Thin wrapper over Netlify Blobs: one store for all app data.
import { getStore } from '@netlify/blobs';

const s = () => getStore({ name: 'oi', consistency: 'strong' });

export const getJSON = async (key, fallback = null) => (await s().get(key, { type: 'json' })) ?? fallback;
export const setJSON = (key, value) => s().setJSON(key, value);
export const getText = (key) => s().get(key, { type: 'text' });
export const setText = (key, text) => s().set(key, text);
export const del = (key) => s().delete(key);

export async function keys(prefix) {
  const out = [];
  for await (const page of s().list({ prefix, paginate: true })) out.push(...page.blobs.map((b) => b.key));
  return out;
}

// ---- background-job status (crawl / roadside), polled by the page ----
export async function jobState(name) {
  return (await getJSON(`job/${name}`)) || { running: false, log: [], pages: 0, skipped: 0, current: '', sources_total: 0, sources_done: 0, done: 0, total: 0, saved: 0, county: null, stop: false };
}

export async function patchJob(name, patch, logLine) {
  const cur = await jobState(name);
  const next = { ...cur, ...patch };
  if (logLine) next.log = [...(cur.log || []), `${new Date().toISOString().slice(11, 19)}  ${logLine}`].slice(-150);
  await setJSON(`job/${name}`, next);
  return next;
}
