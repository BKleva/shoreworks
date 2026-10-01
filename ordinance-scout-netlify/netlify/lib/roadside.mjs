// Roadside parcels: every vacant / commercial / industrial parcel within N feet of a state highway edge.
//   Highways .......... OpenStreetMap (Overpass): NJ / US / I routes inside the county. Garden State Parkway excluded.
//   Parcels + tax mail  NJ Office of GIS "Parcels and MOD-IV Composite of NJ" (ArcGIS). Owner names are blank in the
//                       public layer; the tax mailing address is present.
//   Businesses/emails .. OpenStreetMap listings (name, phone, website, email): sparse, looked up on demand.
// Distances run from the estimated pavement edge (OSM lane count x 6 ft either side of the centerline).
import { getJSON, patchJob, setJSON } from './store.mjs';
import { SegmentIndex, edgeDistances, makeProjection, pointInRing, pointOnSurface, ringArea } from './geo.mjs';

export const UA = 'OutdoorImpactScout/1.0 (land-use research; contact ben@shoreworksnj.com)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const PARCELS = 'https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0/query';
export const DEPTH_FT = Number(process.env.OI_RS_DEPTH_FT) || 300;   // how far back from the road edge every refresh loads
export const REFRESH_DAYS = Number(process.env.OI_RS_REFRESH_DAYS) || 2;
export const CLASSES = { '1': 'Vacant land', '4A': 'Commercial', '4B': 'Industrial' }; // residential, farm, apartment, exempt: never loaded
export const DEFAULT_CLASSES = Object.keys(CLASSES);
export const BBOX = { // south, west, north, east
  Monmouth: [40.05, -74.45, 40.5, -73.98], Ocean: [39.53, -74.45, 40.16, -73.9],
  Bergen: [40.7, -74.22, 41.13, -73.88], Morris: [40.63, -74.72, 41.08, -74.2],
};
const POI_KEYS = ['shop', 'amenity', 'office', 'craft', 'industrial', 'healthcare', 'tourism', 'leisure'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query, timeoutMs = 120000) {
  let last = '';
  for (const url of OVERPASS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(timeoutMs) });
        if (r.ok) return await r.json();
        last = `HTTP ${r.status}`;
      } catch (e) { last = e.name; }
      await sleep(2000);
    }
  }
  throw new Error(`Overpass unavailable (${last})`);
}

// ------------------------------------------------------------------ highways
const isGsp = (t) => { const ref = (t.ref || '').toUpperCase(); return ref.includes('GSP') || ref.includes('NJ 444') || ref.includes('NJ444') || (t.name || '').toLowerCase().includes('garden state parkway'); };
const r5 = (n) => Math.round(n * 1e5) / 1e5;

export async function loadRoads(county, { maxAgeDays = 30, force = false } = {}) {
  const cached = await getJSON(`rs/roads/${county}`);
  if (cached && !force && Date.now() - new Date(cached.fetched).getTime() < maxAgeDays * 864e5) return cached.ways;
  const [s, w, n, e] = BBOX[county];
  const q = `[out:json][timeout:180];area["ISO3166-2"="US-NJ"]->.nj;area["name"="${county} County"]["admin_level"="6"]->.c;` +
    `way["highway"~"^(motorway|trunk|primary|secondary)$"]["ref"~"^(NJ|US|I) ?[0-9]"](${s},${w},${n},${e})(area.c);out geom tags;`;
  const els = (await overpass(q, 170000)).elements;
  const ways = [];
  for (const el of els) {
    const t = el.tags || {};
    if (isGsp(t) || (el.geometry || []).length < 2) continue;
    const refs = (t.ref || '').split(';').map((r) => r.trim().replace(/^(NJ|US|I)\s*(\d)/, '$1 $2')).filter((r) => /^(NJ|US|I) \d+[A-Z]?$/.test(r));
    if (!refs.length) continue;
    ways.push({ id: el.id, refs, name: t.name || '', lanes: /^\d+$/.test(t.lanes || '') ? Number(t.lanes) : 2, coords: el.geometry.map((p) => [r5(p.lon), r5(p.lat)]) });
  }
  await setJSON(`rs/roads/${county}`, { fetched: new Date().toISOString(), ways });
  return ways;
}

const routeKey = (ref) => { const [, kind, num] = ref.match(/^(NJ|US|I) ?(\d+)/); return [{ I: 0, US: 1, NJ: 2 }[kind], Number(num)]; };
const routeCmp = (a, b) => { const x = routeKey(a), y = routeKey(b); return x[0] - y[0] || x[1] - y[1] || a.localeCompare(b); };

export async function listRoutes(county) {
  const cached = await getJSON(`rs/roads/${county}`);
  if (!cached) return null;
  const by = new Map();
  for (const w of cached.ways) for (const r of w.refs) { const d = by.get(r) || { ref: r, ways: 0, names: new Set() }; d.ways++; if (w.name) d.names.add(w.name); by.set(r, d); }
  return [...by.values()].sort((a, b) => routeCmp(a.ref, b.ref)).map((d) => ({ ref: d.ref, ways: d.ways, names: [...d.names].slice(0, 2) }));
}

