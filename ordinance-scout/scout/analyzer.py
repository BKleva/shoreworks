"""Rule-based screening of ordinance / master plan text for billboard-relevant language.

This is a keyword screen, not legal analysis. Every finding carries the surrounding
text so a human can read the actual sentence before relying on it.
"""
import re
from dataclasses import dataclass

# What counts as "billboard-like" wording.
BB = (r"(?:billboards?|off[- ]?(?:premises?|site)\s+(?:signs?|advertising|advertisements?)"
      r"|outdoor\s+advertising(?:\s+(?:signs?|structures?))?|advertising\s+(?:signs?|structures?)"
      r"|third[- ]party\s+(?:signs?|advertising)|freestanding\s+off[- ]premises?"
      r"|signs?\s+(?:\w+\s+){0,2}?off\s+(?:of\s+)?the\s+premises)")
BB_RE = re.compile(BB, re.I)
NEAR_RE = re.compile(BB + r"|\bsigns?\b|\bsignage\b", re.I)

PROHIBITED = "prohibited"
SCENIC = "scenic"
REGULATED = "regulated"
PERMITTED = "permitted"
STATE = "state_law"
OVERLAY = "land_restriction"

CATEGORY_LABELS = {
    PROHIBITED: "Billboards prohibited",
    SCENIC: "Scenic / visual preservation",
    REGULATED: "Regulated (conditions, spacing, size)",
    PERMITTED: "Billboards permitted",
    STATE: "State / federal sign law",
    OVERLAY: "Land restriction overlay",
}


@dataclass
class Rule:
    category: str
    name: str
    pattern: re.Pattern
    strong: bool = False          # explicit, unambiguous wording
    needs_bb: bool = False        # SCENIC/OVERLAY rules are flagged, not required, to sit near billboard text


def _r(category, name, pattern, strong=False):
    return Rule(category, name, re.compile(pattern, re.I | re.S), strong)


_NOT_QUANT = r"(?!\s*(?:more|less|closer|greater|fewer|larger|taller|higher|lower|smaller|sign\s+shall\s+exceed))"

