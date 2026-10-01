// Start a background function from another function (adds the internal key so it passes the auth check).
export function trigger(origin, name, body) {
  return fetch(new URL(`/.netlify/functions/${name}`, origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-oi-internal': process.env.INTERNAL_KEY || '' },
    body: JSON.stringify(body || {}),
  });
}
export const siteOrigin = (req) => process.env.URL || new URL(req.url).origin;
