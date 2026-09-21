// Phrase lists the crawler searches for. Kept separate from the crawl
// logic so they can be tuned without touching how any of the sources
// are fetched.
//
// Matching is case-insensitive substring matching (see matchPhrases
// below) rather than a fixed exact string, because real ordinance and
// master plan text phrases the same idea many different ways — see the
// real examples pulled via search in README.md.

export const ORDINANCE_PHRASES = [
  // Direct prohibition language
  "no billboards",
  "billboards are prohibited",
  "billboards shall be prohibited",
  "billboard is prohibited",
  "billboards...prohibited",
  "prohibited...billboards",
  "no new billboard",
  "no billboard shall be",
  "not be permitted",
  "shall not be permitted",
  "further erection...prohibited",
  "construction or enlargement of...billboards...prohibited",
  // Broader off-premises-advertising phrasing that towns use instead
  // of the word "billboard" itself
  "off-premises advertising",
  "off-premise advertising",
  "off-site advertising",
  "outdoor advertising sign",
  "outdoor advertising structure",
  "outdoor advertising is prohibited",
  // The flip side — explicit permission, so the crawler can also flag
  // towns that allow billboards, not just ones that ban them
  "billboards are permitted",
  "permitted as a conditional use",
  "conditional use",
  "permitted principal use"
];

export const SCENIC_PHRASES = [
  "designation of scenic highway",
  "scenic highway",
  "scenic byway",
  "scenic corridor",
  "scenic corridor overlay",
  "scenic vista",
  "scenic view",
  "preserve the scenic",
  "preserves scenic",
  "preservation of scenic",
  "protect the scenic character",
  "scenic quality",
  "scenic resources",
  "scenic easement",
  "viewshed",
  "ridgeline protection",
  "hillside protection"
];

// Sort longest-first so multi-word phrases match before a shorter
// phrase nested inside them steals the highlight (same trick the UI's
// own highlight() function uses).
function bySpecificity(list) {
  return list.slice().sort((a, b) => b.length - a.length);
}

export const ORDINANCE_PHRASES_SORTED = bySpecificity(ORDINANCE_PHRASES);
export const SCENIC_PHRASES_SORTED = bySpecificity(SCENIC_PHRASES);

/**
 * Returns every phrase from `phraseList` found in `text`, plus a short
 * excerpt around the first match of each — enough to show the reader
 * what was actually found without keeping the whole document.
 */
export function matchPhrases(text, phraseList) {
  const hay = text.toLowerCase();
  const hits = [];
  for (const phrase of bySpecificity(phraseList)) {
    const idx = hay.indexOf(phrase.toLowerCase());
    if (idx === -1) continue;
    const start = Math.max(0, idx - 80);
    const end = Math.min(text.length, idx + phrase.length + 80);
    hits.push({
      phrase,
      excerpt: (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "")
    });
  }
  return hits;
}
