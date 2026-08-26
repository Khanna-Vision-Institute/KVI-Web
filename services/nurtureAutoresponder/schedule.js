/**
 * Fixed local send window for nurture campaigns (default 1:00 PM America/Los_Angeles).
 * Env: NURTURE_AUTORESPONDER_TIMEZONE | PIE_AUTORESPONDER_TIMEZONE
 *      NURTURE_AUTORESPONDER_SEND_HOUR | PIE_AUTORESPONDER_SEND_HOUR
 *      NURTURE_AUTORESPONDER_SEND_MINUTE | PIE_AUTORESPONDER_SEND_MINUTE
 */

const crypto = require('crypto');

const DEFAULT_TZ = 'America/Los_Angeles';
const DEFAULT_HOUR = 13;
const DEFAULT_MINUTE = 0;

function scheduleConfig() {
  const tz =
    String(process.env.NURTURE_AUTORESPONDER_TIMEZONE || process.env.PIE_AUTORESPONDER_TIMEZONE || DEFAULT_TZ).trim() ||
    DEFAULT_TZ;
  const sendHour = parseInt(
    process.env.NURTURE_AUTORESPONDER_SEND_HOUR || process.env.PIE_AUTORESPONDER_SEND_HOUR || String(DEFAULT_HOUR),
    10
  );
  const sendMinute = parseInt(
    process.env.NURTURE_AUTORESPONDER_SEND_MINUTE ||
      process.env.PIE_AUTORESPONDER_SEND_MINUTE ||
      String(DEFAULT_MINUTE),
    10
  );
  return {
    tz,
    sendHour: Number.isFinite(sendHour) ? sendHour : DEFAULT_HOUR,
    sendMinute: Number.isFinite(sendMinute) ? sendMinute : DEFAULT_MINUTE
  };
}

function getZonedParts(date, timeZone) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
      .formatToParts(d)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  );
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10)
  };
}

function addCalendarDaysYmd(year, month, day, addDays) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + addDays);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate()
  };
}

function zonedLocalToUtc(local, timeZone) {
  let utcMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second || 0);
  for (let i = 0; i < 4; i += 1) {
    const p = getZonedParts(new Date(utcMs), timeZone);
    const shownAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const wantedAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second || 0);
    utcMs += wantedAsUtc - shownAsUtc;
  }
  return new Date(utcMs);
}

function nurtureAnchorDay(enrolledAt, cfg) {
  const p = getZonedParts(enrolledAt, cfg.tz);
  const enrolledMins = p.hour * 60 + p.minute;
  const sendMins = cfg.sendHour * 60 + cfg.sendMinute;
  if (enrolledMins < sendMins) {
    return { year: p.year, month: p.month, day: p.day };
  }
  return addCalendarDaysYmd(p.year, p.month, p.day, 1);
}

function dueAtLocalSendTime(enrolledAt, dayOffset, extraMinutes = 0) {
  const cfg = scheduleConfig();
  const anchor = nurtureAnchorDay(enrolledAt, cfg);
  const targetDay = addCalendarDaysYmd(anchor.year, anchor.month, anchor.day, dayOffset);
  const totalMinutes = cfg.sendHour * 60 + cfg.sendMinute + extraMinutes;
  const dayShift = Math.floor(totalMinutes / (24 * 60));
  const minuteOfDay = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const finalDay = addCalendarDaysYmd(targetDay.year, targetDay.month, targetDay.day, dayShift);
  return zonedLocalToUtc(
    {
      year: finalDay.year,
      month: finalDay.month,
      day: finalDay.day,
      hour: Math.floor(minuteOfDay / 60),
      minute: minuteOfDay % 60,
      second: 0
    },
    cfg.tz
  );
}

/** @param {Date} enrolledAt @param {[string, number, number][]} specs [type, dayOffset, extraMinutes] */
function buildJobsFromSpecs(enrolledAt, specs) {
  const base = enrolledAt instanceof Date ? enrolledAt : new Date(enrolledAt);
  return specs.map(([type, dayOffset, extraMinutes]) => ({
    id: crypto.randomBytes(8).toString('hex'),
    type,
    dueAt: dueAtLocalSendTime(base, dayOffset, extraMinutes).toISOString(),
    status: 'pending',
    attempts: 0
  }));
}

function reschedulePendingJobs(enrollment, specs) {
  const enrolledAt = new Date(enrollment.enrolledAt);
  const fresh = buildJobsFromSpecs(enrolledAt, specs);
  const byType = Object.fromEntries(fresh.map((j) => [j.type, j.dueAt]));
  let updated = 0;
  for (const job of enrollment.jobs || []) {
    if (job.status !== 'pending' && job.status !== 'processing') continue;
    const nextDue = byType[job.type];
    if (!nextDue) continue;
    job.dueAt = nextDue;
    if (job.status === 'processing') {
      job.status = 'pending';
      delete job.processingAt;
    }
    updated += 1;
  }
  return updated;
}

module.exports = {
  scheduleConfig,
  nurtureAnchorDay,
  dueAtLocalSendTime,
  buildJobsFromSpecs,
  reschedulePendingJobs,
  getZonedParts,
  zonedLocalToUtc
};