export async function roadsGeojson(county, refs = []) {
  const cached = await getJSON(`rs/roads/${county}`);
  const feats = (cached?.ways || []).filter((w) => !refs.length || w.refs.some((r) => refs.includes(r)))
    .map((w) => ({ type: 'Feature', properties: { ref: w.refs.join(', '), name: w.name }, geometry: { type: 'LineString', coordinates: w.coords } }));
  return { type: 'FeatureCollection', features: feats };
}

// ------------------------------------------------------------------ parcels
async function parcelChunk(county, part, reachFt, classes) {
  const geometry = JSON.stringify({ paths: part.map((w) => w.coords), spatialReference: { wkid: 4326 } });
  const where = `COUNTY='${county.toUpperCase()}' AND PROP_CLASS IN (${classes.map((c) => `'${c}'`).join(',')})`;
  const out = [];
  for (let offset = 0; ; ) {
    const body = new URLSearchParams({ f: 'json', where, geometry, geometryType: 'esriGeometryPolyline', inSR: '4326', outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', distance: String(reachFt), units: 'esriSRUnit_Foot', returnGeometry: 'true', maxAllowableOffset: '0.00001',
      outFields: 'PAMS_PIN,PROP_CLASS,MUN_NAME,PROP_LOC,OWNER_NAME,ST_ADDRESS,CITY_STATE,ZIP_CODE,FAC_NAME,PROP_USE,CALC_ACRE',
      resultOffset: String(offset), resultRecordCount: '2000' });
    let j;
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(PARCELS, { method: 'POST', headers: { 'user-agent': UA }, body, signal: AbortSignal.timeout(120000) });
      j = await r.json().catch(() => ({ error: { message: `HTTP ${r.status}` } }));
      if (!j.error) break;
      await sleep(2000);
    }
    if (j.error) throw new Error(`Parcel service error: ${j.error.message}`);
    out.push(...(j.features || []));
    if (!j.exceededTransferLimit) return out;
    offset += (j.features || []).length || 2000;
  }
}

/** ArcGIS rings -> {outer, holes}: largest ring is the outer boundary, rings inside it are holes. */
function ringsToPolygon(rings) {
  const rs = rings.filter((r) => r.length >= 4).sort((a, b) => ringArea(b) - ringArea(a));
  if (!rs.length) return null;
  const outer = rs[0];
  return { outer, holes: rs.slice(1).filter((h) => pointInRing(h[0][0], h[0][1], outer)) };
}

const round5 = (ring) => ring.map(([x, y]) => [r5(x), r5(y)]);

/** Reload one county. Progress is written to the job record and the dataset is saved after every highway. */
export async function refreshCounty(county, { isStopped = async () => false } = {}) {
  const job = (patch, line) => patchJob('roadside', patch, line);
  await job({ running: true, county, done: 0, total: 0, saved: 0, stop: false, started: Date.now() }, `Refreshing ${county} County…`);
  try {
    const ways = await loadRoads(county, { force: false });
    const [s, w, n, e] = BBOX[county];
    const proj = makeProjection((s + n) / 2, (w + e) / 2);
    const refs = [...new Set(ways.flatMap((x) => x.refs))].sort(routeCmp);
    await job({ total: refs.length }, `${county}: ${ways.length} highway segments, ${refs.length} highways`);
    const best = new Map(); // pin -> feature (a parcel on two highways is one lead)
    for (const ref of refs) {
      if (await isStopped()) break;
      const rw = ways.filter((x) => x.refs.includes(ref));
      const index = new SegmentIndex(500);
      for (const x of rw) {
        const pts = x.coords.map(([lon, lat]) => proj.toFt(lon, lat));
        for (let i = 0; i < pts.length - 1; i++) index.add(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], x.lanes * 6);
      }
      const chunks = []; for (let i = 0; i < rw.length; i += 80) chunks.push(rw.slice(i, i + 80));
      const feats = [];
      for (let i = 0; i < chunks.length; i += 4) feats.push(...(await Promise.all(chunks.slice(i, i + 4).map((c) => parcelChunk(county, c, DEPTH_FT + 26, DEFAULT_CLASSES)))).flat());
      const seen = new Set(); let kept = 0;
      for (const f of feats) {
        const a = f.attributes;
        if (seen.has(a.PAMS_PIN) || !f.geometry?.rings || !DEFAULT_CLASSES.includes(a.PROP_CLASS)) continue;
        seen.add(a.PAMS_PIN);
        const poly = ringsToPolygon(f.geometry.rings);
        if (!poly) continue;
        const d = edgeDistances(poly.outer.map(([lon, lat]) => proj.toFt(lon, lat)), index, DEPTH_FT);
        if (!d || d[0] > DEPTH_FT) continue;
        kept++;
        const prev = best.get(a.PAMS_PIN);
        if (prev) {
          const p = prev.properties;
          p.route = `${p.route}, ${ref}`;
          if (d[0] < p.edge_min_ft) { p.edge_min_ft = Math.round(d[0] * 10) / 10; p.edge_max_ft = Math.round(d[1] * 10) / 10; }
          continue;
        }
        const pt = pointOnSurface(poly.outer);
        best.set(a.PAMS_PIN, { type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [round5(poly.outer), ...poly.holes.map(round5)] },
          properties: { pin: a.PAMS_PIN, route: ref, county, muni: a.MUN_NAME, prop_loc: a.PROP_LOC, prop_class: a.PROP_CLASS, prop_use: a.PROP_USE,
            fac_name: a.FAC_NAME, owner_name: a.OWNER_NAME || '', mail_street: a.ST_ADDRESS || '', mail_city_state: a.CITY_STATE || '',
            mail_zip: a.ZIP_CODE || '', acres: a.CALC_ACRE, edge_min_ft: Math.round(d[0] * 10) / 10, edge_max_ft: Math.round(d[1] * 10) / 10,
            businesses: '', emails: '', phones: '', websites: '', lat: r5(pt[1]), lon: r5(pt[0]), biz_checked: 0 } });
      }
      const features = [...best.values()];
      await setJSON(`rs/data/${county}`, { county, depth: DEPTH_FT, refreshed_at: null, partial: true, features });
      const cur = await getJSON('job/roadside');
      await job({ done: (cur?.done || 0) + 1, saved: features.length }, `= ${ref}: ${kept.toLocaleString('en-US')} parcels within ${DEPTH_FT} ft`);
    }
    const stopped = await isStopped();
    const features = [...best.values()];
    if (!stopped) {
      await setJSON(`rs/data/${county}`, { county, depth: DEPTH_FT, refreshed_at: new Date().toISOString(), features });
      await job({ saved: features.length }, `Done: ${features.length.toLocaleString('en-US')} parcels in ${county} County.`);
    } else await job({}, 'Stopped.');
  } catch (e) {
    await job({}, `ERROR: ${e.message}`);
  } finally {
    await job({ running: false, finished: Date.now() });
  }
}

