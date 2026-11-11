// Explainable match score between a funding proposal and an investor profile.
// Deliberately simple and transparent: users see *why* something matched,
// which builds trust far more than an opaque number.
//
//   industry 30  | stage 25 | cheque size 20 | location 15 | instrument 10

const { stages } = require('./config');
const stageIndex = (id) => stages.findIndex((s) => s.id === id);

function scoreMatch(proposal, investor) {
  const reasons = [];
  let score = 0;
  const inv = investor || {};

  // Industry
  const inds = inv.industries || [];
  if (!inds.length) {
    score += 18;
    reasons.push('Invests across industries');
  } else if (inds.includes(proposal.industry)) {
    score += 30;
    reasons.push(`Invests in ${proposal.industry}`);
  }

  // Stage
  const st = inv.stages || [];
  if (!st.length) {
    score += 15;
  } else if (st.includes(proposal.stage)) {
    score += 25;
    reasons.push('Backs this stage');
  } else {
    const pi = stageIndex(proposal.stage);
    if (st.some((s) => Math.abs(stageIndex(s) - pi) === 1)) {
      score += 10;
      reasons.push('Close to preferred stage');
    }
  }

  // Cheque size: investor's range must overlap what the startup will accept.
  const ask = proposal.ask || 0;
  const minCheck = proposal.minCheck || 0;
  const lo = inv.checkMin || 0;
  const hi = inv.checkMax || Infinity;
  if (ask && lo <= ask && hi >= (minCheck || 1)) {
    score += 20;
    reasons.push('Check size fits');
  } else if (!inv.checkMin && !inv.checkMax) {
    score += 10;
  }

  // Location
  const pt = (proposal.town || '').toLowerCase();
  const it = (inv.town || '').toLowerCase();
  if (pt && it && pt === it) {
    score += 15;
    reasons.push(`Both in ${proposal.town}`);
  } else if (pt && it) {
    score += 6;
    reasons.push('Both in the region');
  } else {
    score += 4;
  }

  // Instrument
  const ins = inv.instruments || [];
  if (!ins.length || ins.includes('open') || proposal.instrument === 'open' || ins.includes(proposal.instrument)) {
    score += 10;
    if (ins.includes(proposal.instrument)) reasons.push('Preferred deal type');
  }

  return { score: Math.min(100, Math.round(score)), reasons };
}

module.exports = { scoreMatch };
