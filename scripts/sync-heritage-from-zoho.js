#!/usr/bin/env node
/**
 * Manual one-shot: pull Heritage OD list from Zoho CRM → referral-offices.json
 *
 * Requires .env with ZOHO_* credentials and ZOHO_HERITAGE_CRM_MODULE.
 *
 *   node scripts/sync-heritage-from-zoho.js
 *   node scripts/sync-heritage-from-zoho.js --probe   # list first record field keys only
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const zohoService = require('../services/zohoService');
const { heritageSyncConfig } = require('../services/heritageZohoSync/fieldMapping');
const { syncHeritageFromZoho } = require('../services/heritageZohoSync/sync');

async function probe() {
  const cfg = heritageSyncConfig();
  if (!cfg.module) {
    console.error('Set ZOHO_HERITAGE_CRM_MODULE in .env (Zoho module API name).');
    process.exitCode = 1;
    return;
  }

  const records = await zohoService.listAllRecords(cfg.module, {
    cvid: cfg.customViewId || undefined,
    perPage: 1,
    maxPages: 1,
  });

  if (!records.length) {
    console.log('No records returned. Check module name, OAuth scopes, and custom view id.');
    return;
  }

  console.log('Module:', cfg.module);
  console.log('Sample record id:', records[0].id);
  console.log('Field keys:', Object.keys(records[0]).sort().join(', '));
}

async function main() {
  const probeOnly = process.argv.includes('--probe');

  if (probeOnly) {
    await probe();
    return;
  }

  const result = await syncHeritageFromZoho();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('[sync-heritage-from-zoho]', err.message || err);
  process.exitCode = 1;
});
