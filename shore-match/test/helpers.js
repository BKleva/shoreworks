const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.SHOREMATCH_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'shorematch-test-'));
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret';
process.env.ADMIN_EMAILS = 'admin@example.com';
delete process.env.NETLIFY;

const { handler } = require('../netlify/functions/api');

let ipCounter = 0;

// A tiny "browser": keeps a cookie jar and talks to the handler directly.
class Client {
  constructor() {
    this.cookie = '';
    this.ip = `10.0.0.${++ipCounter}`;
  }
  async req(method, url, body) {
    const u = new URL(url, 'http://localhost');
    const res = await handler({
      httpMethod: method,
      path: u.pathname,
      headers: { cookie: this.cookie, host: 'localhost', 'x-nf-client-connection-ip': this.ip },
      queryStringParameters: Object.fromEntries(u.searchParams),
      body: body === undefined ? null : JSON.stringify(body)
    });
    const set = res.headers['Set-Cookie'];
    if (set) this.cookie = set.startsWith('sm_session=;') ? '' : set.split(';')[0];
    return { status: res.statusCode, body: JSON.parse(res.body) };
  }
  get(u) { return this.req('GET', u); }
  post(u, b) { return this.req('POST', u, b || {}); }
  put(u, b) { return this.req('PUT', u, b || {}); }
  del(u) { return this.req('DELETE', u); }
}

let n = 0;
async function signup(role, extra = {}) {
  const c = new Client();
  const email = extra.email || `${role}${++n}@example.com`;
  const r = await c.post('/api/auth/signup', {
    name: `${role} ${n}`, email, password: 'password123', role, agree: true,
    accreditedAck: role === 'investor', ...extra
  });
  if (r.status !== 201) throw new Error('signup failed ' + JSON.stringify(r));
  c.user = r.body.user;
  return c;
}

const startupProfile = (o = {}) => ({
  companyName: 'Tidal Roasters', tagline: 'Small-batch coffee roasted at the shore', town: 'Asbury Park',
  industry: 'Hospitality & Food', website: 'tidalroasters.example', ...o
});
const investorProfile = (o = {}) => ({
  displayName: 'Dana Whitfield', firm: 'Boardwalk Angels', bio: 'Former restaurateur backing local food and retail.',
  town: 'Belmar', industries: ['Hospitality & Food'], stages: ['early-revenue'], instruments: ['equity', 'safe'],
  checkMin: 10000, checkMax: 50000, ...o
});
const proposal = (o = {}) => ({
  title: 'Second roastery location', summary: 'Opening a second roastery and cafe to double capacity.',
  industry: 'Hospitality & Food', stage: 'early-revenue', instrument: 'safe', ask: 100000, minCheck: 10000,
  status: 'open', ...o
});

module.exports = { Client, signup, startupProfile, investorProfile, proposal };
