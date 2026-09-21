// Fallback — now the PRIMARY path, see README — for locating and
// reading ordinance pages and master plan PDFs with no account of any
// kind: eCode360, Municode, and American Legal Publishing all host
// public government records that anyone can open in a browser with no
// login. The only thing that needs an account is Brave Search itself,
// used here just to find the right page, not to read it.
//
// PREREQUISITE: a Brave Search API key. Google's Custom Search JSON
// API is closed to new customers and Bing's Web Search API was fully
// retired in August 2025 — both dead ends for a fresh signup, so this
// targets Brave Search instead. Sign up at api.search.brave.com
// (self-serve, ~5 minutes, requires a credit card on file — the free
// monthly credit covers roughly 1,000 queries, comfortably more than
// this tool needs for a periodic run across ~80 towns). Set
// BRAVE_SEARCH_API_KEY once you have it.

const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

const HOST_DOMAINS = {
  ecode360: "ecode360.com",
  municode: "library.municode.com",
  amlegal: "codelibrary.amlegal.com"
};

async function braveSearch(query, count = 5) {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    throw new Error("BRAVE_SEARCH_API_KEY is not set.");
  }
  const url = `${BRAVE_ENDPOINT}?q=${encodeURIComponent(query)}&count=${count}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key
    }
  });
  if (!res.ok) {
    throw new Error(`Brave Search failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const results = (data.web && data.web.results) || [];
  return results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description
  }));
}

/**
 * Finds a town's sign/billboard ordinance page on whichever free code
 * host it uses — eCode360, Municode, or American Legal Publishing.
 * `host` is whatever dca-directory.mjs classified the town's code URL
 * as ("ecode360" | "municode" | "amlegal").
 */
export async function findOrdinancePage(town, host) {
  const siteFilter = HOST_DOMAINS[host];
  const site = siteFilter ? `site:${siteFilter} ` : "";
  return braveSearch(`${site}${town} New Jersey billboards signs ordinance`);
}

/** Finds a town's most recent master plan / reexamination report PDF, searching that town's own official site rather than a fixed platform. */
export async function findMasterPlanDocument(town, countyForContext) {
  // No site filter here on purpose — master plans live on whatever
  // domain the town itself uses (…nj.gov, …nj.us, a custom domain),
  // which the DCA directory doesn't tell us. A plain, tightly-worded
  // query is the only option; the caller should sanity-check that the
  // top result's domain plausibly belongs to the town before trusting it.
  return braveSearch(`"${town}" New Jersey master plan reexamination report filetype:pdf`);
}

/**
 * Fetches a public ordinance page (eCode360 / Municode / AmLegal, all
 * freely readable, no login) and strips it down to plain text for
 * phrase matching. Search result snippets alone are too short to
 * reliably match longer phrases like "shall not be permitted" against
 * — this reads the actual page so matching has real text to work with.
 */
export async function fetchPageText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "OrdinanceScoutBot/1.0 (municipal ordinance research)" } });
  if (!res.ok) throw new Error(`Page fetch failed: ${res.status} ${res.statusText}`);
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetches a PDF and extracts its text. Needs a PDF-text library
 * (e.g. `pdf-parse`) in the real deployment — left as a thin wrapper
 * here so run.mjs stays readable; swap the body for whatever library
 * you land on.
 */
export async function fetchPdfText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDF fetch failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { default: pdfParse } = await import("pdf-parse");
  const parsed = await pdfParse(buf);
  return parsed.text;
}
