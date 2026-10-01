// Keyword screen for billboard-relevant language. Port of the Python analyzer: same rules, same output.
// A screen, not legal analysis: every finding carries the surrounding text so a person can read it.

const BB = String.raw`(?:billboards?|off[- ]?(?:premises?|site)\s+(?:signs?|advertising|advertisements?)` +
  String.raw`|outdoor\s+advertising(?:\s+(?:signs?|structures?))?|advertising\s+(?:signs?|structures?)` +
  String.raw`|third[- ]party\s+(?:signs?|advertising)|freestanding\s+off[- ]premises?` +
  String.raw`|signs?\s+(?:\w+\s+){0,2}?off\s+(?:of\s+)?the\s+premises)`;
const BB_RE = new RegExp(BB, 'i');
const NEAR_RE = new RegExp(BB + String.raw`|\bsigns?\b|\bsignage\b`, 'i');

export const PROHIBITED = 'prohibited', SCENIC = 'scenic', REGULATED = 'regulated', PERMITTED = 'permitted',
  STATE = 'state_law', OVERLAY = 'land_restriction';

export const CATEGORY_LABELS = {
  [PROHIBITED]: 'Billboards prohibited',
  [SCENIC]: 'Scenic / visual preservation',
  [REGULATED]: 'Regulated (conditions, spacing, size)',
  [PERMITTED]: 'Billboards permitted',
  [STATE]: 'State / federal sign law',
  [OVERLAY]: 'Land restriction overlay',
};

const NOT_QUANT = String.raw`(?!\s*(?:more|less|closer|greater|fewer|larger|taller|higher|lower|smaller|sign\s+shall\s+exceed))`;
const rule = (category, name, pattern, strong = false) => ({ category, name, re: new RegExp(pattern, 'gis'), strong });

