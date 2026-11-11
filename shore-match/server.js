// Local dev server: static files from /public + the same API function Netlify runs.
//   npm start            -> http://localhost:8888
// Data is stored as JSON files in ./.data (git-ignored).

const http = require('http');
const fs = require('fs');
const path = require('path');
const { handler } = require('./netlify/functions/api');

const PORT = process.env.PORT || 8888;
const PUBLIC = path.join(__dirname, 'public');
// Same CSP as production (netlify.toml) so violations show up locally.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain'
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  let file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html'); // SPA fallback
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Security-Policy': CSP });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const event = {
      httpMethod: req.method,
      path: url.pathname,
      headers: req.headers,
      queryStringParameters: Object.fromEntries(url.searchParams),
      body: Buffer.concat(chunks).toString('utf8') || null
    };
    const out = await handler(event);
    res.writeHead(out.statusCode, out.headers);
    res.end(out.body);
  });
}).listen(PORT, () => console.log(`Shore Match running at http://localhost:${PORT}`));
