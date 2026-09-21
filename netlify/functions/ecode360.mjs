// OPTIONAL upgrade path — not used by default. run.mjs reads eCode360
// pages the same free way it reads Municode and American Legal (see
// web-search.mjs): found via search, fetched as a plain public page,
// no account needed. This file is only useful if you later get real
// eCode360 API credentials (see README's outreach-draft.md) and want
// more structured search results than the page-scraping path gives —
// swap crawlOrdinanceForTown in run.mjs to call searchEcode360() for
// eCode360-hosted towns specifically, if/when that happens.
//
// Real integration with eCode360's own developer API — the platform
// hosts the majority of NJ municipal codes, and unlike Municode/AmLegal
// it publishes an actual documented API (developer.ecode360.com) rather
// than requiring HTML scraping:
//   - key/secret pair sent as HTTP headers on every request
//   - a search endpoint that returns structured hits: title, section
//     number, type, url, isPdf, a text snippet, and a "hit map"
//
// PREREQUISITE: this needs real eCode360 API credentials, which means
// requesting API access from General Code (not self-serve — see
// outreach-draft.md). Set ECODE360_API_KEY / ECODE360_API_SECRET once
// you have them.
//
// NOTE: I found this API's existence and shape via search results
// (developer.ecode360.com's own description of it), not by calling it
// — this sandbox can't reach ecode360.com at all (confirmed earlier).
// The exact request shape (header names, endpoint path) below is my
// best-faith reconstruction and should be checked against the real
// docs at developer.ecode360.com once you have credentials, before
// this runs unattended.

const API_BASE = "https://api.ecode360.com"; // confirm against developer.ecode360.com

function authHeaders() {
  const key = process.env.ECODE360_API_KEY;
  const secret = process.env.ECODE360_API_SECRET;
  if (!key || !secret) {
    throw new Error("ECODE360_API_KEY / ECODE360_API_SECRET are not set.");
  }
  return { "X-Api-Key": key, "X-Api-Secret": secret };
}

/**
 * Searches one municipality's eCode360 code for `query` and returns
 * the raw hits the API gives back (title, section number, url,
 * snippet, etc.) — phrase matching against the full section text
 * happens one level up, in run.mjs, using phrases.mjs.
 *
 * `codeId` is the numeric/slug identifier eCode360 assigns each
 * municipality's code — this typically shows up in that town's
 * ecode360.com URLs (the DCA directory's codeUrl for eCode360 towns
 * should contain it).
 */
export async function searchEcode360(codeId, query) {
  const url = `${API_BASE}/codes/${encodeURIComponent(codeId)}/search?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`eCode360 search failed for code ${codeId}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
}

/**
 * Extracts a numeric eCode360 code id from a town's code URL, e.g.
 * "https://ecode360.com/WA1234" or "https://ecode360.com/9589971" ->
 * the id segment. Falls back to null if the shape doesn't match.
 */
export function extractCodeId(ecode360Url) {
  const m = String(ecode360Url).match(/ecode360\.com\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}
