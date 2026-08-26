const path = require('path');
const { buildJobsFromSpecs } = require('../nurtureAutoresponder/schedule');
const { createCampaignQueue } = require('../nurtureAutoresponder/queueFactory');

const JOB_SPECS = [
  ['sms_day0', 0, 0],
  ['sms_day1', 1, 0],
  ['sms_day2', 2, 0],
  ['sms_day3', 3, 0],
  ['email_day3', 3, 15],
  ['sms_day5', 5, 0],
  ['call_day5', 5, 5],
  ['sms_day7', 7, 0],
  ['call_day7', 7, 5],
  ['sms_day10', 10, 0],
  ['sms_day14', 14, 0]
];

const QUEUE_PATH =
  process.env.PTERYGIUM_AUTORESPONDER_QUEUE_PATH ||
  path.join(__dirname, '../../data/pterygium-autoresponder-queue.json');

const queue = createCampaignQueue({
  queuePath: QUEUE_PATH,
  buildScheduledJobs: (enrolledAt) => buildJobsFromSpecs(enrolledAt, JOB_SPECS),
  rescheduleSpecs: JOB_SPECS,
  dedupHoursEnv: 'PTERYGIUM_AUTORESPONDER_DEDUP_HOURS'
});

module.exports = { ...queue, JOB_SPECS };
