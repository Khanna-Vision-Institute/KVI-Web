#!/usr/bin/env node
/**
 * Move pending PIE nurture jobs to 1:00 PM America/Los_Angeles (or .env overrides).
 *
 *   node scripts/reschedule-pie-autoresponder-pending.js          # dry-run
 *   node scripts/reschedule-pie-autoresponder-pending.js --apply    # write queue
 */
const path = require('path');
process.chdir(path.join(__dirname, '..'));

require('dotenv').config();

const { scheduleConfig, buildScheduledJobs } = require('../services/pieAutoresponder/schedule');
const queue = require('../services/pieAutoresponder/queue');

const apply = process.argv.includes('--apply');
const cfg = scheduleConfig();

console.log('PIE send window:', {
  timezone: cfg.tz,
  hour: cfg.sendHour,
  minute: cfg.sendMinute,
  callDay0OffsetMinutes: cfg.callDay0Offset
});
console.log('Mode:', apply ? 'APPLY' : 'dry-run');
console.log('');

const preview = [];
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(queue.QUEUE_PATH, 'utf8'));

for (const enrollment of data.enrollments || []) {
  if (enrollment.status !== 'active') continue;
  const enrolledAt = new Date(enrollment.enrolledAt);
  const freshByType = Object.fromEntries(
    buildScheduledJobs(enrolledAt).map((j) => [j.type, j.dueAt])
  );
  for (const job of enrollment.jobs || []) {
    if (job.status !== 'pending' && job.status !== 'processing') continue;
    const nextDue = freshByType[job.type];
    if (!nextDue || nextDue === job.dueAt) continue;
    preview.push({
      email: enrollment.email,
      type: job.type,
      from: job.dueAt,
      to: nextDue
    });
  }
}

if (!preview.length) {
  console.log('No pending jobs need rescheduling.');
  process.exit(0);
}

for (const row of preview) {
  console.log(`${row.email}  ${row.type}`);
  console.log(`  was: ${row.from}`);
  console.log(`  now: ${row.to}`);
}

if (apply) {
  const result = queue.rescheduleActivePendingJobs();
  console.log('');
  console.log(`Updated ${result.jobs} job(s) across ${result.enrollments} active enrollment(s).`);
} else {
  console.log('');
  console.log(`Would update ${preview.length} job(s). Re-run with --apply to write.`);
}
