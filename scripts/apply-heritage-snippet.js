#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SNIP = path.join(__dirname, '..', 'data', '_heritage-md-manifest-snippet.json');
const MANIFEST = path.join(__dirname, '..', 'data', 'referral-offices.json');

function isHeritageMdRow(o) {
  if (!o || typeof o !== 'object') return false;
  const hubs = o.directory_hubs || o.directoryHubs;
  if (!Array.isArray(hubs) || !hubs.includes('HeritageFamily')) return false;
  const pt = String(o.provider_type || o.providerType || '').toLowerCase();
  if (pt === 'md' || pt === 'physician') return true;
  const slug = String(o.slug || '').toLowerCase();
  return slug.startsWith('mdvip-') || slug.startsWith('heritage-md-');
}

const mdRows = JSON.parse(fs.readFileSync(SNIP, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const kept = (manifest.offices || []).filter((o) => !isHeritageMdRow(o));

manifest.directoryPages = manifest.directoryPages || {};
manifest.directoryPages.HeritageFamily = {
  title: 'Doctor outreach',
};

manifest.offices = [...kept, ...mdRows];
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Heritage MD rows: ${mdRows.length}; total offices: ${manifest.offices.length}`);
