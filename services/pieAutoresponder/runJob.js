const {
  smsBody,
  day5Email,
  DAY7_CALL_SCRIPT,
  formatDay0CallScript,
  firstNameFrom,
  PIE_CALL_AGENT_NAME
} = require('./messages');

const SMS_KEYS = {
  sms_day0: 'day0',
  sms_day1: 'day1',
  sms_day2: 'day2',
  sms_day3: 'day3',
  sms_day10: 'day10',
  sms_day14: 'day14'
};

async function notifyStaffCall(lead, callKind, reason) {
  const { sendStaffCallUrgentEmail } = require('./mail');
  const name = firstNameFrom(lead.fullName);
  const script =
    callKind === 'day7'
      ? DAY7_CALL_SCRIPT.replace(/\[Name\]/g, name).replace(/\[Agent\]/g, PIE_CALL_AGENT_NAME)
      : formatDay0CallScript(lead.fullName);
  await sendStaffCallUrgentEmail({ lead, callKind, reason, script });
}

async function runPieJob({ enrollment, job }) {
  const lead = enrollment.lead || {};
  const tag = `[pie-autoresponder ${job.type}]`;

  try {
    if (SMS_KEYS[job.type]) {
      const twilioSms = require('../twilioSmsService');
      if (!twilioSms.isConfigured()) {
        console.warn(`${tag} Twilio not configured — skip`);
        return { status: 'skipped', reason: 'twilio_not_configured' };
      }
      const result = await twilioSms.sendSms({
        to: lead.phone,
        body: smsBody(SMS_KEYS[job.type], lead.fullName),
        location: lead.location
      });
      console.log(`${tag} sent`, result.sid, 'to', result.to);
      return { status: 'sent', detail: 'sms' };
    }

    if (job.type === 'call_day0' || job.type === 'call_day7') {
      const callKind = job.type === 'call_day7' ? 'day7' : 'day0';
      let patientCalled = false;
      let lastError = 'no_call_provider';

      const vapi = require('../vapiOutboundService');
      if (vapi.vapiEnabled()) {
        try {
          const result = await vapi.createOutboundCall({ lead, callKind });
          if (result.ok && result.callId) {
            console.log(`${tag} VAPI callId=${result.callId} phone=${result.phone}`);
            patientCalled = true;
            return { status: 'sent', detail: 'vapi_call' };
          }
          lastError = result.reason || result.error || 'vapi_skipped';
          console.warn(`${tag} VAPI did not place call:`, lastError);
        } catch (vapiErr) {
          lastError = vapiErr.message || String(vapiErr);
          console.error(`${tag} VAPI error:`, lastError);
        }
      } else {
        lastError = 'vapi_not_configured';
      }

      const twilioVoice = require('../twilioVoiceService');
      if (!patientCalled && twilioVoice.voiceEnabled()) {
        try {
          const voiceResult = await twilioVoice.createOutboundVoiceCall({ lead, callKind });
          if (voiceResult.ok) {
            console.log(`${tag} Twilio voice ${voiceResult.callSid} to ${voiceResult.phone}`);
            patientCalled = true;
            return { status: 'sent', detail: 'twilio_voice' };
          }
          lastError = voiceResult.reason || lastError;
        } catch (voiceErr) {
          lastError = voiceErr.message || String(voiceErr);
          console.error(`${tag} Twilio voice error:`, lastError);
        }
      }

      await notifyStaffCall(lead, callKind, lastError);
      console.log(`${tag} staff alert (${lastError}) — patient was not called`);
      return { status: 'error', detail: 'staff_only', error: lastError };
    }

    if (job.type === 'email_day5') {
      const { subject, text } = day5Email(lead.fullName);
      const { sendDay5PatientEmail } = require('./mail');
      await sendDay5PatientEmail({ to: lead.email, subject, text });
      console.log(`${tag} email sent`);
      return { status: 'sent', detail: 'email' };
    }

    return { status: 'skipped', reason: 'unknown_type' };
  } catch (err) {
    console.error(`${tag} error:`, err.message || err);
    return { status: 'error', error: err.message || String(err) };
  }
}

module.exports = { runPieJob };
