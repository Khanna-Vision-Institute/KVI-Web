#!/usr/bin/env node
/**
 * Run before deploy: node scripts/verify-pie-autoresponder.js
 * Exits 0 if server can start; does not enable autoresponder.
 */
const path = require('path');

process.chdir(path.join(__dirname, '..'));

require('./../services/pieAutoresponder/safe');
require('./../services/pieAutoresponder/messages');
require('./../services/pieAutoresponder/enroll');
require('./../services/pieAutoresponder/schedule');
require('./../services/twilioSmsService');
require('./../services/vapiOutboundService');

const { buildScheduledJobs } = require('./../services/pieAutoresponder/schedule');
const sample = buildScheduledJobs(new Date('2026-06-23T07:30:00.000Z')); // midnight-ish LA
const sms0 = sample.find((j) => j.type === 'sms_day0');
const call0 = sample.find((j) => j.type === 'call_day0');
if (!sms0 || !call0) throw new Error('schedule sample missing day0 jobs');
const laFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});
const smsLa = laFmt.format(new Date(sms0.dueAt));
const callLa = laFmt.format(new Date(call0.dueAt));
if (!smsLa.includes('1:00') || !callLa.includes('1:05')) {
  throw new Error(`expected 1:00/1:05 PM LA, got sms=${smsLa} call=${callLa}`);
}

const { execSync } = require('child_process');
for (const f of ['server.js', 'routes/booking.js']) {
  execSync(`node --check ${f}`, { stdio: 'inherit' });
}

console.log('OK — PIE autoresponder modules load; autoresponder OFF until PIE_AUTORESPONDER_ENABLED=true');
