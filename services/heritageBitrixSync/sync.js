const { rebuildManifestFromRows, resolveManifestPath } = require('../referralOfficesManifest');
const { mergeMdvipPhysiciansIntoManifest } = require('../heritageZohoSync/mergeMdOffices');
const { heritageBitrixSyncConfig, bitrixItemToMasterRows } = require('./fieldMapping');
const { listAllDoctorOfficeItems } = require('./bitrixClient');

let syncInFlight = false;

/** @type {{ lastRunAt: string | null, lastOk: boolean | null, lastError: string | null, lastOfficeCount: number | null, lastFetched: number | null }} */
const lastStatus = {
  lastRunAt: null,
  lastOk: null,
  lastError: null,
  lastOfficeCount: null,
  lastFetched: null,
};

function getHeritageBitrixSyncStatus() {
  return { ...lastStatus, syncInFlight };
}

/**
 * Pull Bitrix Doctor Office (entityTypeId 1038) → rebuild referral-offices.json.
 * Keeps MDVIP merge + existing website directory shape (no UI/stage changes).
 * @param {{ reloadRegistry?: () => unknown, logger?: Pick<Console, 'info' | 'warn' | 'error'> }} [opts]
 */
async function syncHeritageFromBitrix(opts = {}) {
  const logger = opts.logger || console;
  const cfg = heritageBitrixSyncConfig();

  if (!cfg.webhookUrl) {
    throw new Error('BITRIX_WEBHOOK_URL is not set');
  }
  if (!cfg.entityTypeId) {
    throw new Error('HERITAGE_BITRIX_ENTITY_TYPE_ID is not set');
  }

  if (syncInFlight) {
    return { ok: false, skipped: true, reason: 'sync_already_running' };
  }

  syncInFlight = true;
  const startedAt = new Date().toISOString();

  try {
    logger.info('[heritage-bitrix-sync] Fetching Doctor Office entityTypeId:', cfg.entityTypeId);

    const items = await listAllDoctorOfficeItems({
      entityTypeId: cfg.entityTypeId,
      pageSize: cfg.pageSize,
      logger,
    });

    /** @type {Record<string, unknown>[]} */
    const rows = [];
    for (const item of items) {
      rows.push(...bitrixItemToMasterRows(item));
    }

    logger.info('[heritage-bitrix-sync] Expanded items → office rows:', {
      items: items.length,
      rows: rows.length,
    });

    const result = rebuildManifestFromRows({
      rows,
      directoryHubs: cfg.directoryHubs.length ? cfg.directoryHubs : null,
      preserveMdOffices: true,
      markZohoRowsAsOd: true,
      zohoSyncSource: 'bitrix_doctor_office',
    });

    const mdMerge = mergeMdvipPhysiciansIntoManifest(result.manifestPath);

    if (typeof opts.reloadRegistry === 'function') {
      opts.reloadRegistry();
    }

    lastStatus.lastRunAt = startedAt;
    lastStatus.lastOk = true;
    lastStatus.lastError = null;
    lastStatus.lastFetched = items.length;
    lastStatus.lastOfficeCount = mdMerge.officeCount || result.officeCount;

    logger.info('[heritage-bitrix-sync] Complete:', {
      entityTypeId: cfg.entityTypeId,
      fetched: items.length,
      odOffices: result.odOfficeCount,
      mdPreserved: result.mdPreserved,
      mdvipMerged: mdMerge.merged,
      offices: mdMerge.officeCount || result.officeCount,
      slugPreserved: result.slugPreserved,
      skipped: result.skipped,
      manifestPath: result.manifestPath,
    });

    return {
      ok: true,
      fetched: items.length,
      ...result,
      mdMerge,
      officeCount: mdMerge.officeCount || result.officeCount,
    };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    lastStatus.lastRunAt = startedAt;
    lastStatus.lastOk = false;
    lastStatus.lastError = message;
    logger.error('[heritage-bitrix-sync] Failed:', message);

    try {
      const mdOnly = mergeMdvipPhysiciansIntoManifest(resolveManifestPath());
      if (mdOnly.merged) {
        logger.info('[heritage-bitrix-sync] Restored MD physicians after Bitrix error:', mdOnly);
        if (typeof opts.reloadRegistry === 'function') opts.reloadRegistry();
        lastStatus.lastOfficeCount = mdOnly.officeCount || null;
      }
    } catch (mdErr) {
      logger.warn('[heritage-bitrix-sync] MD restore skipped:', mdErr.message || mdErr);
    }

    throw err;
  } finally {
    syncInFlight = false;
  }
}

/**
 * @param {{ reloadRegistry?: () => unknown, logger?: Pick<Console, 'info' | 'warn' | 'error'> }} [opts]
 */
function queueHeritageBitrixSync(opts = {}) {
  if (syncInFlight) {
    return { queued: false, reason: 'sync_already_running' };
  }

  setImmediate(() => {
    syncHeritageFromBitrix(opts).catch((err) => {
      const logger = opts.logger || console;
      logger.error('[heritage-bitrix-sync] background sync failed:', err.message || err);
    });
  });

  return { queued: true };
}

module.exports = {
  syncHeritageFromBitrix,
  queueHeritageBitrixSync,
  getHeritageBitrixSyncStatus,
};
