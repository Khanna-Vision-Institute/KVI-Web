const BLOCKED_PHRASES = [
  /guaranteed\s+20\/20/i,
  /best\s+lasik\s+surgeon/i,
  /no[- ]risk/i,
  /cure\s+blindness/i,
  /are you tired of your (glasses|contacts)/i,
];

function scanDraft(text) {
  const issues = [];
  for (const re of BLOCKED_PHRASES) {
    if (re.test(text)) issues.push(`Blocked phrase pattern: ${re.source}`);
  }
  return {
    ok: issues.length === 0,
    issues,
    riskLevel: issues.length ? 'high' : 'low',
  };
}

module.exports = { scanDraft, BLOCKED_PHRASES };
