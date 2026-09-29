// Read-only deployment preflight. Never prints website contents or credentials.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = process.argv[2];
if (!root) { console.error('Usage: node scripts/check-consult-conversion-target.cjs /absolute/live/site/root'); process.exit(2); }
const expected = {
  'vip-consult.html': '9b9040fb77ae1ec2def0f6055a76a4f687706d5d31462754ad5ca4f4d49e2043',
  'vip-consult-thank-you.html': '3a4c5b37e7f7ac95f56263610b6bba86d9a9f60403943dccae2857f889205c10',
  'smile-book-consultation.html': '1977119d4e65de778f42b104b78a83e801b61534bb874fdc258742c4df2a8c99',
  'smile-book-consultation-thank-you.html': '43ba26f924c7b10c4df3b58d582fdd97d03ea631530b8f1ab2653b20acf3c86a'
};
let failed = false;
for (const [name, digest] of Object.entries(expected)) {
  try {
    const actual = createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
    const ok = actual === digest;
    console.log(`${ok ? 'MATCH' : 'STOP: changed file'} ${name}`);
    if (!ok) failed = true;
  } catch (_) { console.error(`STOP: unreadable file ${name}`); failed = true; }
}
if (fs.existsSync(path.join(root, 'public/js/consult-conversion.js'))) {
  console.error('STOP: conversion helper already exists; review it before deployment.'); failed = true;
}
if (failed) process.exitCode = 1;
else console.log('Baseline matches the public pages inspected on 2026-09-22. No files changed. This does not verify server routes, Google settings, or event receipt.');
