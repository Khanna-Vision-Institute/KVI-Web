const fs = require('fs');
const path = require('path');
const { isMdManifestOffice } = require('../referralOfficesManifest');

/**
 * MD/DO rows for Heritage Family (MDVIP directory scrape — not in Zoho Doctor Office).
 * @param {Record<string, unknown>} row
 */
function mdvipRowToOffice(row) {
  const doctorName = String(row.doctor_name || '').trim();
  const practiceName = String(row.practice_name || '').trim();
  const addressLine = String(row.address_line || '').trim();
  const specialty = String(row.specialty || '').trim();
  const rawBlock = [doctorName, practiceName, specialty, addressLine, row.phone || '']
    .filter(Boolean)
    .join('\n');

  return {
    slug: String(row.slug || '').trim(),
    doctor_name: doctorName,
    practice_name: practiceName,
    credentials: '',
    address_line: addressLine,
    phone: String(row.phone || '').trim(),
    raw_block: rawBlock,
    provider_type: 'md',
    directory_hubs: ['HeritageFamily'],
    sync_source: 'heritage_mdvip',
  };
}

/**
 * Re-apply MDVIP physicians after Zoho OD sync. Updates existing MD slugs; adds missing ones.
 * @param {string} manifestPath
 */
function mergeMdvipPhysiciansIntoManifest(manifestPath) {
  const mdvipPath = path.join(path.dirname(manifestPath), 'heritage-mdvip-physicians.json');
  if (!fs.existsSync(mdvipPath)) {
    return { mdvipPath, merged: 0, added: 0, updated: 0, skipped: true };
  }

  const payload = JSON.parse(fs.readFileSync(mdvipPath, 'utf8'));
  const physicians = Array.isArray(payload.physicians) ? payload.physicians : [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.offices)) manifest.offices = [];

  /** @type {Map<string, Record<string, unknown>>} */
  const bySlug = new Map();
  for (const o of manifest.offices) {
    if (o && o.slug) bySlug.set(String(o.slug).toLowerCase(), o);
  }

  let added = 0;
  let updated = 0;
  for (const row of physicians) {
    const office = mdvipRowToOffice(row);
    if (!office.slug) continue;
    const key = office.slug.toLowerCase();
    if (bySlug.has(key)) {
      bySlug.set(key, { ...bySlug.get(key), ...office });
      updated += 1;
    } else {
      bySlug.set(key, office);
      added += 1;
    }
  }

  manifest.offices = [...bySlug.values()];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    mdvipPath,
    merged: physicians.length,
    added,
    updated,
    skipped: false,
    officeCount: manifest.offices.length,
  };
}

/**
 * Keep MD/DO rows from the previous manifest when rebuilding ODs from Zoho.
 * @param {unknown[]} zohoOffices
 * @param {unknown[]} existingOffices
 */
function appendPreservedMdOffices(zohoOffices, existingOffices) {
  const zohoSlugs = new Set(
    zohoOffices
      .map((o) => (o && typeof o === 'object' ? String(/** @type {Record<string, unknown>} */ (o).slug || '').toLowerCase() : ''))
      .filter(Boolean)
  );

  /** @type {unknown[]} */
  const kept = [];
  for (const row of existingOffices || []) {
    if (!isMdManifestOffice(row)) continue;
    const sk = String(/** @type {Record<string, unknown>} */ (row).slug || '').toLowerCase();
    if (!sk || zohoSlugs.has(sk)) continue;
    kept.push(row);
  }

  return [...zohoOffices, ...kept];
}

module.exports = {
  mergeMdvipPhysiciansIntoManifest,
  appendPreservedMdOffices,
  mdvipRowToOffice,
};
