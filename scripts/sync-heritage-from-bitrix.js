#!/usr/bin/env node
/**
 * Manual one-shot: pull Heritage OD list from Bitrix Doctor Office → referral-offices.json
 *
 * Requires .env:
 *   BITRIX_WEBHOOK_URL=https://b24-….bitrix24.in/rest/…/…/
 *   HERITAGE_BITRIX_ENTITY_TYPE_ID=1038   (optional; default 1038)
 *
 *   node scripts/sync-heritage-from-bitrix.js
 *   node scripts/sync-heritage-from-bitrix.js --probe
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { heritageBitrixSyncConfig, bitrixHeritageFieldMap } = require('../services/heritageBitrixSync/fieldMapping');
const { listAllDoctorOfficeItems, bitrixCall } = require('../services/heritageBitrixSync/bitrixClient');
const { syncHeritageFromBitrix } = require('../services/heritageBitrixSync/sync');

async function probe() {
  const cfg = heritageBitrixSyncConfig();
  if (!cfg.webhookUrl) {
    console.error('Set BITRIX_WEBHOOK_URL in .env');
    process.exitCode = 1;
    return;
  }

  console.log('entityTypeId:', cfg.entityTypeId);
  console.log('field map:', bitrixHeritageFieldMap());

  const fieldsEnvelope = await bitrixCall('crm.item.fields', { entityTypeId: cfg.entityTypeId });
  const fields = (fieldsEnvelope && fieldsEnvelope.result) || {};
  const fieldObj = (fields && fields.fields) || fields || {};
  if (fieldObj && typeof fieldObj === 'object') {
    console.log(
      'Bitrix field titles:',
      Object.entries(fieldObj)
        .filter(([, meta]) => meta && meta.title)
        .map(([k, meta]) => `${k}=${meta.title}`)
        .join(', ')
    );
  }

  // Re-fetch one page only for sample
  const sampleEnvelope = await bitrixCall('crm.item.list', {
    entityTypeId: cfg.entityTypeId,
    order: { id: 'ASC' },
    start: 0,
  });
  const sample = (sampleEnvelope && sampleEnvelope.result) || {};
  const first = ((sample && sample.items) || [])[0];
  if (!first) {
    console.log('No Doctor Office items returned. Check webhook permissions and entityTypeId.');
    return;
  }

  console.log('Sample id:', first.id, 'title:', first.title);
  console.log('Sample keys:', Object.keys(first).sort().join(', '));
  console.log('Bitrix reports total items:', sampleEnvelope.total);
  console.log('(Use npm run sync:heritage-bitrix for a full pull of all pages)');
}

async function main() {
  const probeOnly = process.argv.includes('--probe');

  if (probeOnly) {
    await probe();
    return;
  }

  const result = await syncHeritageFromBitrix();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('[sync-heritage-from-bitrix]', err.message || err);
  process.exitCode = 1;
});
