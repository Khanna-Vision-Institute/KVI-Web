#!/usr/bin/env node
/** On EC2: node scripts/pie-queue-status.js */
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const queuePath =
  process.env.PIE_AUTORESPONDER_QUEUE_PATH ||
  path.join(__dirname, '../data/pie-autoresponder-queue.json');

const fs = require('fs');
if (!fs.existsSync(queuePath)) {
  console.log('No queue file yet:', queuePath);
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
const now = new Date();
console.log('Queue:', queuePath);
console.log('Now:', now.toISOString());
console.log('Enrollments:', (data.enrollments || []).length);
console.log('');

for (const e of (data.enrollments || []).slice(-5)) {
  console.log('---');
  console.log('id:', e.id, '| status:', e.status, '| email:', e.email);
  console.log('enrolled:', e.enrolledAt, '| phone:', e.lead?.phone);
  for (const j of e.jobs || []) {
    const due = new Date(j.dueAt);
    const dueIn = Math.round((due - now) / 1000);
    const flag = j.status === 'pending' && due <= now ? ' DUE NOW' : '';
    console.log(
      `  ${j.type.padEnd(12)} status=${j.status.padEnd(8)} due=${j.dueAt}${flag}${j.status === 'pending' && due > now ? ` (in ${dueIn}s)` : ''}${j.lastError ? ` err=${j.lastError}` : ''}`
    );
  }
}
