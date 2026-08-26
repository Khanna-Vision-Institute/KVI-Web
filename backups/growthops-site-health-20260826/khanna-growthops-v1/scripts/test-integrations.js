#!/usr/bin/env node
/**
 * Test each configured integration individually.
 * Does NOT start the server and does NOT write to data/store.json.
 *
 * Exit code:
 *   - MOCK_MODE=true  → always 0 (informational only)
 *   - MOCK_MODE=false → 0 if at least one source connects, 1 otherwise
 *
 * Usage:  npm run test:integrations
 */
const config = require('../src/config');

async function testSource(name, enabled, fn) {
  if (!enabled) return { name, status: 'not_configured', detail: 'credentials missing' };
  try {
    const sample = await fn();
    return { name, status: 'connected', sample };
  } catch (err) {
    return { name, status: 'error', detail: err.message };
  }
}

async function main() {
  console.log(`\n=== GrowthOps integration test (MOCK_MODE=${config.mockMode}) ===\n`);

  const { fetchSearchConsoleSnapshot } = require('../src/integrations/google/searchConsole');
  const { fetchGa4Snapshot } = require('../src/integrations/google/ga4');
  const { fetchZohoSnapshot } = require('../src/integrations/zoho/crmRead');
  const { generateDraft } = require('../src/integrations/openai/client');
  const { fetchGoogleAdsSnapshot } = require('../src/integrations/ads/googleAds');
  const { fetchMetaAdsSnapshot } = require('../src/integrations/ads/metaAds');

  const en = config.integrationsEnabled;

  const results = await Promise.all([
    testSource('searchConsole', en.searchConsole, async () => {
      const s = await fetchSearchConsoleSnapshot();
      return { topQueries: s.topQueries.length, lowCtrPages: s.lowCtrPages.length };
    }),
    testSource('ga4', en.ga4, async () => {
      const s = await fetchGa4Snapshot();
      return { landingPages: s.landingPages.length };
    }),
    testSource('zoho', en.zoho, async () => {
      const s = await fetchZohoSnapshot();
      return { newLeads7d: s.newLeads7d, topSources: s.topSources, leadsByStatus: s.leadsByStatus };
    }),
    testSource('openai', en.openai, async () => {
      const text = await generateDraft({
        systemPrompt: 'You are a connectivity probe. Reply with exactly one short word.',
        userPrompt: 'Say: ok',
        maxTokens: 16,
      });
      return { reply: text.slice(0, 40) };
    }),
  ]);

  // Ads are phase-1 stubs — report status without counting toward connectivity.
  const adsResults = [
    { name: 'googleAds', status: (await fetchGoogleAdsSnapshot()) ? 'connected' : 'not_configured' },
    { name: 'metaAds', status: (await fetchMetaAdsSnapshot()) ? 'connected' : 'not_configured' },
  ];
  results.push(...adsResults);

  console.log(JSON.stringify({ mockMode: config.mockMode, results }, null, 2));

  const connected = results.filter((r) => r.status === 'connected').length;
  console.log(`\n${connected} of ${results.length} sources connected.\n`);

  if (config.mockMode) {
    console.log('MOCK_MODE=true — running on sample data. Set MOCK_MODE=false to test live sources.\n');
    process.exit(0);
  }
  process.exit(connected > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
