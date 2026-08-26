const { heritageSyncConfig } = require('./fieldMapping');

function isHeritageZohoSyncEnabled() {
  return heritageSyncConfig().enabled;
}

/**
 * @param {{ reloadRegistry?: () => unknown }} [opts]
 */
function startCronIfEnabled(opts = {}) {
  const cfg = heritageSyncConfig();

  if (!cfg.enabled) {
    console.log(
      '[heritage-zoho-sync] Off — set HERITAGE_ZOHO_SYNC_ENABLED=true and ZOHO_HERITAGE_CRM_MODULE in .env.'
    );
    return;
  }

  if (!cfg.module) {
    console.warn(
      '[heritage-zoho-sync] Enabled but ZOHO_HERITAGE_CRM_MODULE is missing — cron will not start.'
    );
    return;
  }

  try {
    // eslint-disable-next-line global-require
    require('./cron').startHeritageZohoSyncCron(opts);
  } catch (err) {
    console.error('[heritage-zoho-sync] Cron did not start:', err.message || err);
  }
}

module.exports = {
  isHeritageZohoSyncEnabled,
  startCronIfEnabled,
};