RULES = [
    # ---- Prohibited ----
    _r(PROHIBITED, "billboards prohibited / not permitted",
       rf"{BB}[^.;]{{0,80}}?\b(?:(?:is|are|shall\s+be|shall\s+remain|be)\s+)?(?:expressly\s+|hereby\s+|specifically\s+|strictly\s+)?"
       rf"(?:prohibited|forbidden|banned|unlawful|not\s+(?:be\s+)?(?:permitted|allowed))", strong=True),
    _r(PROHIBITED, "no billboards / prohibit billboards",
       rf"\b(?:no{_NOT_QUANT}|prohibit\w*|ban(?:s|ned)?|forbid\w*|disallow\w*)\b[^.;]{{0,50}}?{BB}", strong=True),
    _r(PROHIBITED, "listed among prohibited signs",
       rf"(?:following|these|such)\s+(?:types\s+of\s+)?signs?[^.]{{0,60}}?(?:prohibited|not\s+permitted|unlawful)[\s\S]{{0,500}}?{BB}"),
    _r(PROHIBITED, "billboards not a permitted use",
       rf"{BB}[^.;]{{0,60}}?not\s+(?:a\s+)?(?:permitted|allowed)\s+(?:principal\s+|accessory\s+)?(?:use|in\s+any)", strong=True),

    _r(PROHIBITED, "off the premises, not permitted in any zone",
       rf"{BB}[^.;]{{0,150}}?(?:not\s+(?:be\s+)?permitted|prohibited|not\s+allowed)\s+in\s+(?:any|all|every)\s+(?:zone|zoning|district)s?", strong=True),

    # ---- Scenic / visual preservation ----
    _r(SCENIC, "scenic highway / corridor / view",
       r"scenic\s+(?:highways?|byways?|corridors?|roads?|roadways?|routes?|views?|vistas?|resources?|gateways?|and\s+historic)"),
    _r(SCENIC, "preserve scenic / beautiful",
       r"(?:preserv\w+|protect\w+|conserv\w+|maintain\w*|enhanc\w+|safeguard\w*)[^.;]{0,60}?"
       r"(?:scenic|natural\s+beauty|beautiful|viewsheds?|vistas?|visual\s+(?:character|quality|resources?|appearance))"),
    _r(SCENIC, "viewshed", r"\bviewsheds?\b"),
    _r(SCENIC, "highway / roadway beautification",
       r"(?:highway|roadway|corridor|gateway)s?\s+beautification|beautification\s+of\s+(?:the\s+)?(?:highway|roadway|corridor|gateway)"),
    _r(SCENIC, "visual clutter / blight",
       r"visual\s+(?:clutter|blight|pollution|intrusion)|sign\s+clutter|proliferation\s+of\s+(?:signs|billboards)"),

    _r(SCENIC, "sign proliferation / indiscriminate signs / visual environment",
       r"(?:discourag\w+|reduc\w+|prevent\w*|limit\w*|eliminat\w+)\s+(?:the\s+)?sign\s+proliferation|sign\s+proliferation"
       r"|indiscriminate\s+(?:placement|use|erection)[^.;]{0,30}?signs?"
       r"|distractions?,?\s+obstructions?,?\s+(?:and|or)\s+hazards?"
       r"|protect\s+and\s+enhance\s+the\s+(?:physical|visual)\s+appearance"
       r"|visual\s+environment"),

    # ---- Regulated ----
    _r(REGULATED, "exceptions (directional / real estate / special event)",
       rf"{BB}[^.;]{{0,200}}?except\s+(?:where|as|for|that)[^.;]{{0,100}}?(?:directional|special\s+event|real\s+estate|temporary)"),
    _r(REGULATED, "conditional use / variance",
       rf"{BB}[^.;]{{0,120}}?(?:conditional\s+use|special\s+exception|use\s+variance|d\(\d\)\s+variance)"),
    _r(REGULATED, "spacing / setback",
       rf"(?:{BB}[^.;]{{0,100}}?(?:spacing|spaced|separated|separation|setback|minimum\s+distance|within\s+\d[\d,]*\s*(?:feet|ft))"
       rf"|(?:spacing|separation|setback|minimum\s+distance)[^.;]{{0,80}}?{BB})"),
    _r(REGULATED, "size / height limits",
       rf"{BB}[^.;]{{0,120}}?(?:maximum|not\s+(?:to\s+)?exceed|no\s+(?:larger|taller|higher)\s+than)[^.;]{{0,40}}?(?:square\s+feet|sq\.?\s*ft|feet|ft\.)"),
    _r(REGULATED, "limited to certain zones / roads",
       rf"{BB}[^.;]{{0,100}}?(?:limited|restricted|confined|permitted\s+only)\s+(?:to|in|along|on)"),

    # ---- Permitted ----
    _r(PERMITTED, "billboards permitted / allowed",
       rf"{BB}[^.;]{{0,60}}?\b(?:are|is|shall\s+be|may\s+be|shall\s+only\s+be)\s+(?:a\s+)?(?:permitted|allowed|conditionally\s+permitted)(?!\s+use\s+variance)"),
    _r(PERMITTED, "permitted use list includes billboards",
       rf"permitted\s+(?:principal\s+)?uses?[^.]{{0,300}}?{BB}"),

    # ---- State / federal ----
    _r(STATE, "NJ roadside sign control",
       r"N\.?J\.?A\.?C\.?\s*16:41C|Roadside\s+Sign\s+Control|Outdoor\s+Advertising\s+(?:Control|Act)|Highway\s+Beautification\s+Act|N\.?J\.?S\.?A\.?\s*27:5"),

    # ---- Land-restriction overlays that also bite landowners ----
    _r(OVERLAY, "Highlands / Green Acres / farmland preservation",
       r"Highlands\s+(?:Water\s+Protection|Preservation\s+Area|Planning\s+Area|Region|Council|Act)|Green\s+Acres|farmland\s+preservation|conservation\s+easement"),
]

