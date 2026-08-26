const axios = require('axios');
const { validateOutboundPhone } = require('./twilioSmsService');

const VAPI_API_BASE = (process.env.VAPI_API_BASE || 'https://api.vapi.ai').replace(/\/$/, '');

function isVapiConfigured() {
  return !!(
    process.env.VAPI_API_KEY &&
    process.env.VAPI_PHONE_NUMBER_ID &&
    (process.env.VAPI_PIE_ASSISTANT_ID || process.env.VAPI_ASSISTANT_ID)
  );
}

function vapiEnabled() {
  return (
    String(process.env.PIE_AUTORESPONDER_VAPI_ENABLED || 'true').toLowerCase() !== 'false' &&
    isVapiConfigured()
  );
}

function formatVapiError(err) {
  if (err.response?.data) {
    return typeof err.response.data === 'string'
      ? err.response.data
      : JSON.stringify(err.response.data);
  }
  return err.message || String(err);
}

async function createOutboundCall({ lead, callKind = 'day0' }) {
  if (!vapiEnabled()) {
    return { skipped: true, reason: 'vapi_not_configured' };
  }

  const check = validateOutboundPhone(lead.phone, { location: lead.location });
  if (!check.ok) {
    console.warn('[vapi] invalid phone for lead:', lead.phone);
    return { skipped: true, reason: check.reason };
  }
  const phone = check.e164;

  const assistantId =
    callKind === 'day7'
      ? process.env.VAPI_PIE_DAY7_ASSISTANT_ID ||
        process.env.VAPI_PIE_ASSISTANT_ID ||
        process.env.VAPI_ASSISTANT_ID
      : process.env.VAPI_PIE_ASSISTANT_ID || process.env.VAPI_ASSISTANT_ID;

  const payload = {
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
    customer: { number: phone, name: lead.fullName || 'Patient' },
    assistantId,
    metadata: {
      source: 'kvi-pie-autoresponder',
      callKind,
      email: lead.email || '',
      leadName: lead.fullName || ''
    }
  };

  try {
    const { data } = await axios.post(`${VAPI_API_BASE}/call`, payload, {
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    console.log('[vapi] outbound call queued:', data.id || data.callId, 'to', phone);
    return { ok: true, callId: data.id || data.callId, phone };
  } catch (err) {
    const msg = formatVapiError(err);
    console.error('[vapi] call failed:', msg);
    return { skipped: true, reason: 'vapi_api_error', error: msg, phone };
  }
}

module.exports = {
  isVapiConfigured,
  vapiEnabled,
  createOutboundCall
};
