const { dueAtLocalSendTime, scheduleConfig, zonedLocalToUtc, getZonedParts } = require('./schedule');

const CAMPAIGN_ORDER = ['smile', 'pterygium', 'pie'];

function computeTestStartAtLA() {
  const now = new Date();
  const today = dueAtLocalSendTime(now, 0, 0);
  if (today.getTime() > now.getTime()) return today;
  return dueAtLocalSendTime(now, 1, 0);
}

/**
 * @param {{ testStartAt?: string, testStartHour?: number, testStartMinute?: number }} [opts]
 */
function resolveTestStartAt(opts = {}) {
  if (opts.testStartAt) {
    const d = new Date(opts.testStartAt);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const hour = parseInt(opts.testStartHour, 10);
  const minute = parseInt(opts.testStartMinute ?? '0', 10);
  if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
    const cfg = scheduleConfig();
    const now = new Date();
    const p = getZonedParts(now, cfg.tz);
    return zonedLocalToUtc(
      {
        year: p.year,
        month: p.month,
        day: p.day,
        hour,
        minute: Number.isFinite(minute) ? minute : 0,
        second: 0
      },
      cfg.tz
    );
  }

  return computeTestStartAtLA();
}

/**
 * @param {Record<string, string>} enrollmentIds
 * @param {number} [gapMinutes]
 * @param {{ testStartAt?: string, testStartHour?: number, testStartMinute?: number }} [startOpts]
 */
function applyTestStaggerForRecipient(enrollmentIds, gapMinutes = 5, startOpts = {}) {
  const smileQ = require('../smileAutoresponder/queue');
  const pteryQ = require('../pterygiumAutoresponder/queue');
  const pieQ = require('../pieAutoresponder/queue');
  const queues = { smile: smileQ, pterygium: pteryQ, pie: pieQ };

  const startAt = resolveTestStartAt(startOpts);
  let slot = 0;
  const timeline = [];

  for (const campaign of CAMPAIGN_ORDER) {
    const enrollmentId = enrollmentIds[campaign];
    if (!enrollmentId || !queues[campaign]?.staggerPendingJobs) continue;
    const result = queues[campaign].staggerPendingJobs(enrollmentId, startAt, slot, gapMinutes);
    for (const j of result.jobs) {
      timeline.push({ campaign, type: j.type, dueAt: j.dueAt });
    }
    slot = result.nextSlot;
  }

  return {
    startAt: startAt.toISOString(),
    timezone: 'America/Los_Angeles',
    gapMinutes,
    touchpointCount: timeline.length,
    timeline
  };
}

function cancelActiveAcrossCampaigns({ email, phone }) {
  const smileQ = require('../smileAutoresponder/queue');
  const pteryQ = require('../pterygiumAutoresponder/queue');
  const pieQ = require('../pieAutoresponder/queue');
  return {
    smile: smileQ.cancelActiveForContact({ email, phone }),
    pterygium: pteryQ.cancelActiveForContact({ email, phone }),
    pie: pieQ.cancelActiveForContact({ email, phone })
  };
}

module.exports = {
  CAMPAIGN_ORDER,
  computeTestStartAtLA,
  resolveTestStartAt,
  applyTestStaggerForRecipient,
  cancelActiveAcrossCampaigns
};