const RULES = [
  // ---- Prohibited ----
  rule(PROHIBITED, 'billboards prohibited / not permitted',
    BB + String.raw`[^.;]{0,80}?\b(?:(?:is|are|shall\s+be|shall\s+remain|be)\s+)?(?:expressly\s+|hereby\s+|specifically\s+|strictly\s+)?` +
    String.raw`(?:prohibited|forbidden|banned|unlawful|not\s+(?:be\s+)?(?:permitted|allowed))`, true),
  rule(PROHIBITED, 'no billboards / prohibit billboards',
    String.raw`\b(?:no` + NOT_QUANT + String.raw`|prohibit\w*|ban(?:s|ned)?|forbid\w*|disallow\w*)\b[^.;]{0,50}?` + BB, true),
  rule(PROHIBITED, 'listed among prohibited signs',
    String.raw`(?:following|these|such)\s+(?:types\s+of\s+)?signs?[^.]{0,60}?(?:prohibited|not\s+permitted|unlawful)[\s\S]{0,500}?` + BB),
  rule(PROHIBITED, 'billboards not a permitted use',
    BB + String.raw`[^.;]{0,60}?not\s+(?:a\s+)?(?:permitted|allowed)\s+(?:principal\s+|accessory\s+)?(?:use|in\s+any)`, true),
  rule(PROHIBITED, 'off the premises, not permitted in any zone',
    BB + String.raw`[^.;]{0,150}?(?:not\s+(?:be\s+)?permitted|prohibited|not\s+allowed)\s+in\s+(?:any|all|every)\s+(?:zone|zoning|district)s?`, true),

  // ---- Scenic / visual preservation ----
  rule(SCENIC, 'scenic highway / corridor / view',
    String.raw`scenic\s+(?:highways?|byways?|corridors?|roads?|roadways?|routes?|views?|vistas?|resources?|gateways?|and\s+historic)`),
  rule(SCENIC, 'preserve scenic / beautiful',
    String.raw`(?:preserv\w+|protect\w+|conserv\w+|maintain\w*|enhanc\w+|safeguard\w*)[^.;]{0,60}?` +
    String.raw`(?:scenic|natural\s+beauty|beautiful|viewsheds?|vistas?|visual\s+(?:character|quality|resources?|appearance))`),
  rule(SCENIC, 'viewshed', String.raw`\bviewsheds?\b`),
  rule(SCENIC, 'highway / roadway beautification',
    String.raw`(?:highway|roadway|corridor|gateway)s?\s+beautification|beautification\s+of\s+(?:the\s+)?(?:highway|roadway|corridor|gateway)`),
  rule(SCENIC, 'visual clutter / blight',
    String.raw`visual\s+(?:clutter|blight|pollution|intrusion)|sign\s+clutter|proliferation\s+of\s+(?:signs|billboards)`),
  rule(SCENIC, 'sign proliferation / indiscriminate signs / visual environment',
    String.raw`(?:discourag\w+|reduc\w+|prevent\w*|limit\w*|eliminat\w+)\s+(?:the\s+)?sign\s+proliferation|sign\s+proliferation` +
    String.raw`|indiscriminate\s+(?:placement|use|erection)[^.;]{0,30}?signs?` +
    String.raw`|distractions?,?\s+obstructions?,?\s+(?:and|or)\s+hazards?` +
    String.raw`|protect\s+and\s+enhance\s+the\s+(?:physical|visual)\s+appearance` +
    String.raw`|visual\s+environment`),

  // ---- Regulated ----
  rule(REGULATED, 'exceptions (directional / real estate / special event)',
    BB + String.raw`[^.;]{0,200}?except\s+(?:where|as|for|that)[^.;]{0,100}?(?:directional|special\s+event|real\s+estate|temporary)`),
  rule(REGULATED, 'conditional use / variance',
    BB + String.raw`[^.;]{0,120}?(?:conditional\s+use|special\s+exception|use\s+variance|d\(\d\)\s+variance)`),
  rule(REGULATED, 'spacing / setback',
    String.raw`(?:` + BB + String.raw`[^.;]{0,100}?(?:spacing|spaced|separated|separation|setback|minimum\s+distance|within\s+\d[\d,]*\s*(?:feet|ft))` +
    String.raw`|(?:spacing|separation|setback|minimum\s+distance)[^.;]{0,80}?` + BB + ')'),
  rule(REGULATED, 'size / height limits',
    BB + String.raw`[^.;]{0,120}?(?:maximum|not\s+(?:to\s+)?exceed|no\s+(?:larger|taller|higher)\s+than)[^.;]{0,40}?(?:square\s+feet|sq\.?\s*ft|feet|ft\.)`),
  rule(REGULATED, 'limited to certain zones / roads',
    BB + String.raw`[^.;]{0,100}?(?:limited|restricted|confined|permitted\s+only)\s+(?:to|in|along|on)`),

  // ---- Permitted ----
  rule(PERMITTED, 'billboards permitted / allowed',
    BB + String.raw`[^.;]{0,60}?\b(?:are|is|shall\s+be|may\s+be|shall\s+only\s+be)\s+(?:a\s+)?(?:permitted|allowed|conditionally\s+permitted)(?!\s+use\s+variance)`),
  rule(PERMITTED, 'permitted use list includes billboards',
    String.raw`permitted\s+(?:principal\s+)?uses?[^.]{0,300}?` + BB),

  // ---- State / federal ----
  rule(STATE, 'NJ roadside sign control',
    String.raw`N\.?J\.?A\.?C\.?\s*16:41C|Roadside\s+Sign\s+Control|Outdoor\s+Advertising\s+(?:Control|Act)|Highway\s+Beautification\s+Act|N\.?J\.?S\.?A\.?\s*27:5`),

  // ---- Land-restriction overlays that also bite landowners ----
  rule(OVERLAY, 'Highlands / Green Acres / farmland preservation',
    String.raw`Highlands\s+(?:Water\s+Protection|Preservation\s+Area|Planning\s+Area|Region|Council|Act)|Green\s+Acres|farmland\s+preservation|conservation\s+easement`),
];

