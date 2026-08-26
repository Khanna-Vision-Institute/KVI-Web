#!/usr/bin/env node
/**
 * Cancel all pending/processing PIE nurture jobs (SMS/calls/emails still queued).
 * Already-sent touches are kept. New PIE bookings will enroll fresh sequences afterward.
 *
 *   node scripts/clear-pie-autoresponder-queue.js          # dry-run (preview)
 *   node scripts/clear-pie-autoresponder-queue.js --apply  # cancel scheduled jobs
 */
const path = require('path');

process.chdir(path.join(__dirname, '..'));

require('dotenv').config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const { cancelAllScheduledJobs, QUEUE_PATH } = require('../services/pieAutoresponder/queue');

const apply = process.argv.includes('--apply');
const result = cancelAllScheduledJobs({ dryRun: !apply });

console.log(`Queue file: ${QUEUE_PATH}`);
console.log(`Mode: ${apply ? 'APPLY (cancelled)' : 'DRY-RUN (no changes)'}`);
console.log(`Enrollments with scheduled jobs: ${result.enrollmentsCancelled}`);
console.log(`Jobs cancelled (pending/processing): ${result.jobsCancelled}`);
console.log(`Active enrollments remaining: ${result.activeRemaining}`);

if (!apply && result.jobsCancelled > 0) {
  console.log('\nRe-run with --apply to cancel these scheduled autoresponders.');
  process.exit(0);
}

if (apply && result.jobsCancelled === 0) {
  console.log('\nNothing scheduled to cancel.');
}

process.exit(0);
