#!/usr/bin/env node
/**
 * Show pending nurture autoresponder schedule (SMILE + Pterygium + PIE).
 *
 * Usage (on EC2):
 *   cd "/home/ec2-user/kvi-home/kvi home"
 *   node scripts/nurture-schedule-status.js
 *   node scripts/nurture-schedule-status.js superlasik@gmail.com
 */
const path = require('path');
const fs = require('fs');

process.chdir(path.join(__dirname, '..'));

const TZ = process.env.NURTURE_AUTORESPONDER_TIMEZONE || 'America/Los_Angeles';
const filterEmail = (process.argv[2] || '').trim().toLowerCase();

const QUEUES = [
  { campaign: 'smile', file: process.env.SMILE_AUTORESPONDER_QUEUE_PATH || 'data/smile-autoresponder-queue.json' },
  { campaign: 'pterygium', file: process.env.PTERYGIUM_AUTORESPONDER_QUEUE_PATH || 'data/pterygium-autoresponder-queue.json' },
  { campaign: 'pie', file: process.env.PIE_AUTORESPONDER_QUEUE_PATH || 'data/pie-autoresponder-queue.json' }
];

function fmtLa(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function dueLabel(dueAt, now) {
  const due = new Date(dueAt);
  const sec = Math.round((due - now) / 1000);
  if (sec <= 0) return 'due now';
  if (sec < 3600) return `in ${Math.round(sec / 60)} min`;
  if (sec < 86400) return `in ${(sec / 3600).toFixed(1)} hr`;
  return `in ${(sec / 86400).toFixed(1)} days`;
}

function loadQueue(relPath) {
  const full = path.isAbsolute(relPath) ? relPath : path.join(process.cwd(), relPath);
  if (!fs.existsSync(full)) return { path: full, enrollments: [] };
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  return { path: full, enrollments: data.enrollments || [] };
}

function matchesFilter(e) {
  if (!filterEmail) return true;
  const email = String(e.email || e.lead?.email || '').toLowerCase();
  return email.includes(filterEmail);
}

const now = new Date();
console.log(`Nurture schedule · ${TZ}`);
console.log(`Now: ${fmtLa(now.toISOString())} (${now.toISOString()})`);
if (filterEmail) console.log(`Filter: ${filterEmail}`);
console.log('');

let found = 0;

for (const { campaign, file } of QUEUES) {
  const { path: queuePath, enrollments } = loadQueue(file);
  const active = enrollments.filter((e) => e.status === 'active' && matchesFilter(e));

  if (!active.length) continue;

  console.log(`=== ${campaign.toUpperCase()} === (${queuePath})`);

  for (const e of active) {
    found += 1;
    const name = e.lead?.fullName || '—';
    console.log(`\n${name} · ${e.email} · ${e.lead?.phone || '—'}`);
    console.log(`  enrollment: ${e.id} · enrolled ${fmtLa(e.enrolledAt)}`);

    const jobs = (e.jobs || []).slice().sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    for (const j of jobs) {
      const pending = j.status === 'pending';
      const marker = pending && new Date(j.dueAt) <= now ? ' ← DUE' : '';
      const tail = pending ? ` (${dueLabel(j.dueAt, now)})` : '';
      console.log(
        `  ${j.type.padEnd(14)} ${j.status.padEnd(9)} ${fmtLa(j.dueAt)}${tail}${marker}${j.lastError ? ` err=${j.lastError}` : ''}`
      );
    }
  }
  console.log('');
}

if (!found) {
  console.log(filterEmail ? `No active enrollments matching "${filterEmail}".` : 'No active enrollments in any queue.');
}
