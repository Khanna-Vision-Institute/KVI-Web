#!/usr/bin/env node
/**
 * Prints nginx location blocks so apex URLs like /beachside-optometry-inc reach Node (kvi-home),
 * instead of falling through to WordPress and returning 404.
 *
 * Usage (from repo root):
 *   node scripts/print-referral-clinic-nginx-snippet.js
 *   node scripts/print-referral-clinic-nginx-snippet.js --upstream=http://127.0.0.1:3000
 *
 * Paste the output into your nginx `server { }` for khannainstitute.com **before** the generic
 * WordPress / PHP location. Reload nginx after deploy when keys change.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { loadReferralOfficesRegistry } = require('../services/referralOffices');

const args = process.argv.slice(2);
let upstream = process.env.KVI_NODE_UPSTREAM || 'http://127.0.0.1:3000';
for (const a of args) {
  if (a.startsWith('--upstream=')) upstream = a.slice('--upstream='.length).trim();
}

const registry = loadReferralOfficesRegistry({ logger: console });
const keys = registry.listClinicVanityKeys ? registry.listClinicVanityKeys() : [];

if (!keys.length) {
  console.error('No clinic vanity keys found (check data/referral-offices.json and KVI_REFERRAL_OFFICES_JSON).');
  process.exit(2);
}

const CHUNK = 75;

console.log('# --- Begin referral clinic apex proxy (generated) ---');
console.log('# Keys:', keys.length, '| Chunk size:', CHUNK, '| Upstream:', upstream);
console.log('# Requires: Node serves GET /:clinicSlug for these paths (Express already implements this).');

for (let i = 0; i < keys.length; i += CHUNK) {
  const slice = keys.slice(i, i + CHUNK).filter(Boolean);
  if (!slice.length) continue;

  /**
   * Slugs only contain `[a-z0-9-]` from practiceNameToClinicKey().
   */
  const body = slice.join('|');

  console.log('');
  console.log(`location ~ ^/(?:${body})$ {`);
  console.log(`  proxy_pass ${upstream};`);
  console.log(`  proxy_http_version 1.1;`);
  console.log(`  proxy_set_header Host $host;`);
  console.log(`  proxy_set_header X-Real-IP $remote_addr;`);
  console.log(`  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`);
  console.log(`  proxy_set_header X-Forwarded-Proto $scheme;`);
  console.log(`}`);
}

console.log('');
console.log('# --- End referral clinic apex proxy ---');
