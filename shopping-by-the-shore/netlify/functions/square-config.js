// Public (non-secret) Square settings the browser needs to render the card form.
// If any are missing the site falls back to "demo mode" (no card collected).
const { SQUARE_ENV } = require('./lib/square');

exports.handler = async () => {
  const appId = process.env.SQUARE_APP_ID;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const configured = Boolean(appId && locationId && process.env.SQUARE_ACCESS_TOKEN);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(
      configured ? { configured: true, appId, locationId, environment: SQUARE_ENV } : { configured: false }
    )
  };
};
