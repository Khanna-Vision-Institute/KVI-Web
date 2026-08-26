const express = require('express');
const config = require('../config');
const store = require('../storage/store');
const { runSiteHealthCheck } = require('../jobs/siteHealthCheck');

const router = express.Router();

let running = null;

router.get('/site-health', (req, res) => {
  const latest = store.getLatestSiteHealth();
  const history = store.listSiteHealthHistory(20);
  res.json({
    ok: true,
    enabled: config.siteHealth.enabled,
    cron: config.siteHealth.cron,
    baseUrl: config.siteHealth.baseUrl,
    pathCount: config.siteHealth.paths.length,
    running: Boolean(running),
    latest,
    history,
  });
});

router.post('/site-health/run', async (req, res) => {
  if (running) {
    return res.status(409).json({ ok: false, message: 'Site health check already running' });
  }
  running = runSiteHealthCheck({ source: 'manual' })
    .then((summary) => {
      running = null;
      return summary;
    })
    .catch((err) => {
      running = null;
      throw err;
    });

  try {
    const summary = await running;
    res.json({ ok: true, summary });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

module.exports = router;
