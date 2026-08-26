const config = require('../config');
const { fetchSearchConsoleSnapshot } = require('./google/searchConsole');
const { fetchGa4Snapshot } = require('./google/ga4');
const { fetchZohoSnapshot } = require('./zoho/crmRead');
const { fetchGoogleAdsSnapshot } = require('./ads/googleAds');
const { fetchMetaAdsSnapshot } = require('./ads/metaAds');

const EMPTY_SIGNALS = {
  searchConsole: { topQueries: [], lowCtrPages: [], totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0 },
  ga4: { landingPages: [], consultIntentsTotal: 0, totalSessions: 0, totalUsers: 0, pageViews: 0 },
  zoho: { newLeads7d: 0, topSources: [], leadsByStatus: [], leadSources: [] },
};

function seedStatus() {
  const en = config.integrationsEnabled;
  return {
    searchConsole: en.searchConsole ? 'connected' : 'not_configured',
    ga4: en.ga4 ? 'connected' : 'not_configured',
    zoho: en.zoho ? 'connected' : 'not_configured',
    openai: en.openai ? 'connected' : 'not_configured',
    googleAds: 'not_configured',
    metaAds: 'not_configured',
  };
}

// Last-known per-source status, updated on each live fetch. Read by the health endpoint.
let lastStatus = seedStatus();

/**
 * Run one source — live mode never injects demo numbers; returns empty on failure.
 * Returns { value, status }.
 */
async function runSource(name, enabled, fn, emptyValue) {
  if (!enabled) {
    return { value: emptyValue, status: 'not_configured' };
  }
  try {
    const value = await fn();
    return { value, status: 'connected' };
  } catch (err) {
    const detail = err.cause && err.cause.message ? `${err.message} (${err.cause.message})` : err.message;
    console.warn(`[growthops] ${name}: live fetch failed (${detail})`);
    return { value: emptyValue, status: 'error' };
  }
}

/**
 * Fetch all live signals in parallel. Empty slices on missing creds or API errors.
 * Ads use null (not sample) when not connected so the brief can show "Not connected".
 */
async function fetchLiveSignals() {
  const empty = EMPTY_SIGNALS;
  const en = config.integrationsEnabled;

  const [sc, ga, zoho, googleAds, metaAds] = await Promise.all([
    runSource('searchConsole', en.searchConsole, fetchSearchConsoleSnapshot, empty.searchConsole),
    runSource('ga4', en.ga4, fetchGa4Snapshot, empty.ga4),
    runSource('zoho', en.zoho, fetchZohoSnapshot, empty.zoho),
    // Ads stubs: return null when not wired (no sample fallback by design).
    fetchGoogleAdsSnapshot().catch((e) => {
      console.warn(`[growthops] googleAds: ${e.message}`);
      return null;
    }),
    fetchMetaAdsSnapshot().catch((e) => {
      console.warn(`[growthops] metaAds: ${e.message}`);
      return null;
    }),
  ]);

  lastStatus = {
    searchConsole: sc.status,
    ga4: ga.status,
    zoho: zoho.status,
    openai: en.openai ? 'connected' : 'sample',
    googleAds: googleAds ? 'connected' : 'not_configured',
    metaAds: metaAds ? 'connected' : 'not_configured',
  };

  const signals = {
    generatedAt: new Date().toISOString(),
    searchConsole: sc.value,
    ga4: ga.value,
    ads: { google: googleAds, meta: metaAds },
    zoho: zoho.value,
  };

  // Non-contract metadata for diagnostics / health; ignored by the brief builder.
  Object.defineProperty(signals, '_integrationStatus', {
    value: { ...lastStatus },
    enumerable: false,
  });

  return signals;
}

function getIntegrationStatus() {
  return { ...lastStatus };
}

module.exports = { fetchLiveSignals, getIntegrationStatus };
