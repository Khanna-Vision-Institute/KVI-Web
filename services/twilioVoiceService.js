const { firstNameFrom } = require('./pieAutoresponder/messages');
const { validateOutboundPhone, getClient, isConfigured } = require('./twilioSmsService');

const CALLBACK = process.env.PIE_CALLBACK_PHONE || '(805) 230-2126';

function voiceEnabled() {
  return (
    isConfigured() &&
    String(process.env.PIE_AUTORESPONDER_TWILIO_VOICE_ENABLED || 'true').toLowerCase() !== 'false'
  );
}

function buildDay0Twiml(fullName) {
  const first = firstNameFrom(fullName);
  const text = `Hi ${first}, this is Guru from Doctor Khanna's office at Khanna Vision Institute. ` +
    `Thank you for your interest in PIE vision correction. We'd love to help you explore whether PIE is right for you. ` +
    `Please call us back at ${CALLBACK.replace(/\D/g, '').split('').join(' ')} to schedule your free consultation. ` +
    `We look forward to speaking with you.`;
  return `<Response><Say voice="Polly.Joanna">${escapeXml(text)}</Say></Response>`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function createOutboundVoiceCall({ lead, callKind = 'day0' }) {
  if (!voiceEnabled()) {
    return { skipped: true, reason: 'twilio_voice_disabled' };
  }

  const check = validateOutboundPhone(lead.phone, { location: lead.location });
  if (!check.ok) return { skipped: true, reason: check.reason };

  const from = process.env.TWILIO_PHONE || process.env.TWILIO_FROM;
  const twiml = buildDay0Twiml(lead.fullName);

  const call = await getClient().calls.create({
    to: check.e164,
    from,
    twiml
  });

  console.log('[twilio-voice] outbound call', call.sid, 'to', check.e164, 'kind', callKind);
  return { ok: true, callSid: call.sid, phone: check.e164 };
}

module.exports = { voiceEnabled, createOutboundVoiceCall };
