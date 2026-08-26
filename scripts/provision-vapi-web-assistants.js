#!/usr/bin/env node
/**
 * Create or update Vapi web assistants for all 10 KVI chat personas.
 * Uses Vapi Voices only (provider: vapi) — no ElevenLabs API key required.
 *
 * Usage:
 *   cd "/path/to/kvi home"
 *   VAPI_API_KEY=... node scripts/provision-vapi-web-assistants.js
 *   VAPI_API_KEY=... node scripts/provision-vapi-web-assistants.js --apply
 */
const path = require('path');
const axios = require('axios');

process.chdir(path.join(__dirname, '..'));
require('dotenv').config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const { listProfilesForProvisioning, buildVoiceConfig, AGENT_PROFILES } = require('../services/vapiWebAgents');

const APPLY = process.argv.includes('--apply');
const VAPI_API_BASE = (process.env.VAPI_API_BASE || 'https://api.vapi.ai').replace(/\/$/, '');
const API_KEY = process.env.VAPI_API_KEY;
const GURU_TOOL_BASE = (
  process.env.GURU_SERVER_URL ||
  process.env.GURU_TOOL_URL ||
  'https://khannainstitute.com/api/guru'
).replace(/\/$/, '');

function buildBookingTool() {
  return {
    type: 'function',
    async: false,
    function: {
      name: 'bookAppointment',
      description:
        'Book a Khanna Vision Institute consultation after collecting fullName, age, email, phone, location (beverly or westlake), date, and time. Confirm all details with the caller first. For date use YYYY-MM-DD or MM/DD/YYYY (e.g. 2026-07-15 or 07/15/2026).',
      parameters: {
        type: 'object',
        properties: {
          fullName: { type: 'string', description: 'Patient full name' },
          age: { type: 'number', description: 'Patient age in years' },
          email: { type: 'string', description: 'Email address' },
          phone: { type: 'string', description: 'Phone number with area code' },
          location: {
            type: 'string',
            enum: ['beverly', 'westlake'],
            description: 'beverly = Beverly Hills, westlake = Westlake Village',
          },
          date: { type: 'string', description: 'Preferred appointment date' },
          time: { type: 'string', description: 'Preferred appointment time' },
        },
        required: ['fullName', 'age', 'email', 'phone', 'location', 'date', 'time'],
      },
    },
    server: {
      url: `${GURU_TOOL_BASE}/vapi/tool/bookAppointment`,
    },
  };
}

function buildAssistantPayload(profile) {
  return {
    name: `KVI Web — ${profile.name}`,
    firstMessage: profile.firstMessage,
    model: {
      provider: 'openai',
      model: process.env.VAPI_WEB_MODEL || 'gpt-4o-mini',
      temperature: 0.65,
      messages: [{ role: 'system', content: profile.system }],
    },
    tools: [buildBookingTool()],
    voice: profile.voice || buildVoiceConfig(AGENT_PROFILES[profile.key]),
    metadata: {
      source: 'kvi-web-chat',
      agentKey: profile.key,
    },
  };
}

async function createAssistant(payload) {
  const { data } = await axios.post(`${VAPI_API_BASE}/assistant`, payload, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  });
  return data;
}

async function updateAssistant(id, payload) {
  const { data } = await axios.patch(`${VAPI_API_BASE}/assistant/${id}`, payload, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  });
  return data;
}

async function main() {
  if (!API_KEY) {
    console.error('Set VAPI_API_KEY in .env or environment.');
    process.exit(1);
  }

  const profiles = listProfilesForProvisioning();
  const envLines = ['', '# Vapi web voice — one assistant per chat persona'];
  if (process.env.VAPI_PUBLIC_KEY) {
    envLines.push(`VAPI_PUBLIC_KEY=${process.env.VAPI_PUBLIC_KEY}`);
  } else {
    envLines.push('# VAPI_PUBLIC_KEY=<from Vapi dashboard — Web SDK public key>');
  }
  envLines.push('VAPI_WEB_VOICE_ENABLED=true');

  for (const profile of profiles) {
    const payload = buildAssistantPayload(profile);
    console.log(`\n=== ${profile.key} (${profile.name}) ===`);
    console.log('Voice:', JSON.stringify(profile.voice || buildVoiceConfig(AGENT_PROFILES[profile.key])));

    if (!APPLY) {
      console.log('Payload:', JSON.stringify(payload, null, 2));
      if (profile.assistantId) {
        envLines.push(`${profile.envVar}=${profile.assistantId}`);
        console.log('(existing id kept — run --apply to update in Vapi)');
      } else {
        envLines.push(`${profile.envVar}=<create with --apply>`);
      }
      continue;
    }

    try {
      let result;
      if (profile.assistantId) {
        result = await updateAssistant(profile.assistantId, payload);
        console.log('Updated:', result.id || profile.assistantId);
        envLines.push(`${profile.envVar}=${result.id || profile.assistantId}`);
      } else {
        result = await createAssistant(payload);
        console.log('Created:', result.id);
        envLines.push(`${profile.envVar}=${result.id}`);
      }
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.error('Failed:', detail);
      process.exitCode = 1;
    }
  }

  console.log('\n--- Add to .env on server ---');
  console.log(envLines.join('\n'));
  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to create/update assistants in Vapi.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
