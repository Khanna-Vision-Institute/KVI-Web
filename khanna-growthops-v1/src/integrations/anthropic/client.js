const config = require('../../config');

// Anthropic Messages API. Native fetch only — no SDK dependency.
// https://docs.anthropic.com/en/api/messages

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/**
 * Generate a text draft from a system + user prompt.
 * @param {{ systemPrompt: string, userPrompt: string, maxTokens?: number }} args
 * @returns {Promise<string>} the model's text output
 */
async function generateDraft({ systemPrompt, userPrompt, maxTokens = 1500 }) {
  const { apiKey, model } = config.anthropic;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data.error && data.error.message) || `HTTP ${res.status}`;
    throw new Error(`Anthropic request failed: ${detail}`);
  }

  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  if (!text) throw new Error('Anthropic returned an empty response');
  return text;
}

module.exports = { generateDraft };
