const config = require('../../config');

// OpenAI Chat Completions API. Native fetch only — no SDK dependency.
// https://platform.openai.com/docs/api-reference/chat/create

const API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Generate a text draft from a system + user prompt.
 * @param {{ systemPrompt: string, userPrompt: string, maxTokens?: number }} args
 * @returns {Promise<string>} the model's text output
 */
async function generateDraft({ systemPrompt, userPrompt, maxTokens = 1500 }) {
  const { apiKey, model } = config.openai;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data.error && data.error.message) || `HTTP ${res.status}`;
    throw new Error(`OpenAI request failed: ${detail}`);
  }

  const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '')
    .trim();

  if (!text) throw new Error('OpenAI returned an empty response');
  return text;
}

module.exports = { generateDraft };
