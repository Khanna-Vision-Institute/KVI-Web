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
    throw new Error('Twilio not configured');
  }
  if (!client) {
    // eslint-disable-next-line global-require
    client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

/** Valid US NANP: NXX-NXX-XXXX (N=2-9) */
function isValidUsNanp(tenDigits) {
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(String(tenDigits || ''));
}

/** Valid India mobile: 10 digits starting 6–9 */
function isValidIndiaMobile(tenDigits) {
  return /^[6-9]\d{9}$/.test(String(tenDigits || ''));
}

/**
 * Normalize to E.164. Returns null if number is clearly invalid for outbound SMS/voice.
 */
function normalizePhoneE164(raw, opts = {}) {
  const s = String(raw || '').trim();
  const digits = s.replace(/\D/g, '');
  if (!digits) return null;

  if (s.startsWith('+')) {
    if (digits.startsWith('1') && digits.length === 11) {
      const ten = digits.slice(1);
      return isValidUsNanp(ten) ? `+1${ten}` : null;
    }
    if (digits.startsWith('91') && digits.length === 12) {
      const ten = digits.slice(2);
      return isValidIndiaMobile(ten) ? `+91${ten}` : null;
    }
    if (digits.length >= 10) return `+${digits}`;
    return null;
  }

  const location = String(opts.location || '').toLowerCase();
  const preferUs =
    location.includes('beverly') ||
    location.includes('westlake') ||
    location.includes('california') ||
    location.includes('los angeles');

  if (digits.length === 12 && digits.startsWith('91')) {
    const ten = digits.slice(2);
    return isValidIndiaMobile(ten) ? `+91${ten}` : null;
  }

  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits) && !preferUs) {
    return `+91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    const ten = digits.slice(1);
    if (isValidUsNanp(ten)) return `+1${ten}`;
    if (isValidIndiaMobile(ten)) return `+91${ten}`;
    return null;
  }

  if (digits.length === 10) {
    return isValidUsNanp(digits) ? `+1${digits}` : null;
  }

  return null;
}

function validateOutboundPhone(raw, opts = {}) {
  const e164 = normalizePhoneE164(raw, opts);
  if (!e164) {
    return { ok: false, reason: 'invalid_phone_format', raw: String(raw || '') };
  }
  return { ok: true, e164 };
}

function isPermanentDeliveryError(message) {
  const m = String(message || '').toLowerCase();
  return (
    (m.includes('invalid') && m.includes('phone')) ||
    m.includes('permission to send an sms') ||
    m.includes('geo permissions') ||
    m.includes('unsubscribed') ||
    m.includes('cannot be reached')
  );
}

async function sendSms({ to, body, location }) {
  const check = validateOutboundPhone(to, { location });
  if (!check.ok) throw new Error(`Invalid phone: ${to}`);
  const from = process.env.TWILIO_PHONE || process.env.TWILIO_FROM;
  const message = await getClient().messages.create({
    to: check.e164,
    from,
    body: String(body || '').trim()
  });
  return { sid: message.sid, to: check.e164 };
}

module.exports = {
  isConfigured,
  normalizePhoneE164,
  validateOutboundPhone,
  isPermanentDeliveryError,
  sendSms,
  getClient
};
