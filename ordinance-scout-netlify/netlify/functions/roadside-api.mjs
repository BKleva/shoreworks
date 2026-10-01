// Roadside Map API. Reads come from Netlify Blobs; reloading a county runs as a background function.
import { requireAuth } from '../lib/auth.mjs';
import { getJSON, setJSON } from '../lib/store.mjs';
import { BBOX, CLASSES, DEFAULT_CLASSES, DEPTH_FT, REFRESH_DAYS, countyDataset, listRoutes, roadsGeojson } from '../lib/roadside.mjs';
import { siteOrigin, trigger } from '../lib/trigger.mjs';

const json = (d, status = 200) => Response.json(d, { status });
const err = (m, status = 400) => json({ error: m }, status);
const COUNTIES = Object.keys(BBOX);

async function startRefresh(req, county) { // county may be "all": the four counties are reloaded one after another
  const cur = await getJSON('job/roadside');
  if (cur?.running && Date.now() - (cur.started || 0) < 20 * 60 * 1000) return false;
  const queue = county === 'all' ? [...COUNTIES] : [county];
  await setJSON('job/roadside-queue', queue);
  await setJSON('job/roadside', { ...(cur || {}), running: true, county: queue[0], stop: false, started: Date.now(), done: 0, total: 0, saved: 0, log: [] });
  await trigger(siteOrigin(req), 'roadside-refresh-background', { county: queue[0] });
  return true;
}

const norm = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, ''), q = url.searchParams, m = req.method;

  if (path === '/api/roadside/config') return json({ counties: COUNTIES, classes: CLASSES, default_classes: DEFAULT_CLASSES, depth: DEPTH_FT });

  if (path === '/api/roadside/counts') {
    const rows = await Promise.all(COUNTIES.map(async (county) => {
      const d = await getJSON(`rs/data/${county}`);
      return { county, n: d?.features.length || 0, refreshed_at: d?.refreshed_at || null };
    }));
    return json({ refresh_days: REFRESH_DAYS, rows: rows.filter((r) => r.n) });
  }

  if (path === '/api/roadside/routes') {
    const county = q.get('county');
    if (!COUNTIES.includes(county)) return err('Pick one of the four counties');
    const rows = await listRoutes(county);
    if (!rows) { await startRefresh(req, county); return json({ rows: [], loading: true }); } // first visit: highways + parcels load in the background
    return json({ rows });
  }

  if (path === '/api/roadside/roads') {
    const county = q.get('county');
    if (!COUNTIES.includes(county)) return err('Pick one of the four counties');
    return json(await roadsGeojson(county, (q.get('refs') || '').split(',').filter(Boolean)));
  }

  if (path === '/api/roadside/results') {
    const county = q.get('county');
    if (!COUNTIES.includes(county)) return err('Pick one of the four counties');
    const d = await countyDataset(county);
    return json({ type: 'FeatureCollection', features: d.features, total: d.features.length, shown: d.features.length, refreshed_at: d.refreshed_at });
  }

  if (path === '/api/roadside/export.csv') {
    const county = q.get('county');
    if (!COUNTIES.includes(county)) return err('Pick one of the four counties');
    const min = Number(q.get('min_ft') || 0), max = Number(q.get('max_ft') || DEPTH_FT);
    const refs = (q.get('refs') || '').split(',').filter(Boolean), classes = (q.get('classes') || '').split(',').filter(Boolean);
    const rows = (await countyDataset(county)).features.map((f) => f.properties)
      .filter((p) => p.edge_min_ft >= min && p.edge_min_ft <= max && (!classes.length || classes.includes(p.prop_class))
        && (!refs.length || p.route.split(', ').some((r) => refs.includes(r))));
    const body = csv([['County', 'Town', 'Highway', 'Property address', 'Class', 'Class description', 'Business name(s) on/near parcel', 'Email(s)', 'Phone(s)',
      'Website(s)', 'Owner name (blank in public data)', 'Tax bill mailing address: street', 'Tax bill mailing address: city / state', 'Tax bill mailing address: ZIP', 'Tax bill address is the same as the property?', 'Tax bill mailing address (one line)', 'Acres', 'Feet from road edge (nearest)', 'Feet from road edge (farthest)',
      'Block/Lot (PAMS PIN)', 'Latitude', 'Longitude'],
      ...rows.map((p) => [p.county, p.muni, p.route, p.prop_loc, p.prop_class, CLASSES[p.prop_class] || '', p.businesses || p.fac_name || '', p.emails, p.phones,
        p.websites, p.owner_name, p.mail_street, p.mail_city_state, p.mail_zip, norm(p.mail_street) && norm(p.mail_street) === norm(p.prop_loc) ? 'Yes' : 'No', [p.mail_street, p.mail_city_state, p.mail_zip].filter(Boolean).join(', '), p.acres, p.edge_min_ft, p.edge_max_ft, p.pin, p.lat, p.lon])]);
    return new Response(body, { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename=roadside-parcels.csv' } });
  }

  if (path === '/api/roadside/search' && m === 'POST') { // "Refresh data"
    const d = await req.json().catch(() => ({}));
    if (d.county !== 'all' && !COUNTIES.includes(d.county)) return err('Pick one of the four counties');
    if (!(await startRefresh(req, d.county))) return err('A roadside refresh is already running', 409);
    return json({ started: 1 });
  }

  if (path === '/api/roadside/status') {
    const j = await getJSON('job/roadside');
    if (!j) return json({ running: false, log: [], done: 0, total: 0, saved: 0, county: null });
    // a job that stopped reporting for 20 minutes has crashed or timed out
    if (j.running && Date.now() - (j.started || 0) > 20 * 60 * 1000) j.running = false;
    return json(j);
  }

  if (path === '/api/roadside/stop' && m === 'POST') {
    const j = (await getJSON('job/roadside')) || {};
    await setJSON('job/roadside', { ...j, stop: true });
    return json({ ok: true });
  }

  if (path === '/api/roadside/enrich' && m === 'POST') {
    const d = await req.json().catch(() => ({}));
    const bb = (d.bbox || []).map(Number);
    if (bb.length !== 4 || bb.some(Number.isNaN)) return err('bbox must be [south, west, north, east]');
    if (bb[2] - bb[0] > 0.035 || bb[3] - bb[1] > 0.05) return err('Zoom in to street level to look up businesses.');
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await setJSON(`rs/enrich/${id}`, { done: false });
    await trigger(siteOrigin(req), 'roadside-enrich-background', { id, bbox: bb });
    return json({ id });
  }
  if (path === '/api/roadside/enrich' && m === 'GET') {
    const r = await getJSON(`rs/enrich/${q.get('id')}`);
    if (!r) return err('Unknown lookup', 404);
    return json(r);
  }

  return err('Not found', 404);
};

export const config = {
  path: ['/api/roadside/config', '/api/roadside/counts', '/api/roadside/routes', '/api/roadside/roads', '/api/roadside/results', '/api/roadside/export.csv',
    '/api/roadside/search', '/api/roadside/status', '/api/roadside/stop', '/api/roadside/enrich'],
};
