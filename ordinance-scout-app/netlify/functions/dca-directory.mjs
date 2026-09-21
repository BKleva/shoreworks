// Resolves, for every municipality in scope, WHICH platform hosts its
// code of ordinances (eCode360 / Municode / American Legal / other /
// none online) and the base URL for that town's code.
//
// Source: NJ Dept. of Community Affairs' "Local Code of Ordinances
// Directory" — a spreadsheet DCA maintains and updates, the only
// statewide index of this. Confirmed live at:
//   https://www.nj.gov/dca/library/home/Local_Code_of_Ordinances_Directory.xlsx
// (also mirrored on the DCA ArcGIS data hub). This is the crawler's
// first step for the ordinance side — everything else in ecode360.mjs
// and municode-search.mjs depends on knowing, per town, which of them
// to even ask.
//
// Needs the `xlsx` package (same library already used client-side in
// the app's spreadsheet export) to parse the workbook.

import * as XLSX from "xlsx";

const DIRECTORY_URL = "https://www.nj.gov/dca/library/home/Local_Code_of_Ordinances_Directory.xlsx";

export const COUNTIES_IN_SCOPE = ["Monmouth", "Ocean", "Bergen", "Morris"];

function classifyHost(url) {
  if (!url) return "none";
  const u = url.toLowerCase();
  if (u.includes("ecode360.com")) return "ecode360";
  if (u.includes("municode.com")) return "municode";
  if (u.includes("amlegal.com")) return "amlegal";
  return "other";
}

/**
 * Fetches and parses the DCA directory, returning only the rows for
 * municipalities in `counties` (defaults to COUNTIES_IN_SCOPE).
 *
 * NOTE — not yet run against the live file from inside this dev
 * sandbox: this environment's network policy blocks outbound fetches
 * to arbitrary domains (confirmed against nj.gov directly), so the
 * exact column headers/order below are my best read of the directory
 * as it's publicly described, not something I've been able to open
 * and confirm byte-for-byte. Deployed code (a real server, not this
 * sandbox) will have normal internet access — the first real run
 * should log `Object.keys(row)` once and this function's column-name
 * guesses adjusted to match.
 */
export async function fetchOrdinanceHosts(counties = COUNTIES_IN_SCOPE) {
  const res = await fetch(DIRECTORY_URL);
  if (!res.ok) {
    throw new Error(`DCA directory fetch failed: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const wanted = new Set(counties.map((c) => c.toLowerCase()));

  return rows
    .map((row) => {
      // Column names are DCA's own — confirm against a live row once
      // deployed (see note above) and adjust these keys if they differ.
      const town = row["Municipality"] || row["Municipal Name"] || row["Name"] || "";
      const county = row["County"] || "";
      const codeUrl = row["Code Link"] || row["Ordinance Link"] || row["URL"] || row["Link"] || "";
      return {
        town: String(town).trim(),
        county: String(county).trim(),
        codeUrl: String(codeUrl).trim(),
        host: classifyHost(codeUrl)
      };
    })
    .filter((r) => r.town && wanted.has(r.county.toLowerCase()));
}
