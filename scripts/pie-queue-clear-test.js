#!/usr/bin/env node
/** Deactivate active PIE queue entries for retesting. Usage on EC2:
 *   node scripts/pie-queue-clear-test.js johndoe@gmail.com
 *   node scripts/pie-queue-clear-test.js --phone +13104037497
 *   node scripts/pie-queue-clear-test.js --all-active
 */
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const queuePath =
  process.env.PIE_AUTORESPONDER_QUEUE_PATH ||
  path.join(__dirname, '../data/pie-autoresponder-queue.json');

const fs = require('fs');
const arg = process.argv[2];
const phoneArg = process.argv[3];

if (!arg) {
  console.log('Usage: node scripts/pie-queue-clear-test.js <email>');
  console.log('       node scripts/pie-queue-clear-test.js --phone +1...');
  console.log('       node scripts/pie-queue-clear-test.js --all-active');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
let count = 0;

for (const e of data.enrollments || []) {
  if (e.status !== 'active') continue;
  let match = false;
  if (arg === '--all-active') match = true;
  else if (arg === '--phone' && phoneArg) {
    match = e.lead?.phone === phoneArg || e.lead?.phone?.includes(phoneArg.replace(/\D/g, ''));
  } else {
    match = e.email === String(arg).toLowerCase();
  }
  if (match) {
    e.status = 'cleared_for_testing';
    e.clearedAt = new Date().toISOString();
    count += 1;
    console.log('cleared:', e.email, e.lead?.phone);
  }
}

fs.writeFileSync(queuePath, JSON.stringify(data, null, 2));
console.log('Done. Cleared', count, 'enrollment(s).');
