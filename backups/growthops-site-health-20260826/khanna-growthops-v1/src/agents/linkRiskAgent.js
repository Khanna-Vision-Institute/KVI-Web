function assessLinkCandidate(candidate) {
  const reasons = [];
  let score = 100;

  if (candidate.sourceType === 'pbn' || candidate.sourceType === 'gsa') {
    score -= 40;
    reasons.push('GSA/PBN source — no direct money-site placement without review');
  }
  if (candidate.spamScore > 30) {
    score -= 30;
    reasons.push(`High spam score (${candidate.spamScore})`);
  }
  if (/exact.?match/i.test(candidate.anchorRisk || '')) {
    score -= 25;
    reasons.push('Exact-match anchor risk');
  }
  if (candidate.relevance < 0.5) {
    score -= 20;
    reasons.push('Low topical relevance to ophthalmology');
  }

  let verdict = 'review';
  if (score < 40) verdict = 'block';
  else if (score < 65) verdict = 'caution';

  return { score, verdict, reasons, candidate };
}

function mockLinkCandidates() {
  return [
    {
      domain: 'visionhealth-example.org',
      sourceType: 'outreach',
      spamScore: 8,
      relevance: 0.82,
      anchorRisk: 'branded',
      target: 'khannainstitute.com',
    },
    {
      domain: 'generic-links-network.net',
      sourceType: 'pbn',
      spamScore: 54,
      relevance: 0.31,
      anchorRisk: 'exact-match lasik los angeles',
      target: 'khannainstitute.com',
    },
  ].map(assessLinkCandidate);
}

module.exports = { assessLinkCandidate, mockLinkCandidates };
