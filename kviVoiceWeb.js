const express = require('express');
const { getWebVoiceConfig } = require('../services/vapiWebAgents');

const router = express.Router();

/** Browser-safe Vapi Web SDK config (public key + assistant IDs per persona). */
router.get('/config', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  return res.json({ ok: true, ...getWebVoiceConfig() });
});

module.exports = router;
