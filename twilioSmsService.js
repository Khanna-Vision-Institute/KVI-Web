const twilio = require('twilio');

let client;

function isConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_PHONE || process.env.TWILIO_FROM)
  );
}

function getClient() {
  if (!isConfigured()) {
    throw new Error('Twilio is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE).');
  }
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

/** Normalize to E.164; defaults US (+1) for 10-digit numbers. */
function normalizePhoneE164(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (String(raw).trim().startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return null;
}

async function sendSms({ to, body }) {
  if (process.env.PIE_AUTORESPONDER_SMS_ENABLED === 'false') {
    return { skipped: true, reason: 'PIE_AUTORESPONDER_SMS_ENABLED=false' };
  }
  const toE164 = normalizePhoneE164(to);
  if (!toE164) {
    throw new Error(`Invalid SMS destination: ${to}`);
  }
  const from = process.env.TWILIO_PHONE || process.env.TWILIO_FROM;
  const message = await getClient().messages.create({
    to: toE164,
    from,
    body: String(body || '').trim()
  });
  return { sid: message.sid, to: toE164 };
}

module.exports = {
  isConfigured,
  normalizePhoneE164,
  sendSms
};
