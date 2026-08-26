#!/usr/bin/env node
/**
 * Merge data/heritage-mdvip-physicians.json into data/referral-offices.json
 *
 *   node scripts/merge-heritage-mdvip.js
 */
const fs = require('fs');
const path = require('path');

const MDVIP_JSON = path.join(__dirname, '..', 'data', 'heritage-mdvip-physicians.json');
const MANIFEST = path.join(__dirname, '..', 'data', 'referral-offices.json');

function toOffice(row) {
  const doctorName = row.doctor_name;
  const practiceName = row.practice_name;
  const addressLine = row.address_line || '';
  const specialty = row.specialty || '';
  const rawBlock = [doctorName, practiceName, specialty, addressLine, row.phone || '']
    .filter(Boolean)
    .join('\n');

  return {
    slug: row.slug,
    doctor_name: doctorName,
    practice_name: practiceName,
    credentials: '',
    address_line: addressLine,
    phone: row.phone || '',
    raw_block: rawBlock,
    provider_type: 'md',
    directory_hubs: ['HeritageFamily']
  };
}

function main() {
  const payload = JSON.parse(fs.readFileSync(MDVIP_JSON, 'utf8'));
  const physicians = Array.isArray(payload.physicians) ? payload.physicians : [];
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  if (!manifest.directoryPages) manifest.directoryPages = {};
  manifest.directoryPages.HeritageFamily = {
    title: 'Doctor outreach',
  };

  const bySlug = new Map();
  for (const o of manifest.offices || []) {
    if (o && o.slug) bySlug.set(String(o.slug).toLowerCase(), o);
  }

  let added = 0;
  let updated = 0;
  for (const row of physicians) {
    const office = toOffice(row);
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
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Heritage MDVIP merge: +${added} new, ${updated} updated, ${manifest.offices.length} total offices`);
}

main();
