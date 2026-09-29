const axios = require('axios');
const { buildPieStage1SystemPrompt, buildPieDay7SystemPrompt } = require('./pieAutoresponder/vapiPrompt');
const { normalizePhoneE164 } = require('./twilioSmsService');

const VAPI_API_BASE = (process.env.VAPI_API_BASE || 'https://api.vapi.ai').replace(/\/$/, '');

function isVapiConfigured() {
  return !!(
    process.env.VAPI_API_KEY &&
    process.env.VAPI_PHONE_NUMBER_ID &&
    (process.env.VAPI_PIE_ASSISTANT_ID || process.env.VAPI_ASSISTANT_ID)
  );
}

function vapiEnabled() {
  return process.env.PIE_AUTORESPONDER_VAPI_ENABLED !== 'false' && isVapiConfigured();
}

async function createOutboundCall({ lead, callKind = 'day0' }) {
  if (!vapiEnabled()) {
    return { skipped: true, reason: 'VAPI not configured or PIE_AUTORESPONDER_VAPI_ENABLED=false' };
  }

  const phone = normalizePhoneE164(lead.phone);
  if (!phone) {
    return { skipped: true, reason: 'invalid_phone' };
  }

  const assistantId =
    callKind === 'day7'
      ? process.env.VAPI_PIE_DAY7_ASSISTANT_ID ||
        process.env.VAPI_PIE_ASSISTANT_ID ||
        process.env.VAPI_ASSISTANT_ID
      : process.env.VAPI_PIE_ASSISTANT_ID || process.env.VAPI_ASSISTANT_ID;

  const systemPrompt =
    callKind === 'day7'
      ? buildPieDay7SystemPrompt(lead)
      : buildPieStage1SystemPrompt(lead);

  const payload = {
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
    customer: {
      number: phone,
      name: lead.fullName || lead.firstName || 'Patient'
    },
    assistantId,
    assistantOverrides: {
      model: {
        provider: process.env.VAPI_MODEL_PROVIDER || 'openai',
        model: process.env.VAPI_MODEL_NAME || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          }
        ]
      },
      variableValues: {
        patientName: lead.fullName || '',
        age: String(lead.age || ''),
        location: lead.location || '',
        consultDate: lead.date || lead.preferredDate || '',
        consultTime: lead.time || lead.preferredTime || '',
        procedure: 'PIE',
        stage: callKind === 'day7' ? 'lead_to_consultation_day7' : 'lead_to_consultation'
      }
    },
    metadata: {
      source: 'kvi-pie-autoresponder',
      callKind,
      email: lead.email || ''
    }
  };

  const url = `${VAPI_API_BASE}/call`;
  const { data } = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  return { ok: true, callId: data.id || data.callId, data };
}

module.exports = {
  isVapiConfigured,
  vapiEnabled,
  createOutboundCall
};
