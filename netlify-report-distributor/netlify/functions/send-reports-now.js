const crypto = require('crypto');
const { runReports } = require('../../lib/run-reports');

function checkAuth(event) {
  const provided = event.headers['x-admin-password'] || '';
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Manual "send now" trigger for the admin page — sends the same prior-month
// report the scheduled function would send, on demand. Pass { client_id }
// in the body to send just that one client; omit it to send to everyone.
exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!checkAuth(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  let clientId = null;
  if (event.body) {
    try {
      clientId = JSON.parse(event.body).client_id || null;
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
  }
  try {
    const summary = await runReports(new Date(), clientId);
    return { statusCode: 200, body: JSON.stringify(summary) };
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
  }
};
