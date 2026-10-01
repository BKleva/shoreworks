const { runReports } = require('../../lib/run-reports');

// Scheduled (see netlify.toml) — runs 1st of every month, emails every
// client their prior-month traffic report.
exports.handler = async function () {
  const summary = await runReports();
  console.log(`Sent ${summary.period} reports:`, JSON.stringify(summary.results));
  return { statusCode: 200, body: JSON.stringify(summary) };
};
