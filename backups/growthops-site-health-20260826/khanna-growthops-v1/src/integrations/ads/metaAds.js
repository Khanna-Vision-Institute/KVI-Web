const config = require('../../config');

// STUB — Meta Ads integration is not wired in phase 1.
// Returns null when not configured so the orchestrator can show "Not connected".
// Structure is ready for a later implementation that returns:
//   { spend, leads, booked, quality }

/**
 * @returns {Promise<{ spend, leads, booked, quality } | null>}
 */
async function fetchMetaAdsSnapshot() {
  if (!config.integrationsEnabled.metaAds) return null;
  // Not implemented yet — credentials present but connector pending.
  return null;
}

module.exports = { fetchMetaAdsSnapshot };