_NEGATION_BEFORE = re.compile(r"(?:\bnot|\bno|\bnever|\bun)\s*(?:be\s+)?$", re.I)
SNIPPET_PAD = 230
MAX_PER_CATEGORY = 25
MIN_GAP = 280  # don't emit two findings of one category from the same passage


def normalize(text: str) -> str:
    text = text.replace(" ", " ").replace("’", "'")
    text = re.sub(r"-\n(?=[a-z])", "", text)          # PDF hyphenation
    return re.sub(r"\s+", " ", text).strip()


def _snippet(text, start, end):
    a, b = max(0, start - SNIPPET_PAD), min(len(text), end + SNIPPET_PAD)
    if a > 0:
        sp = text.find(" ", a)
        a = sp + 1 if 0 <= sp < start else a
    if b < len(text):
        sp = text.rfind(" ", end, b)
        b = sp if sp > end else b
    return ("… " if a > 0 else "") + text[a:b].strip() + (" …" if b < len(text) else "")


def analyze(raw_text: str):
    """Return a list of finding dicts for one document."""
    text = normalize(raw_text)
    out, last_pos, counts = [], {}, {}
    hits = []
    for rule in RULES:
        for m in rule.pattern.finditer(text):
            hits.append((m.start(), m.end(), rule))
    hits.sort(key=lambda h: (h[0], -(h[1] - h[0])))

    for start, end, rule in hits:
        cat = rule.category
        if counts.get(cat, 0) >= MAX_PER_CATEGORY:
            continue
        if start - last_pos.get((cat), -10**9) < MIN_GAP:
            continue
        matched = text[start:end]
        if cat == PERMITTED and _NEGATION_BEFORE.search(text[max(0, start - 25):start]):
            continue
        if cat == PERMITTED and re.search(r"\bnot\b", matched, re.I):
            continue
        window = text[max(0, start - 400):min(len(text), end + 400)]
        near = bool(BB_RE.search(window)) if cat in (SCENIC, OVERLAY) else True
        if cat == SCENIC and not near and NEAR_RE.search(window):
            near = False  # generic sign mention only; keep but flag as not billboard-specific
        out.append({
            "category": cat,
            "rule": rule.name,
            "strong": int(rule.strong),
            "near_billboard": int(near),
            "position": start,
            "snippet": _snippet(text, start, end),
            "match": matched[:200],
        })
        last_pos[cat] = start
        counts[cat] = counts.get(cat, 0) + 1
    return out


def rollup(findings, doc_types=None):
    """Summarise one municipality's findings into a single screening status.

    findings: iterable of dicts with category / strong / near_billboard.
    Returns (status, reason) where status is one of
    prohibited | mixed | restricted | scenic | permitted | no_signal | no_data.
    """
    f = list(findings)
    if doc_types is not None and not doc_types:
        return "no_data", "No documents collected yet"
    if not f:
        return "no_signal", "Documents collected, no billboard language found"
    by = {}
    for x in f:
        by.setdefault(x["category"], []).append(x)
    prohibited, permitted = by.get(PROHIBITED, []), by.get(PERMITTED, [])
    regulated = by.get(REGULATED, [])
    scenic_bb = [x for x in by.get(SCENIC, []) if x["near_billboard"]]
    if prohibited and permitted:
        return "mixed", "Both prohibition and permission language found — read the snippets"
    if prohibited:
        return "prohibited", f"{len(prohibited)} prohibition passage(s)"
    if regulated or scenic_bb:
        bits = []
        if regulated:
            bits.append(f"{len(regulated)} regulation passage(s)")
        if scenic_bb:
            bits.append(f"{len(scenic_bb)} scenic-preservation passage(s) near sign/billboard text")
        return "restricted", "; ".join(bits)
    if permitted:
        return "permitted", f"{len(permitted)} permission passage(s)"
    if by.get(SCENIC):
        return "scenic", "Scenic/visual language, not tied to billboards"
    return "no_signal", "Only state-law or overlay references found"
