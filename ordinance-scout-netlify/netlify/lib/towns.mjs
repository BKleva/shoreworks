// Tag each finding with the township it is about (nearest town named in the document, or the document's own title/URL).
import rosters from '../data/rosters.mjs';

export const COUNTIES = ['Monmouth', 'Ocean', 'Bergen', 'Morris', 'Essex'];
const KINDS = new Set(['Township', 'Borough', 'Town', 'City', 'Village']);
// names that are ordinary words or clash with other places: only count when written with a designation
const AMBIGUOUS = new Set(['Wall', 'Ocean', 'Washington', 'Oakland', 'Deal', 'Madison', 'Dover', 'Harding', 'Chester', 'Butler',
  'Wharton', 'Union', 'Jackson', 'Brick', 'Lacey', 'Manchester', 'Berkeley', 'Stafford', 'Ramsey', 'Hanover', 'Lodi', 'Emerson',
  'Garfield', 'Alpine', 'Morris', 'Jefferson', 'Mendham', 'Orange']);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cache = {};

function towns(county) {
  if (!cache[county]) {
    const parsed = (rosters[county] || []).map((full) => {
      const i = full.lastIndexOf(' ');
      let base = full.slice(0, i), kind = full.slice(i + 1);
      if (i < 0 || !KINDS.has(kind)) { base = full; kind = ''; }
      return { full, base, kind, label: `${base} ${kind}`.trim() };
    });
    cache[county] = parsed.map(({ base, label }) => {
      const b = esc(base);
      // "Caldwell" also appears inside "West Caldwell" / "North Caldwell": don't count those as the shorter name
      const prefixes = parsed.filter((o) => o.base !== base && o.base.endsWith(' ' + base)).map((o) => esc(o.base.slice(0, -base.length).trim()));
      const both = (x) => `(?:${x}|${x.toUpperCase()})`;   // reports often print names in capitals
      const behind = prefixes.length ? `(?<!(?:${prefixes.map(both).join('|')}) )` : '';
      const src = AMBIGUOUS.has(base)
        ? String.raw`${behind}\b${b}\s+(?:Township|Borough|Town|City|Village)\b|\b(?:Township|Borough|Town|City|Village)\s+of\s+${b}\b`
        : String.raw`${behind}\b${both(b)}\b`;
      return { label, text: new RegExp(src, AMBIGUOUS.has(base) ? 'gi' : 'g'), head: new RegExp(src, 'i') };
    });
  }
  return cache[county];
}

/** Every township in the four counties, with a stable id (used by the Overview table and Sources). */
export function townList() {
  const out = [];
  let id = 1;
  for (const county of COUNTIES) {
    for (const full of rosters[county] || []) {
      const i = full.lastIndexOf(' ');
      const kind = KINDS.has(full.slice(i + 1)) ? full.slice(i + 1) : '';
      const name = kind ? full.slice(0, i) : full;
      out.push({ id: id++, name, kind, county, label: `${name} ${kind}`.trim() });
    }
  }
  return out;
}

export function townIndex(text, county, title = '', url = '') {
  const list = towns(county);
  const head = `${title} ${url.replace(/[-_]/g, ' ').replace(/%20/g, ' ')}`;
  const inHead = list.filter((t) => t.head.test(head)).map((t) => t.label);
  const def = new Set(inHead).size === 1 ? inHead[0] : null;
  const hits = [];
  for (const t of list) {
    t.text.lastIndex = 0;
    let m;
    while ((m = t.text.exec(text)) !== null) hits.push([m.index, t.label]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  return { def, pos: hits.map((h) => h[0]), names: hits.map((h) => h[1]) };
}

/** Township for a finding at char offset `pos`: the document's own town, else nearest mention before, else just after. */
export function townFor(idx, pos, before = 2500, after = 300) {
  if (idx.def) return idx.def;
  if (!idx.pos.length) return null;
  let lo = 0, hi = idx.pos.length; // bisect_right
  while (lo < hi) { const mid = (lo + hi) >> 1; if (idx.pos[mid] <= pos) lo = mid + 1; else hi = mid; }
  if (lo && pos - idx.pos[lo - 1] <= before) return idx.names[lo - 1];
  if (lo < idx.pos.length && idx.pos[lo] - pos <= after) return idx.names[lo];
  return null;
}
