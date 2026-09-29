const {
  smsBody,
  day5Email,
  DAY7_CALL_SCRIPT,
  DAY0_CALL_SCRIPT_SECTIONS,
  firstNameFrom
} = require('./messages');
const twilioSms = require('../twilioSmsService');
const vapiOutbound = require('../vapiOutboundService');
const { sendPieDay5PatientEmail, sendPieStaffCallUrgentEmail } = require('../emailService');

const SMS_JOB_TYPES = {
  sms_day0: 'day0',
  sms_day1: 'day1',
  sms_day2: 'day2',
  sms_day3: 'day3',
  sms_day10: 'day10',
  sms_day14: 'day14'
};

function pieAutoresponderEnabled() {
  return process.env.PIE_AUTORESPONDER_ENABLED !== 'false';
}

async function runPieJob({ enrollment, job }) {
  const lead = enrollment.lead || {};
  const logPrefix = `[pie-autoresponder ${enrollment.id}/${job.type}]`;

  if (!pieAutoresponderEnabled()) {
    return { status: 'skipped', reason: 'PIE_AUTORESPONDER_ENABLED=false' };
  }

  if (!lead.phone && job.type.startsWith('sms_')) {
    return { status: 'skipped', reason: 'no_phone' };
  }

  if (!lead.email && job.type === 'email_day5') {
    return { status: 'skipped', reason: 'no_email' };
  }

  try {
    if (SMS_JOB_TYPES[job.type]) {
      if (!twilioSms.isConfigured()) {
        console.warn(`${logPrefix} Twilio not configured — skipping SMS`);
        return { status: 'skipped', reason: 'twilio_not_configured' };
      }
      const body = smsBody(SMS_JOB_TYPES[job.type], lead.fullName);
      const result = await twilioSms.sendSms({ to: lead.phone, body });
      console.log(`${logPrefix} SMS sent`, result.sid || result);
      return { status: 'sent', detail: result };
    }

    if (job.type === 'call_day0' || job.type === 'call_day7') {
      const callKind = job.type === 'call_day7' ? 'day7' : 'day0';
      if (vapiOutbound.vapiEnabled()) {
        const result = await vapiOutbound.createOutboundCall({ lead, callKind });
        if (result.skipped) {
          await notifyStaffForCall({ lead, callKind, reason: result.reason });
          return { status: 'skipped', reason: result.reason, staffNotified: true };
        }
        console.log(`${logPrefix} VAPI call started`, result.callId);
        return { status: 'sent', detail: result };
      }
      await notifyStaffForCall({ lead, callKind, reason: 'vapi_not_configured' });
      console.log(`${logPrefix} VAPI not configured — staff email sent`);
      return { status: 'sent', detail: 'staff_email_fallback' };
    }

    if (job.type === 'email_day5') {
      const { subject, text } = day5Email(lead.fullName);
      const result = await sendPieDay5PatientEmail({
        to: lead.email,
        subject,
        text,
        lead
      });
      console.log(`${logPrefix} Day 5 email sent`, result.messageId);
      return { status: 'sent', detail: result };
    }

    return { status: 'skipped', reason: 'unknown_job_type' };
  } catch (err) {
    console.error(`${logPrefix} failed:`, err.response?.data || err.message || err);
    return { status: 'error', error: err.message || String(err) };
  }
}

async function notifyStaffForCall({ lead, callKind, reason }) {
  const name = firstNameFrom(lead.fullName);
  const script =
    callKind === 'day7'
      ? DAY7_CALL_SCRIPT.replace(/\[Name\]/g, name)
      : Object.entries(DAY0_CALL_SCRIPT_SECTIONS)
          .map(([k, v]) => `${k.toUpperCase()}: ${v.replace(/\[Name\]/g, name)}`)
          .join('\n\n');

  await sendPieStaffCallUrgentEmail({
    lead,
    callKind,
    reason,
    script
  });
}

module.exports = {
  runPieJob,
  pieAutoresponderEnabled
};
