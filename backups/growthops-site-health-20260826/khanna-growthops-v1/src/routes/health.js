const express = require('express');
const config = require('../config');
const store = require('../storage/store');
const { getIntegrationStatus } = require('../integrations');

const router = express.Router();

function integrationStatus() {
  const en = config.integrationsEnabled;

  // In sample mode every data source reports "sample".
  if (config.mockMode) {
    return {
      searchConsole: 'sample',
      ga4: 'sample',
      zoho: 'sample',
      openai: en.openai ? 'connected' : 'sample',
      googleAds: 'not_configured',
      metaAds: 'not_configured',
    };
  }

  // Live mode — reflect the last analytics fetch (updated when /analytics/summary runs).
  return getIntegrationStatus();
}

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'khanna-growthops-v1',
    sampleData: config.mockMode,
    integrations: integrationStatus(),
    stats: store.dashboardStats(),
  });
});

module.exports = router;
