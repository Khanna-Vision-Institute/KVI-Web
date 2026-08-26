const cron = require('node-cron');
const { heritageSyncConfig } = require('./fieldMapping');
const { syncHeritageFromZoho } = require('./sync');

let started = false;

/**
 * @param {{ reloadRegistry?: () => unknown }} [opts]
 */
function startHeritageZohoSyncCron(opts = {}) {
  if (started) return;
  started = true;

  const cfg = heritageSyncConfig();
  const expr = cfg.cron;

  if (!cron.validate(expr)) {
    console.error('[heritage-zoho-sync] Invalid ZOHO_HERITAGE_SYNC_CRON:', expr);
    return;
  }

  cron.schedule(expr, () => {
    syncHeritageFromZoho({ reloadRegistry: opts.reloadRegistry }).catch((err) => {
      console.error('[heritage-zoho-sync] cron:', err.message || err);
    });
  });

  console.log('[heritage-zoho-sync] Cron running:', expr, '| module:', cfg.module);
}

module.exports = { startHeritageZohoSyncCron };
