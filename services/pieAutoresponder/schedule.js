/**
 * PIE Stage 1 schedule — fixed 1:00 PM Los Angeles send window.
 */
const {
  scheduleConfig,
  nurtureAnchorDay,
  dueAtLocalSendTime,
  buildJobsFromSpecs,
  reschedulePendingJobs: rescheduleFromSpecs
} = require('../nurtureAutoresponder/schedule');

const CALL_OFFSET = parseInt(process.env.PIE_AUTORESPONDER_CALL_DAY0_OFFSET_MINUTES || '5', 10);

const JOB_SPECS = [
  ['sms_day0', 0, 0],
  ['call_day0', 0, Number.isFinite(CALL_OFFSET) ? CALL_OFFSET : 5],
  ['sms_day1', 1, 0],
  ['sms_day2', 2, 0],
  ['sms_day3', 3, 0],
  ['email_day5', 5, 0],
  ['call_day7', 7, 0],
  ['sms_day10', 10, 0],
  ['sms_day14', 14, 0]
];

function buildScheduledJobs(enrolledAt) {
  return buildJobsFromSpecs(enrolledAt, JOB_SPECS);
}

function reschedulePendingJobs(enrollment) {
  return rescheduleFromSpecs(enrollment, JOB_SPECS);
}

module.exports = {
  scheduleConfig,
  nurtureAnchorDay,
  dueAtLocalSendTime,
  buildScheduledJobs,
  reschedulePendingJobs
};
