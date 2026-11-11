const test = require('node:test');
const assert = require('node:assert');
const { scoreMatch } = require('../netlify/functions/lib/match');

const pr = { industry: 'Marine & Outdoor', stage: 'early-revenue', instrument: 'equity', ask: 100000, minCheck: 10000, town: 'Belmar' };

test('perfect match scores 100', () => {
  const m = scoreMatch(pr, { industries: ['Marine & Outdoor'], stages: ['early-revenue'], instruments: ['equity'], checkMin: 5000, checkMax: 50000, town: 'Belmar' });
  assert.strictEqual(m.score, 100);
  assert.ok(m.reasons.length >= 4);
});

test('wrong industry/stage/size scores far lower', () => {
  const good = scoreMatch(pr, { industries: ['Marine & Outdoor'], stages: ['early-revenue'], checkMin: 5000, checkMax: 50000, town: 'Belmar' });
  const bad = scoreMatch(pr, { industries: ['Software & Tech'], stages: ['idea'], checkMin: 500000, checkMax: 900000, town: 'Cape May' });
  assert.ok(bad.score < good.score - 50, `${bad.score} vs ${good.score}`);
});

test('adjacent stage earns partial credit', () => {
  const adj = scoreMatch(pr, { industries: ['Marine & Outdoor'], stages: ['growth'] });
  const none = scoreMatch(pr, { industries: ['Marine & Outdoor'], stages: ['idea'] });
  assert.ok(adj.score > none.score);
});

test('empty preferences count as generalist, never crash', () => {
  const m = scoreMatch(pr, {});
  assert.ok(m.score > 0 && m.score <= 100);
  assert.doesNotThrow(() => scoreMatch(pr, undefined));
});

test('check size too small for the minimum is not a fit', () => {
  const m = scoreMatch({ ...pr, minCheck: 50000 }, { industries: [], checkMin: 1000, checkMax: 10000 });
  assert.ok(!m.reasons.includes('Check size fits'));
});
