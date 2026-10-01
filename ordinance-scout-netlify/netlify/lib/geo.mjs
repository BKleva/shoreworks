// Small planar geometry toolkit (feet). Coordinates are projected around a county-sized origin, which is accurate to
// a few tenths of a percent over a county, i.e. well under 2 ft at the distances used here.

export function makeProjection(lat0, lon0) {
  const p = (lat0 * Math.PI) / 180;
  const mLat = 111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p);
  const mLon = 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p);
  const ftLat = mLat * 3.28084, ftLon = mLon * 3.28084;
  return { toFt: (lon, lat) => [(lon - lon0) * ftLon, (lat - lat0) * ftLat] };
}

// ---- points / segments ----
function pointSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const orient = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

function segsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = orient(cx, cy, dx, dy, ax, ay), d2 = orient(cx, cy, dx, dy, bx, by);
  const d3 = orient(ax, ay, bx, by, cx, cy), d4 = orient(ax, ay, bx, by, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function segSegDist(ax, ay, bx, by, cx, cy, dx, dy) {
  if (segsCross(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(pointSegDist(ax, ay, cx, cy, dx, dy), pointSegDist(bx, by, cx, cy, dx, dy),
    pointSegDist(cx, cy, ax, ay, bx, by), pointSegDist(dx, dy, ax, ay, bx, by));
}

export function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from a polygon (outer ring) to a segment; 0 when they touch or overlap. */
export function polySegDist(ring, ax, ay, bx, by) {
  if (pointInRing(ax, ay, ring) || pointInRing(bx, by, ring)) return 0;
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const d = segSegDist(ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1], ax, ay, bx, by);
    if (d < best) { best = d; if (d === 0) return 0; }
  }
  return best;
}

export const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
};

// ---- line index: a coarse grid of the highway segments so each parcel only checks nearby ones ----
export class SegmentIndex {
  constructor(cell = 500) { this.cell = cell; this.grid = new Map(); this.segs = []; }
  add(ax, ay, bx, by, half) {
    const id = this.segs.length; this.segs.push([ax, ay, bx, by, half]);
    for (let cx = Math.floor(Math.min(ax, bx) / this.cell); cx <= Math.floor(Math.max(ax, bx) / this.cell); cx++)
      for (let cy = Math.floor(Math.min(ay, by) / this.cell); cy <= Math.floor(Math.max(ay, by) / this.cell); cy++) {
        const k = cx * 100003 + cy; const l = this.grid.get(k); if (l) l.push(id); else this.grid.set(k, [id]);
      }
  }
  near(minx, miny, maxx, maxy) {
    const out = new Set();
    for (let cx = Math.floor(minx / this.cell); cx <= Math.floor(maxx / this.cell); cx++)
      for (let cy = Math.floor(miny / this.cell); cy <= Math.floor(maxy / this.cell); cy++) {
        const l = this.grid.get(cx * 100003 + cy); if (l) for (const id of l) out.add(id);
      }
    return [...out];
  }
}

/** Nearest and farthest distance (ft) from the pavement edge for one parcel ring, or null if nothing is within reach. */
export function edgeDistances(ring, index, reach) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const [x, y] of ring) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  const cand = index.near(minx - reach - 60, miny - reach - 60, maxx + reach + 60, maxy + reach + 60);
  if (!cand.length) return null;
  let near = Infinity;
  for (const id of cand) {
    const [ax, ay, bx, by, half] = index.segs[id];
    const d = Math.max(polySegDist(ring, ax, ay, bx, by) - half, 0);
    if (d < near) near = d;
  }
  if (near > reach) return null;
  const step = Math.max(1, Math.floor(ring.length / 40));
  let far = 0;
  for (let i = 0; i < ring.length; i += step) {
    let m = Infinity;
    for (const id of cand) {
      const [ax, ay, bx, by, half] = index.segs[id];
      const d = Math.max(pointSegDist(ring[i][0], ring[i][1], ax, ay, bx, by) - half, 0);
      if (d < m) m = d;
    }
    if (m > far) far = m;
  }
  return [near, far];
}

/** A point guaranteed to be inside the polygon (centroid if it is inside, else a scan-line midpoint). */
export function pointOnSurface(ring) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
  }
  if (a) { cx /= 3 * a; cy /= 3 * a; if (pointInRing(cx, cy, ring)) return [cx, cy]; }
  const ys = ring.map((p) => p[1]), y = (Math.min(...ys) + Math.max(...ys)) / 2, xs = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
  }
  xs.sort((p, q) => p - q);
  return xs.length >= 2 ? [(xs[0] + xs[1]) / 2, y] : ring[0];
}
