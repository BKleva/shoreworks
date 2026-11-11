const MAX_BODY = 200 * 1024;

function json(statusCode, data, extraHeaders) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(extraHeaders || {}) },
    body: JSON.stringify(data)
  };
}

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function header(event, name) {
  const h = event.headers || {};
  const lower = name.toLowerCase();
  for (const k of Object.keys(h)) if (k.toLowerCase() === lower) return h[k];
  return undefined;
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  if (raw.length > MAX_BODY) throw new HttpError(413, 'Request too large');
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch (e) {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function clientIp(event) {
  return header(event, 'x-nf-client-connection-ip') ||
    (header(event, 'x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown';
}

// CSRF defence in depth (cookie is SameSite=Lax as well): state-changing
// requests must be JSON and, if the browser sent an Origin, it must be ours.
function assertSameOrigin(event) {
  const origin = header(event, 'origin');
  if (!origin) return;
  const host = header(event, 'x-forwarded-host') || header(event, 'host');
  let originHost;
  try { originHost = new URL(origin).host; } catch (e) { throw new HttpError(403, 'Bad origin'); }
  if (host && originHost !== host) throw new HttpError(403, 'Cross-origin request blocked');
}

module.exports = { json, HttpError, header, parseBody, clientIp, assertSameOrigin };