// ------------------------------------------------------------------ businesses (OpenStreetMap), on demand
function pointRingDist(x, y, ring) {
  if (pointInRing(x, y, ring)) return 0;
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

export function countyOf(lat, lon) {
  return Object.keys(BBOX).find((c) => { const [s, w, n, e] = BBOX[c]; return lat >= s && lat <= n && lon >= w && lon <= e; });
}

/** Look up OSM business names/emails for parcels inside a small map area. */
export async function enrichBbox([s, w, n, e]) {
  const county = countyOf((s + n) / 2, (w + e) / 2);
  if (!county) return [];
  const data = await getJSON(`rs/data/${county}`);
  const biz = (await getJSON(`rs/biz/${county}`)) || { pins: {} };
  const todo = (data?.features || []).filter((f) => { const p = f.properties; return !biz.pins[p.pin] && p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= e; });
  if (!todo.length) return [];
  const keys = POI_KEYS.join('|');
  const els = (await overpass(`[out:json][timeout:60];nwr["name"][~"^(${keys})$"~"."](${s - 0.001},${w - 0.001},${n + 0.001},${e + 0.001});out center tags;`, 90000)).elements;
  const [bs, bw, bn, be] = BBOX[county], proj = makeProjection((bs + bn) / 2, (bw + be) / 2);
  const pois = els.map((el) => { const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon, t = el.tags || {};
    return lat == null ? null : { xy: proj.toFt(lon, lat), name: t.name || '', phone: t.phone || t['contact:phone'] || '', website: t.website || t['contact:website'] || '', email: t.email || t['contact:email'] || '' }; }).filter(Boolean);
  const uniq = (a) => [...new Set(a.filter(Boolean))].join('; ');
  const rows = [];
  for (const f of todo) {
    const ring = f.geometry.coordinates[0].map(([lon, lat]) => proj.toFt(lon, lat));
    const hit = pois.filter((p) => pointRingDist(p.xy[0], p.xy[1], ring) <= 15);
    const r = { pin: f.properties.pin, businesses: uniq(hit.map((h) => h.name)), emails: uniq(hit.map((h) => h.email)), phones: uniq(hit.map((h) => h.phone)), websites: uniq(hit.map((h) => h.website)) };
    biz.pins[r.pin] = { businesses: r.businesses, emails: r.emails, phones: r.phones, websites: r.websites };
    rows.push(r);
  }
  await setJSON(`rs/biz/${county}`, biz);
  return rows;
}

// ------------------------------------------------------------------ reads used by the API
export async function countyDataset(county) {
  const data = await getJSON(`rs/data/${county}`);
  if (!data) return { features: [], refreshed_at: null };
  const biz = (await getJSON(`rs/biz/${county}`))?.pins || {};
  for (const f of data.features) {
    const b = biz[f.properties.pin];
    if (b) Object.assign(f.properties, b, { biz_checked: 1 });
  }
  return data;
}