const NEGATION_BEFORE = /(?:\bnot|\bno|\bnever|\bun)\s*(?:be\s+)?$/i;
const SNIPPET_PAD = 230, MAX_PER_CATEGORY = 25, MIN_GAP = 280;

export function normalize(text) {
  return String(text).replace(/ /g, ' ').replace(/’/g, "'")
    .replace(/-\n(?=[a-z])/g, '')            // PDF hyphenation
    .replace(/\s+/g, ' ').trim();
}

export function snippet(text, start, end) {
  let a = Math.max(0, start - SNIPPET_PAD), b = Math.min(text.length, end + SNIPPET_PAD);
  if (a > 0) {
    const sp = text.indexOf(' ', a);
    a = sp >= 0 && sp < start ? sp + 1 : a;
  }
  if (b < text.length) {
    const sp = text.lastIndexOf(' ', b);
    b = sp > end && sp >= end ? sp : b;
  }
  return (a > 0 ? '… ' : '') + text.slice(a, b).trim() + (b < text.length ? ' …' : '');
}

/** Findings for one document's raw text. */
export function analyze(raw) {
  const text = normalize(raw);
  const hits = [];
  for (const r of RULES) {
    r.re.lastIndex = 0;
    let m;
    while ((m = r.re.exec(text)) !== null) {
      if (m[0].length === 0) { r.re.lastIndex++; continue; }
      hits.push({ start: m.index, end: m.index + m[0].length, r });
    }
  }
  hits.sort((x, y) => x.start - y.start || (y.end - y.start) - (x.end - x.start));

  const out = [], lastPos = {}, counts = {};
  for (const { start, end, r } of hits) {
    const cat = r.category;
    if ((counts[cat] || 0) >= MAX_PER_CATEGORY) continue;
    if (start - (lastPos[cat] ?? -1e9) < MIN_GAP) continue;
    const matched = text.slice(start, end);
    if (cat === PERMITTED && NEGATION_BEFORE.test(text.slice(Math.max(0, start - 25), start))) continue;
    if (cat === PERMITTED && /\bnot\b/i.test(matched)) continue;
    const win = text.slice(Math.max(0, start - 400), Math.min(text.length, end + 400));
    const near = cat === SCENIC || cat === OVERLAY ? BB_RE.test(win) : true;
    out.push({
      category: cat, rule: r.name, strong: r.strong ? 1 : 0, near_billboard: near ? 1 : 0,
      position: start, snippet: snippet(text, start, end), match: matched.slice(0, 200),
    });
    lastPos[cat] = start;
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return out;
}

/** One county's findings -> a single status. */
export function rollup(findings, docCount) {
  if (docCount === 0) return ['no_data', 'No documents collected yet'];
  if (!findings.length) return ['no_signal', 'Documents collected, no billboard language found'];
  const by = {};
  for (const f of findings) (by[f.category] ||= []).push(f);
  const prohibited = by[PROHIBITED] || [], permitted = by[PERMITTED] || [], regulated = by[REGULATED] || [];
  const scenicBb = (by[SCENIC] || []).filter((x) => x.near_billboard);
  if (prohibited.length && permitted.length) return ['mixed', 'Both prohibition and permission language found — read the snippets'];
  if (prohibited.length) return ['prohibited', `${prohibited.length} prohibition passage(s)`];
  if (regulated.length || scenicBb.length) {
    const bits = [];
    if (regulated.length) bits.push(`${regulated.length} regulation passage(s)`);
    if (scenicBb.length) bits.push(`${scenicBb.length} scenic-preservation passage(s) near sign/billboard text`);
    return ['restricted', bits.join('; ')];
  }
  if (permitted.length) return ['permitted', `${permitted.length} permission passage(s)`];
  if (by[SCENIC]) return ['scenic', 'Scenic/visual language, not tied to billboards'];
  return ['no_signal', 'Only state-law or overlay references found'];
}
