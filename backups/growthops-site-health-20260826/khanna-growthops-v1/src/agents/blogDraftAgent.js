const { scanDraft } = require('./complianceAgent');
const config = require('../config');

const SYSTEM_PROMPT = `You are a medical content writer for Khanna Vision Institute, an ophthalmology practice.
Write a short, educational blog post for prospective patients about modern vision correction.

Hard rules (compliance — never violate):
- Educational and neutral tone only. No hype, no fear-based copy ("tired of glasses?"), no urgency pressure.
- NEVER guarantee outcomes (no "guaranteed 20/20", "no-risk", "cure blindness").
- NEVER claim to be the "best LASIK surgeon" or use superlative ranking claims about the practice or doctors.
- Be ophthalmologically accurate. SMILE, LASIK, and EVO ICL are distinct procedures with different candidacy criteria.
- State clearly that results vary by individual anatomy/prescription and that a consultation is required to determine candidacy.
- Refer to the practice as "Khanna Vision Institute". Do not invent statistics, prices, or testimonials.

Output format (exactly):
Line 1: TITLE: <a clear, non-clickbait title>
Then a blank line, then the post body in Markdown using ## section headings.
End with a short "Next step" section inviting the reader to schedule a consultation.`;

function buildUserPrompt(signals, options = {}) {
  const sc = (signals && signals.searchConsole) || {};
  const topQuery = (sc.topQueries && sc.topQueries[0] && sc.topQueries[0].query) || 'SMILE vs LASIK vs EVO ICL';
  const lowCtrPage = (sc.lowCtrPages && sc.lowCtrPages[0] && sc.lowCtrPages[0].page) || null;
  const landing =
    (signals && signals.ga4 && signals.ga4.landingPages && signals.ga4.landingPages[0] && signals.ga4.landingPages[0].path) || null;
  const city = options.city ? String(options.city).trim() : '';
  const topic = options.topic ? String(options.topic).trim() : '';
  const words = Number(options.wordCount) || 700;

  return `Write a patient-education blog post (~${words} words).

${topic ? `Topic (use this angle): ${topic}` : `Choose an angle based on search demand: "${topQuery}"`}
${city ? `Local SEO focus: ${city} — mention the region naturally, no superlative "best in" claims.` : ''}

Use this growth context (do not mention analytics or SEO in the post):
${lowCtrPage ? `- Page needing clearer patient messaging: ${lowCtrPage}` : ''}
${landing ? `- Popular landing page to reinforce: ${landing}` : ''}

Keep it accurate, educational, and reassuring without making promises.`;
}

function templateBlog() {
  const title = 'Latest Vision & Eye News: What Patients Should Know This Month';
  const body = `## Eye news in plain English

Researchers continue to study safer vision correction options for patients who are not candidates for standard LASIK. SMILE and EVO ICL remain important topics for informed consultations.

## Why it matters

Patients often compare procedures using outdated information. Clear, educational content helps them ask better questions before a consult.

## What patients should not assume

- No procedure is right for everyone
- Results vary based on anatomy, prescription, and eye health
- A consultation is required to understand candidacy

## Khanna Institute tip

If you are comparing SMILE, LASIK, and EVO ICL, focus on candidacy, recovery, and long-term eye health — not slogans.

## Next step

Schedule a consultation to understand which modern vision correction options may fit your goals.`;
  return { title, body };
}

function parseDraft(text) {
  const lines = text.split('\n');
  let title = '';
  let bodyStart = 0;
  const m = lines[0] && lines[0].match(/^\s*TITLE:\s*(.+)$/i);
  if (m) {
    title = m[1].trim();
    bodyStart = 1;
  }
  const body = lines.slice(bodyStart).join('\n').trim();
  if (!title) title = 'Latest Vision & Eye News: What Patients Should Know This Month';
  return { title, body: body || text.trim() };
}

/**
 * Draft an educational blog post.
 * Uses OpenAI when OPENAI_API_KEY is set; otherwise returns the template draft.
 * Always runs the compliance scan on the output.
 * @param {object} [signals] live/sample growth signals for context
 */
async function draftVisionNewsBlog(signals, options = {}) {
  let draft;
  let generatedBy = 'template';

  if (config.integrationsEnabled.openai) {
    try {
      const { generateDraft } = require('../integrations/openai/client');
      const words = Number(options.wordCount) || 700;
      const text = await generateDraft({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(signals, options),
        maxTokens: Math.min(4000, Math.max(800, Math.round(words * 2.2))),
      });
      draft = parseDraft(text);
      generatedBy = 'openai';
    } catch (err) {
      console.warn(`[growthops] blog: OpenAI generation failed (${err.message}) — using template draft`);
      draft = templateBlog();
    }
  } else {
    draft = templateBlog();
  }

  const compliance = scanDraft(`${draft.title}\n${draft.body}`);
  return {
    title: draft.title,
    body: draft.body,
    compliance,
    generatedBy,
    type: 'blog_draft',
    city: options.city || '',
    wordCount: Number(options.wordCount) || 700,
    topic: options.topic || '',
    research: options.research || null,
  };
}

module.exports = { draftVisionNewsBlog };
