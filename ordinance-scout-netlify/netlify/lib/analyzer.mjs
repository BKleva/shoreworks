// Keyword screen for billboard-relevant language. Port of the Python analyzer: same rules, same output.
// A screen, not legal analysis: every finding carries the surrounding text so a person can read it.

const BB = String.raw`(?:billboards?|off[- ]?(?:premises?|site)\s+(?:signs?|advertising|advertisements?)` +
  String.raw`|outdoor\s+advertising(?:\s+(?:signs?|structures?))?|advertising\s+(?:signs?|structures?)` +
  String.raw`|third[- ]party\s+(?:signs?|advertising)|freestanding\s+off[- ]premises?` +
  String.raw`|signs?\s+(?:\w+\s+){0,2}?off\s+(?:of\s+)?the\s+premises)`;
const BB_RE = new RegExp(BB, 'i');
const NEAR_RE = new RegExp(BB + String.raw`|\bsigns?\b|\bsignage\b`, 'i');

export const PROHIBITED = 'prohibited', NO_SIGNAGE = 'no_signage', SCENIC = 'scenic', REGULATED = 'regulated', PERMITTED = 'permitted';

export const CATEGORY_LABELS = {
  [PROHIBITED]: 'Billboards prohibited',
  [NO_SIGNAGE]: 'Signs prohibited (no signage)',
  [PERMITTED]: 'Billboards permitted',
  [REGULATED]: 'Billboards regulated (conditions, spacing, size)',
  [SCENIC]: 'Discourages signs / protects views (policy)',
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

  // ---- Signs prohibited in general (not only billboards) ----
  rule(NO_SIGNAGE, 'signage / signs prohibited',
    String.raw`\b(?:signage|signs?)\s+(?:of\s+any\s+(?:kind|type|description)\s+)?(?:is|are|shall\s+be)\s+(?:hereby\s+|strictly\s+|expressly\s+)?(?:prohibited|forbidden|not\s+(?:be\s+)?permitted|not\s+allowed)(?:\s+(?:in|on|within|along)\s+[^.;]{0,80})?`, true),
  rule(NO_SIGNAGE, 'no signs shall be erected / displayed',
    String.raw`\bno\s+(?:signs?|signage)\s+(?:of\s+any\s+(?:kind|type|description)\s+)?(?:shall|will|may)\s+be\s+(?:erected|placed|posted|displayed|installed|permitted|allowed)\s+(?:in|within|along)\s+(?=[^.;]{0,80}?\b(?:zones?|districts?|corridors?|areas?|overlay|township|borough|town|city|municipality|highways?|routes?|roadways?|right[- ]of[- ]way)\b)[^.;]{0,80}`, true),

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

const ALL_ZONES = /\b(?:any|all|every)\s+(?:zone|zoning|district|zone\s+district)s?\b|\bthroughout\s+the\s+(?:township|borough|town|city|municipality|village)\b|\bwithin\s+the\s+(?:township|borough|town|city|municipality|village)\b/i;
const SOME_ZONES = /\b(?:only|limited\s+to|restricted\s+to|except)\b|(?:in|within)\s+(?:the\s+)?[A-Z0-9][\w-]*\s+(?:zone|district)/;

// "No sign, including billboards, shall exceed 250 sq ft", "No billboard ... on a right-of-way": limits on size or placement, not a ban
const RESTRICTS = /\b(?:exceed\w*|except|unless|provided|that\s+(?:are|is)|which|painted|attached|overhang\w*|right[- ]of[- ]way|within\s+\d|closer\s+than|more\s+than|per\s+lot|any\s+lot|a\s+lot|each\s+(?:side|face)|square\s+feet|feet)\b/i;
// a modifier before "signs" ("illuminated signs are not permitted", "freestanding signs ...") means a type of sign, not signs in general
const SIGN_MODIFIER_OK = /^(?:all|any|the|of|and|such|these|those|no|that|nor|or|other|signs?|signage|prohibited|following)$/i;
const NOT_MORE = /\b(?:no\s+more\s+than|not\s+more\s+than|more\s+than|only\s+one|one\s+\(1\)|maximum\s+of)\b[^.;]{0,25}$/i;

function stanceOf(cat, ruleName) {
  if (cat === PERMITTED) return 'positive';
  if (cat === REGULATED) return ruleName.startsWith('conditional use') ? 'positive' : 'neutral';
  return 'negative'; // prohibited, no_signage, scenic (policy that discourages signs)
}

/** What kind of document this is, judged from its own wording (the file name alone is not reliable).
 *  'ordinance' = actual code text; 'master_plan' = policy / planning document; 'other'. */
export function docBasis(docType, text) {
  if (docType === 'ordinance') return 'ordinance';
  const t = text.length > 400000 ? text.slice(0, 400000) : text;
  const law = (t.match(/§|\bbe\s+it\s+ordained\b|\bshall\s+be\s+unlawful\b|\bviolations?\s+and\s+penalt|\bpermitted\s+(?:principal\s+)?uses?\b|\bconditional\s+uses?\b|\bchapter\s+\d+[\s.:-]|\barticle\s+[ivxlc\d]+\b|\bordinance\s+no\.?/gi) || []).length;
  const plan = (t.match(/\bgoals?\b|\bobjectives?\b|\brecommend\w*|\bvision\b|\bre-?examination\b|\bmaster\s+plan\b/gi) || []).length;
  const adopted = (t.match(/\bOrdinance:?\s*(?:No\.?\s*)?\d{2,4}-\d+|Public\s+Hearing\s+Date|Date\s+Adoption\s+Filed|\bAdopted\s+(?:on|date)/gi) || []).length;
  if (adopted >= 4) return 'ordinance';   // a record of adopted ordinances
  if (law >= 25 && law > plan) return 'ordinance';
  if (docType === 'master_plan' || plan >= 8) return 'master_plan';
  return docType === 'other' && law >= 10 ? 'ordinance' : 'other';
}

/** Findings for one document's raw text. `basis` is docBasis(...). */
export function analyze(raw, basis = 'other') {
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
    let cat2 = cat, rname = r.name, strong = r.strong;
    if (cat === NO_SIGNAGE) {
      const pre = text.slice(Math.max(0, start - 30), start).replace(/\s+$/, '');
      const w = /([A-Za-z-]+)$/.exec(pre);
      if (w && !SIGN_MODIFIER_OK.test(w[1])) continue;
    }
    if (cat === PERMITTED && NOT_MORE.test(text.slice(Math.max(0, start - 45), start))) continue;
    if (cat === PROHIBITED && r.name !== 'listed among prohibited signs') {   // a list of banned signs may itself contain "except ..."
      const sentence = matched + ' ' + text.slice(end, end + 120).split(/[.;]/)[0];
      if (RESTRICTS.test(sentence)) { cat2 = REGULATED; rname = 'restricts size or placement of billboards'; strong = false; }
    }
    const win = text.slice(Math.max(0, start - 400), Math.min(text.length, end + 400));
    const near = cat === SCENIC ? BB_RE.test(win) : true;
    if (cat === SCENIC && !near) continue;
    if (cat2 !== cat && (counts[cat2] || 0) >= MAX_PER_CATEGORY) continue;   // scenery language only counts when it sits next to billboard wording
    const around = text.slice(Math.max(0, start - 60), Math.min(text.length, end + 80));
    out.push({
      category: cat2, rule: rname, strong: strong ? 1 : 0, near_billboard: near ? 1 : 0,
      stance: stanceOf(cat2, rname), basis,
      scope: ALL_ZONES.test(around) ? 'all_zones' : SOME_ZONES.test(around) ? 'some_zones' : 'unspecified',
      position: start, snippet: snippet(text, start, end), match: matched.slice(0, 200),
    });
    lastPos[cat] = start;
    counts[cat2] = (counts[cat2] || 0) + 1;
  }
  return out;
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function readFindings(list) {
  return {
    ban: list.filter((f) => f.category === PROHIBITED),
    nosign: list.filter((f) => f.category === NO_SIGNAGE),
    allow: list.filter((f) => f.category === PERMITTED || (f.category === REGULATED && f.stance === 'positive')),
    rules: list.filter((f) => f.category === REGULATED),
    policy: list.filter((f) => f.category === SCENIC),
  };
}

/** One township's (or county's) findings -> a verdict.
 *  Returns [status, reason, basis]. status is one of
 *    welcoming (+)  conditional (+, with rules)  restrictive (alert)  mixed (+ and alert)  leaning (alert, policy only)  no_signal  no_data
 *  Only actual ordinance text can make a town "restrictive"/"welcoming"; master-plan wording alone is reported as policy. */
export function rollup(findings, docCount) {
  if (docCount === 0) return ['no_data', 'No documents yet', 'none'];
  const ord = readFindings(findings.filter((f) => f.basis === 'ordinance'));
  const pol = readFindings(findings.filter((f) => f.basis !== 'ordinance'));

  if (ord.ban.length && ord.allow.length) return ['mixed', `Ordinance text both prohibits billboards (${plural(ord.ban.length, 'passage')}) and permits them (${plural(ord.allow.length, 'passage')}), probably by area. Read the passages.`, 'ordinance'];
  if (ord.ban.length) return ['restrictive', `Ordinance text prohibits billboards (${plural(ord.ban.length, 'passage')})${ord.ban.some((f) => f.scope === 'all_zones') ? ', in every district' : ''}.`, 'ordinance'];
  if (ord.allow.length) return ['welcoming', `Ordinance text permits billboards (${plural(ord.allow.length, 'passage')}).`, 'ordinance'];
  if (ord.rules.length) return ['conditional', `Ordinance text regulates billboards (spacing, size or conditions), so they are allowed with rules (${plural(ord.rules.length, 'passage')}).`, 'ordinance'];
  if (ord.nosign.length) return ['leaning', `Ordinance text prohibits signs in some areas (${plural(ord.nosign.length, 'passage')}); not billboard-specific.`, 'ordinance'];

  if (pol.ban.length || pol.nosign.length || pol.policy.length) {
    const n = pol.ban.length + pol.nosign.length + pol.policy.length;
    return ['leaning', `Master plan / policy wording discourages signs or billboards (${plural(n, 'passage')}). Not ordinance text, so the actual law is unconfirmed.`, 'master_plan'];
  }
  if (pol.allow.length || pol.rules.length) return ['conditional', `Planning documents mention billboards being allowed or regulated (${plural(pol.allow.length + pol.rules.length, 'passage')}); the ordinance itself is unconfirmed.`, 'master_plan'];
  return ['no_signal', 'Documents collected, but none has billboard or sign-prohibition wording. The sign ordinance itself may not be among them.', 'none'];
}
