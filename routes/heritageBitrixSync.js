const express = require('express');
const { heritageBitrixSyncConfig } = require('../services/heritageBitrixSync/fieldMapping');
const {
  queueHeritageBitrixSync,
  getHeritageBitrixSyncStatus,
} = require('../services/heritageBitrixSync/sync');

const router = express.Router();

function extractSyncSecret(req) {
  const cfg = heritageBitrixSyncConfig();
  const expected = cfg.secret;
  if (!expected) return { ok: false, reason: 'secret_not_configured' };

  const auth = String(req.headers.authorization || '').trim();
  const bearer = /^Bearer\s+(.+)$/i.exec(auth);
  if (bearer && bearer[1] === expected) return { ok: true };

  const header = String(req.headers['x-kvi-heritage-sync-secret'] || '').trim();
  if (header && header === expected) return { ok: true };

  const query = String(req.query.secret || '').trim();
  if (query && query === expected) return { ok: true };

  return { ok: false, reason: 'unauthorized' };
}

function guardSyncRequest(req, res) {
  const cfg = heritageBitrixSyncConfig();
  if (!cfg.enabled) {
    res.status(503).json({
      ok: false,
      code: 'SYNC_DISABLED',
      message: 'Set HERITAGE_BITRIX_SYNC_ENABLED=true on the server.',
    });
    return false;
  }

  const auth = extractSyncSecret(req);
  if (!auth.ok) {
    res.status(auth.reason === 'secret_not_configured' ? 503 : 401).json({
      ok: false,
      code: auth.reason === 'secret_not_configured' ? 'SECRET_MISSING' : 'UNAUTHORIZED',
      message:
        auth.reason === 'secret_not_configured'
          ? 'Set HERITAGE_BITRIX_SYNC_SECRET in .env and pass it as Authorization: Bearer … or X-KVI-Heritage-Sync-Secret.'
          : 'Invalid sync secret.',
    });
    return false;
  }

  return true;
}

/**
 * @param {{ reloadRegistry?: () => unknown }} deps
 */
function createHeritageBitrixSyncRouter(deps = {}) {
  router.get('/status', (req, res) => {
    if (!guardSyncRequest(req, res)) return;
    const cfg = heritageBitrixSyncConfig();
    return res.json({
      ok: true,
      ...getHeritageBitrixSyncStatus(),
      config: { entityTypeId: cfg.entityTypeId, cron: cfg.cron },
    });
  });

  function respondSyncQueued(req, res, extra = {}) {
    const queued = queueHeritageBitrixSync({ reloadRegistry: deps.reloadRegistry });
    if (!queued.queued) {
      return res.status(409).json({
        ok: false,
        code: 'SYNC_ALREADY_RUNNING',
        message: 'A sync is already in progress. Check GET /status.',
        ...extra,
      });
    }

    return res.status(202).json({
      ok: true,
      started: true,
      message: 'Sync started in background. Poll GET /status until syncInFlight is false.',
      ...getHeritageBitrixSyncStatus(),
      ...extra,
    });
  }

  router.post('/run', (req, res) => {
    if (!guardSyncRequest(req, res)) return;
    return respondSyncQueued(req, res);
  });

  /**
   * Optional Bitrix automation webhook — any POST triggers a full sync.
   * Cron every 6h is the primary path; webhook is optional for near-real-time.
   */
  router.post('/webhook', (req, res) => {
    if (!guardSyncRequest(req, res)) return;
    return respondSyncQueued(req, res, { triggeredBy: 'webhook' });
  });

  return router;
}

module.exports = { createHeritageBitrixSyncRouter };
