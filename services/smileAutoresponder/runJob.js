const { smsBody, day5Email, formatDay7CallScript } = require('./messages');
const { sendSms, sendPatientEmail, placeOutboundCall } = require('../nurtureAutoresponder/runJobCommon');

const SMS_KEYS = {
  sms_day0: 'day0',
  sms_day1: 'day1',
  sms_day3: 'day3'
};

async function runSmileJob({ enrollment, job }) {
  const lead = { ...enrollment.lead, campaign: 'smile' };
  const variant = enrollment.variant || lead.smileVariant || 'a';
  const tag = `[smile-autoresponder ${job.type}]`;

  try {
    const smsKey = SMS_KEYS[job.type];
    if (smsKey) {
      return sendSms({ lead, body: smsBody(variant, smsKey, lead.fullName), tag });
    }

    if (job.type === 'email_day5') {
      const { subject, text } = day5Email(lead.fullName);
      return sendPatientEmail({ lead, subject, text, tag });
    }

    if (job.type === 'call_day7') {
      return placeOutboundCall({
        lead,
        callKind: 'day7',
        tag,
        staffScript: formatDay7CallScript(lead.fullName),
        staffLabel: 'SMILE GenZ Day 7 follow-up call'
      });
    }

    return { status: 'skipped', reason: 'unknown_type' };
  } catch (err) {
    console.error(`${tag} error:`, err.message || err);
    return { status: 'error', error: err.message || String(err) };
  }
}

module.exports = { runSmileJob };
