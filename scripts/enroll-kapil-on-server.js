#!/usr/bin/env node
/**
 * Enroll Kapil into SMILE → Pterygium → PIE test sequences on this server.
 * No server.js / HTTP route required.
 *
 * Usage (on EC2, from repo root):
 *   cd "/home/ec2-user/kvi-home/kvi home"
 *   node scripts/enroll-kapil-on-server.js
 */
const path = require('path');

process.chdir(path.join(__dirname, '..'));
require('dotenv').config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const { applyTestStaggerForRecipient, cancelActiveAcrossCampaigns } = require('../services/nurtureAutoresponder/testSchedule');
const { enrollSmileStage1Autoresponder } = require('../services/smileAutoresponder/enroll');
const { enrollPterygiumStage1Autoresponder } = require('../services/pterygiumAutoresponder/enroll');
const { enrollPieStage1Autoresponder } = require('../services/pieAutoresponder/enroll');

const KAPIL = {
  fullName: 'Kapil',
  email: 'kapil@khannavision.com',
  phone: '+18059061634',
  smileVariant: 'a'
};

const GAP_MINUTES = parseInt(process.env.NURTURE_TEST_GAP_MINUTES || '5', 10);
const TEST_START = {
  testStartHour: parseInt(process.env.NURTURE_TEST_START_HOUR || '11', 10),
  testStartMinute: parseInt(process.env.NURTURE_TEST_START_MINUTE || '0', 10)
};

async function main() {
  console.log('Cancelling previous active nurture enrollments for Kapil...');
  console.log(cancelActiveAcrossCampaigns({ email: KAPIL.email, phone: KAPIL.phone }));

  const enrollmentIds = {};
  const results = {};

  results.smile = await enrollSmileStage1Autoresponder(KAPIL, {
    variant: KAPIL.smileVariant,
    allowTest: true
  });
  if (results.smile.enrollmentId) enrollmentIds.smile = results.smile.enrollmentId;

  results.pterygium = await enrollPterygiumStage1Autoresponder(KAPIL, { allowTest: true });
  if (results.pterygium.enrollmentId) enrollmentIds.pterygium = results.pterygium.enrollmentId;

  results.pie = await enrollPieStage1Autoresponder(
    {
      ...KAPIL,
      surgeryExamType: 'PIE',
      pageUrl: '/procedures/lens-solutions/pie'
    },
    { allowInternal: true }
  );
  if (results.pie.enrollmentId) enrollmentIds.pie = results.pie.enrollmentId;

  const schedule = applyTestStaggerForRecipient(enrollmentIds, GAP_MINUTES, TEST_START);

  console.log('\nEnroll results:', JSON.stringify(results, null, 2));
  console.log('\nTest schedule:', JSON.stringify(schedule, null, 2));
  console.log(
    `\nDone. First touchpoint: ${schedule.startAt} (America/Los_Angeles), then every ${GAP_MINUTES} min — SMILE → Pterygium → PIE.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
