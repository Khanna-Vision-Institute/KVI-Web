#!/usr/bin/env node
/**
 * Enroll Dr. Khanna, Ted, and Jill into SMILE → Pterygium → PIE test sequences on this server.
 *
 * Usage (on EC2, from repo root):
 *   cd "/home/ec2-user/kvi-home/kvi home"
 *   node scripts/enroll-team-on-server.js
 *
 * Optional env:
 *   NURTURE_TEST_GAP_MINUTES=5
 *   NURTURE_TEST_START_HOUR=12
 *   NURTURE_TEST_START_MINUTE=0
 */
const path = require('path');

process.chdir(path.join(__dirname, '..'));
require('dotenv').config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const {
  applyTestStaggerForRecipient,
  cancelActiveAcrossCampaigns
} = require('../services/nurtureAutoresponder/testSchedule');
const { enrollSmileStage1Autoresponder } = require('../services/smileAutoresponder/enroll');
const { enrollPterygiumStage1Autoresponder } = require('../services/pterygiumAutoresponder/enroll');
const { enrollPieStage1Autoresponder } = require('../services/pieAutoresponder/enroll');

const RECIPIENTS = [
  {
    fullName: 'Dr. Khanna',
    email: 'superlasik@gmail.com',
    phone: '+13104037497',
    smileVariant: 'a'
  },
  {
    fullName: 'Ted',
    email: 'Ted@khannavision.com',
    phone: '+18058328062',
    smileVariant: 'a'
  },
  {
    fullName: 'Jill',
    email: 'info@khannavision.com',
    phone: '+18059081132',
    smileVariant: 'a'
  }
];

const GAP_MINUTES = parseInt(process.env.NURTURE_TEST_GAP_MINUTES || '5', 10);
const TEST_START = {
  testStartHour: parseInt(process.env.NURTURE_TEST_START_HOUR || '12', 10),
  testStartMinute: parseInt(process.env.NURTURE_TEST_START_MINUTE || '0', 10)
};

async function enrollRecipient(lead) {
  console.log(`\n--- ${lead.fullName} (${lead.email}) ---`);
  console.log('Cancelling previous active nurture enrollments...');
  console.log(cancelActiveAcrossCampaigns({ email: lead.email, phone: lead.phone }));

  const enrollmentIds = {};
  const results = {};

  results.smile = await enrollSmileStage1Autoresponder(lead, {
    variant: lead.smileVariant,
    allowTest: true
  });
  if (results.smile.enrollmentId) enrollmentIds.smile = results.smile.enrollmentId;

  results.pterygium = await enrollPterygiumStage1Autoresponder(lead, { allowTest: true });
  if (results.pterygium.enrollmentId) enrollmentIds.pterygium = results.pterygium.enrollmentId;

  results.pie = await enrollPieStage1Autoresponder(
    {
      ...lead,
      surgeryExamType: 'PIE',
      pageUrl: '/procedures/lens-solutions/pie'
    },
    { allowInternal: true }
  );
  if (results.pie.enrollmentId) enrollmentIds.pie = results.pie.enrollmentId;

  const schedule = applyTestStaggerForRecipient(enrollmentIds, GAP_MINUTES, TEST_START);

  return { lead, results, schedule };
}

async function main() {
  const all = [];
  for (const lead of RECIPIENTS) {
    all.push(await enrollRecipient(lead));
  }

  console.log('\n=== Summary ===');
  for (const row of all) {
    console.log(`\n${row.lead.fullName}:`);
    console.log('  enroll:', JSON.stringify(row.results));
    console.log('  first touchpoint:', row.schedule.startAt, `(then every ${GAP_MINUTES} min — SMILE → Pterygium → PIE)`);
    console.log('  touchpoints:', row.schedule.touchpointCount);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
