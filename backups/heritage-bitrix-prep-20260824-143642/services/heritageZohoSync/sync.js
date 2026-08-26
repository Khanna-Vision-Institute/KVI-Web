const zohoService = require('../zohoService');
const { rebuildManifestFromRows, resolveManifestPath } = require('../referralOfficesManifest');
const { heritageSyncConfig, zohoRecordToMasterRow, isAccountsModule } = require('./fieldMapping');
const { expandAccountsToMasterRows } = require('./accountsExpand');
const { mergeMdvipPhysiciansIntoManifest } = require('./mergeMdOffices');

let syncInFlight = false;

/** @type {{ lastRunAt: string | null, lastOk: boolean | null, lastError: string | null, lastOfficeCount: number | null }} */
const lastStatus = {
  lastRunAt: null,
  lastOk: null,
  lastError: null,
  lastOfficeCount: null,
};

function getHeritageSyncStatus() {
  return { ...lastStatus, syncInFlight };
}

function isInvalidCvidError(err) {
  const msg = String((err && err.message) || '');
  return msg.includes('cvid') || msg.includes('INVALID_DATA');
}

/**
 * @param {import('../zohoService')} zoho
 * @param {{ module: string, customViewId?: string }} cfg
 * @param {Pick<Console, 'info' | 'warn'>} logger
 */
async function fetchHeritageCrmRecords(zoho, cfg, logger) {
  const cvid = String(cfg.customViewId || '').trim();
  if (!cvid) {
    return zoho.listAllRecords(cfg.module, {});
  }

  try {
    return await zoho.listAllRecords(cfg.module, { cvid });
  } catch (err) {
    if (!isInvalidCvidError(err)) throw err;
    logger.warn(
      '[heritage-zoho-sync] ZOHO_HERITAGE_CRM_VIEW_ID rejected by Zoho — fetching all Accounts without cvid:',
      cvid
    );
    return zoho.listAllRecords(cfg.module, {});
  }
}

/**
 * Pull all records from the configured Zoho CRM module and rebuild referral-offices.json.
 * @param {{ reloadRegistry?: () => unknown, logger?: Pick<Console, 'info' | 'warn' | 'error'> }} [opts]
 */
async function syncHeritageFromZoho(opts = {}) {
  const logger = opts.logger || console;
  const cfg = heritageSyncConfig();

  if (!cfg.module) {
    throw new Error('ZOHO_HERITAGE_CRM_MODULE is not set (Zoho module API name for the OD master list).');
  }

  if (syncInFlight) {
    return { ok: false, skipped: true, reason: 'sync_already_running' };
  }

  syncInFlight = true;
  const startedAt = new Date().toISOString();

  try {
    logger.info('[heritage-zoho-sync] Fetching CRM module:', cfg.module);

    const records = await fetchHeritageCrmRecords(zohoService, cfg, logger);

    let rows;
    if (isAccountsModule(cfg.module) && cfg.expandAccountContacts) {
      rows = await expandAccountsToMasterRows(records, async (accountId) =>
        zohoService.listRelatedRecords(cfg.module, accountId, cfg.relatedContactsModule)
      );
      logger.info('[heritage-zoho-sync] Expanded Accounts → office rows:', {
        accounts: records.length,
        rows: rows.length,
      });
    } else {
      rows = records.map((r) => zohoRecordToMasterRow(r));
    }

    const result = rebuildManifestFromRows({
      rows,
      leadStatusFilter: cfg.leadStatusFilter || undefined,
      directoryHubs: cfg.directoryHubs.length ? cfg.directoryHubs : null,
      preserveMdOffices: true,
      markZohoRowsAsOd: true,
      zohoSyncSource: 'zoho_accounts',
    });

    const mdMerge = mergeMdvipPhysiciansIntoManifest(result.manifestPath);

    if (typeof opts.reloadRegistry === 'function') {
      opts.reloadRegistry();
    }

    lastStatus.lastRunAt = startedAt;
    lastStatus.lastOk = true;
    lastStatus.lastError = null;
    lastStatus.lastOfficeCount = mdMerge.officeCount || result.officeCount;

    logger.info('[heritage-zoho-sync] Complete:', {
      module: cfg.module,
      fetched: records.length,
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
      fetched: records.length,
      ...result,
      mdMerge,
      officeCount: mdMerge.officeCount || result.officeCount,
    };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    lastStatus.lastRunAt = startedAt;
    lastStatus.lastOk = false;
    lastStatus.lastError = message;
    logger.error('[heritage-zoho-sync] Failed:', message);

    try {
      const mdOnly = mergeMdvipPhysiciansIntoManifest(resolveManifestPath());
      if (mdOnly.merged) {
        logger.info('[heritage-zoho-sync] Restored MD physicians after Zoho error:', mdOnly);
        if (typeof opts.reloadRegistry === 'function') opts.reloadRegistry();
        lastStatus.lastOfficeCount = mdOnly.officeCount || null;
      }
    } catch (mdErr) {
      logger.warn('[heritage-zoho-sync] MD restore skipped:', mdErr.message || mdErr);
    }

    throw err;
  } finally {
    syncInFlight = false;
  }
}

/**
 * Start sync in the background — returns immediately (avoids nginx 504 on long Zoho pulls).
 * @param {{ reloadRegistry?: () => unknown, logger?: Pick<Console, 'info' | 'warn' | 'error'> }} [opts]
 */
function queueHeritageSync(opts = {}) {
  if (syncInFlight) {
    return { queued: false, reason: 'sync_already_running' };
  }

  setImmediate(() => {
    syncHeritageFromZoho(opts).catch((err) => {
      const logger = opts.logger || console;
      logger.error('[heritage-zoho-sync] background sync failed:', err.message || err);
    });
  });

  return { queued: true };
}

module.exports = {
  syncHeritageFromZoho,
  queueHeritageSync,
  getHeritageSyncStatus,
};
