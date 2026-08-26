const { smsBody, day3Email, formatDay5CallScript, formatDay7CallScript } = require('./messages');
const { sendSms, sendPatientEmail, placeOutboundCall } = require('../nurtureAutoresponder/runJobCommon');

const SMS_KEYS = {
  sms_day0: 'day0',
  sms_day1: 'day1',
  sms_day2: 'day2',
  sms_day3: 'day3',
  sms_day5: 'day5',
  sms_day7: 'day7',
  sms_day10: 'day10',
  sms_day14: 'day14'
};

async function runPterygiumJob({ enrollment, job }) {
  const lead = { ...enrollment.lead, campaign: 'pterygium' };
  const tag = `[pterygium-autoresponder ${job.type}]`;

  try {
    const smsKey = SMS_KEYS[job.type];
    if (smsKey) {
      return sendSms({ lead, body: smsBody(smsKey, lead.fullName), tag });
    }

    if (job.type === 'email_day3') {
      const { subject, text } = day3Email(lead.fullName);
      return sendPatientEmail({ lead, subject, text, tag });
    }

    if (job.type === 'call_day5') {
      return placeOutboundCall({
        lead,
        callKind: 'day5',
        tag,
        staffScript: formatDay5CallScript(lead.fullName),
        staffLabel: 'Pterygium Day 5 outreach call'
      });
    }

    if (job.type === 'call_day7') {
      return placeOutboundCall({
        lead,
        callKind: 'day7',
        tag,
        staffScript: formatDay7CallScript(lead.fullName),
        staffLabel: 'Pterygium Day 7 follow-up call'
      });
    }

    return { status: 'skipped', reason: 'unknown_type' };
  } catch (err) {
    console.error(`${tag} error:`, err.message || err);
    return { status: 'error', error: err.message || String(err) };
  }
}

module.exports = { runPterygiumJob };
