const config = require('../../config');

// STUB — Google Ads integration is not wired in phase 1.
// Returns null when not configured so the orchestrator can show "Not connected".
// Structure is ready for a later implementation that returns:
//   { spend, clicks, leads, cpl }

/**
 * @returns {Promise<{ spend, clicks, leads, cpl } | null>}
 */
async function fetchGoogleAdsSnapshot() {
  if (!config.integrationsEnabled.googleAds) return null;
  // Not implemented yet — credentials present but connector pending.
  // Returning null keeps the cycle safe; wire the real API call here later.
  return null;
}

module.exports = { fetchGoogleAdsSnapshot };
