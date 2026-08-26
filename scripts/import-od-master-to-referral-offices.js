#!/usr/bin/env node
/**
 * Rebuild `data/referral-offices.json` `offices` from Khanna OD master export (JSON array).
 * Preserves existing `directoryPages` and `aliases` from `--out` when present.
 *
 * Usage:
 *   node scripts/import-od-master-to-referral-offices.js \
 *     --master="/path/to/Khanna_Vision_OD_Info_0526_Master_List.json"
 *
 * Optional:
 *   --out="data/referral-offices.json"
 *   --leadStatus=Active   # only rows whose "Lead Status" matches (omit to include all)
 */
const fs = require('fs');
const path = require('path');
const { rebuildManifestFromRows } = require('../services/referralOfficesManifest');

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => typeof a === 'string' && a.startsWith(prefix));
  if (!hit) return fallback;
  return hit.slice(prefix.length).replace(/^["']|["']$/g, '').trim();
}

function main() {
  const masterPathRaw = readArg('master', '');
  const leadFilter = String(readArg('leadStatus', '')).trim();
  const outFile = readArg('out', path.join('data', 'referral-offices.json'));

  if (!masterPathRaw) {
    console.error('[import-od-master] Missing --master="/path/to/master.json"');
    process.exitCode = 1;
    return;
  }

  const absMaster = path.isAbsolute(masterPathRaw)
    ? masterPathRaw
    : path.resolve(process.cwd(), masterPathRaw);

  /** @type {unknown} */
  let rowsRaw;
  try {
    rowsRaw = JSON.parse(fs.readFileSync(absMaster, 'utf8'));
  } catch (e) {
    console.error('[import-od-master] Failed to read/parse:', absMaster, String(e && e.message ? e.message : e));
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(rowsRaw)) {
    console.error('[import-od-master] Master file must contain a JSON array.');
    process.exitCode = 1;
    return;
  }

  const result = rebuildManifestFromRows({
    rows: /** @type {Record<string, unknown>[]} */ (rowsRaw),
    outFile,
    leadStatusFilter: leadFilter || undefined,
  });

  console.log('[import-od-master] Wrote:', result.manifestPath);
  console.log('[import-od-master] Offices:', result.officeCount, '| skipped (missing names):', result.skipped);
  if (leadFilter) console.log('[import-od-master] Skipped lead status mismatch:', result.leadSkipped);
  if (result.slugPreserved) console.log('[import-od-master] Preserved slugs:', result.slugPreserved);
}

main();
