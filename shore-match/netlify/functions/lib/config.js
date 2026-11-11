// Single place to tune the platform for a region / niche.
// The frontend fetches this from GET /api/config so both sides stay in sync.

module.exports = {
  regionName: 'Jersey Shore',
  platformName: 'Shore Match',

  industries: [
    'Hospitality & Food',
    'Retail & E-commerce',
    'Real Estate & Construction',
    'Marine & Outdoor',
    'Health & Wellness',
    'Software & Tech',
    'Professional Services',
    'Manufacturing',
    'Clean Energy',
    'Education',
    'Media & Entertainment',
    'Other'
  ],

  stages: [
    { id: 'idea', label: 'Idea / pre-launch' },
    { id: 'pre-revenue', label: 'Built, pre-revenue' },
    { id: 'early-revenue', label: 'Early revenue' },
    { id: 'growth', label: 'Growing' },
    { id: 'established', label: 'Established, expanding' }
  ],

  instruments: [
    { id: 'equity', label: 'Equity' },
    { id: 'safe', label: 'SAFE' },
    { id: 'convertible-note', label: 'Convertible note' },
    { id: 'revenue-share', label: 'Revenue share' },
    { id: 'loan', label: 'Loan / debt' },
    { id: 'open', label: 'Open to discuss' }
  ],

  // Used as suggestions in forms; location fields stay free text so
  // the platform can expand without code changes.
  towns: [
    'Asbury Park', 'Belmar', 'Brick', 'Point Pleasant', 'Manasquan', 'Toms River',
    'Long Branch', 'Red Bank', 'Neptune', 'Ocean City', 'Atlantic City', 'Cape May',
    'Wildwood', 'Long Beach Island', 'Sea Bright', 'Freehold', 'Other'
  ],

  // Investor-side deal pipeline. "new" is the default for any new connection.
  pipelineStages: [
    { id: 'new', label: 'New' },
    { id: 'reviewing', label: 'Reviewing' },
    { id: 'meeting', label: 'Meeting' },
    { id: 'diligence', label: 'Due diligence' },
    { id: 'committed', label: 'Committed' },
    { id: 'passed', label: 'Passed' }
  ],

  proposalStatuses: [
    { id: 'draft', label: 'Draft (private)' },
    { id: 'open', label: 'Open to investors' },
    { id: 'funded', label: 'Funded' },
    { id: 'closed', label: 'Closed' }
  ]
};
