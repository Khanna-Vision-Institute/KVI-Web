const { heritageBitrixSyncConfig } = require('./fieldMapping');

function isHeritageBitrixSyncEnabled() {
  return heritageBitrixSyncConfig().enabled;
}

/**
 * @param {{ reloadRegistry?: () => unknown }} [opts]
 */
function startCronIfEnabled(opts = {}) {
  const cfg = heritageBitrixSyncConfig();

  if (!cfg.enabled) {
    console.log(
      '[heritage-bitrix-sync] Off — set HERITAGE_BITRIX_SYNC_ENABLED=true and BITRIX_WEBHOOK_URL in .env.'
    );
    return;
  }

  if (!cfg.webhookUrl) {
    console.warn(
      '[heritage-bitrix-sync] Enabled but BITRIX_WEBHOOK_URL is missing — cron will not start.'
    );
    return;
  }

  try {
    // eslint-disable-next-line global-require
    require('./cron').startHeritageBitrixSyncCron(opts);
  } catch (err) {
    console.error('[heritage-bitrix-sync] Cron did not start:', err.message || err);
  }
}

module.exports = {
  isHeritageBitrixSyncEnabled,
  startCronIfEnabled,
};
