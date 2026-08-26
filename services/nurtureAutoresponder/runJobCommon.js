const { isPermanentDeliveryError } = require('../twilioSmsService');

async function sendSms({ lead, body, tag }) {
  const twilioSms = require('../twilioSmsService');
  if (!twilioSms.isConfigured()) {
    console.warn(`${tag} Twilio not configured — skip`);
    return { status: 'skipped', reason: 'twilio_not_configured' };
  }
  const result = await twilioSms.sendSms({
    to: lead.phone,
    body,
    location: lead.location || ''
  });
  console.log(`${tag} sent`, result.sid, 'to', result.to);
  return { status: 'sent', detail: 'sms' };
}

async function sendPatientEmail({ lead, subject, text, tag }) {
  const { sendPatientNurtureEmail } = require('./mail');
  await sendPatientNurtureEmail({ to: lead.email, subject, text });
  console.log(`${tag} email sent`);
  return { status: 'sent', detail: 'email' };
}

async function placeOutboundCall({ lead, callKind, tag, staffScript, staffLabel }) {
  let patientCalled = false;
  let lastError = 'no_call_provider';

  const vapi = require('../vapiOutboundService');
  if (vapi.vapiEnabled()) {
    try {
      const result = await vapi.createOutboundCall({ lead, callKind });
      if (result.ok && result.callId) {
        console.log(`${tag} VAPI callId=${result.callId} phone=${result.phone}`);
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
        return { status: 'sent', detail: 'twilio_voice' };
      }
      lastError = voiceResult.reason || lastError;
    } catch (voiceErr) {
      lastError = voiceErr.message || String(voiceErr);
      console.error(`${tag} Twilio voice error:`, lastError);
    }
  }

  const { sendStaffCallUrgentEmail } = require('./mail');
  await sendStaffCallUrgentEmail({
    lead,
    callKind,
    reason: lastError,
    script: staffScript,
    label: staffLabel
  });
  console.log(`${tag} staff alert (${lastError}) — patient was not called`);
  return { status: 'error', detail: 'staff_only', error: lastError };
}

async function processDueJobsForCampaign({ campaign, queue, runJob }) {
  const due = queue.getDueJobs();
  if (due.length) {
    console.log(
      `[${campaign}] processing ${due.length} due job(s): ${due.map((d) => d.type).join(', ')}`
    );
  }

  for (const { enrollmentId, jobId, type } of due) {
    const claimed = queue.claimJob(enrollmentId, jobId);
    if (!claimed) continue;

    const { enrollment, job } = claimed;
    const outcome = await runJob({ enrollment, job });
    const attempts = (job.attempts || 0) + 1;

    if (outcome.status === 'sent' || outcome.status === 'skipped') {
      queue.markJob(enrollment.id, job.id, {
        status: outcome.status,
        attempts,
        completedAt: new Date().toISOString(),
        detail: outcome.detail || null
      });
    } else if (outcome.error && isPermanentDeliveryError(outcome.error)) {
      queue.markJob(enrollment.id, job.id, {
        status: 'failed',
        attempts,
        lastError: outcome.error,
        completedAt: new Date().toISOString()
      });
    } else if (attempts >= 3) {
      queue.markJob(enrollment.id, job.id, {
        status: 'failed',
        attempts,
        lastError: outcome.error
      });
    } else {
      queue.markJob(enrollment.id, job.id, {
        status: 'pending',
        attempts,
        lastError: outcome.error
      });
    }
  }

  return { processed: due.length };
}

module.exports = {
  sendSms,
  sendPatientEmail,
  placeOutboundCall,
  processDueJobsForCampaign
};
