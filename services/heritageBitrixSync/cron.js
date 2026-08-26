const cron = require('node-cron');
const { heritageBitrixSyncConfig } = require('./fieldMapping');
const { syncHeritageFromBitrix } = require('./sync');

let started = false;

/**
 * @param {{ reloadRegistry?: () => unknown }} [opts]
 */
function startHeritageBitrixSyncCron(opts = {}) {
  if (started) return;
  started = true;

  const cfg = heritageBitrixSyncConfig();
  const expr = cfg.cron;

  if (!cron.validate(expr)) {
    console.error('[heritage-bitrix-sync] Invalid HERITAGE_BITRIX_SYNC_CRON:', expr);
    return;
  }

  cron.schedule(expr, () => {
    syncHeritageFromBitrix({ reloadRegistry: opts.reloadRegistry }).catch((err) => {
      console.error('[heritage-bitrix-sync] cron:', err.message || err);
    });
  });

  console.log(
    '[heritage-bitrix-sync] Cron running:',
    expr,
    '| entityTypeId:',
    cfg.entityTypeId
  );
}

module.exports = { startHeritageBitrixSyncCron };
