const { scanDraft } = require('./complianceAgent');
const { collectGrowthSignals, buildBriefMarkdown } = require('./analyticsAnalyst');
const config = require('../config');

const SYSTEM = `You are a senior SEO strategist for Khanna Vision Institute (ophthalmology practice in Los Angeles).
Use ONLY the real Search Console and GA4 numbers provided. Never invent metrics.
Write a practical Markdown report with ## headings:
## Summary
## Traffic & site performance
## Content opportunities
## On-page fixes (title/meta for low-CTR pages)
## Next actions (prioritized checklist)
Educational, specific, actionable. No hype.`;

async function generateSeoReport() {
  const signals = await collectGrowthSignals();
  let title = `SEO & growth report — ${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;
  let body;
  let generatedBy = 'template';

  const dataBrief = buildBriefMarkdown(signals);

  if (config.integrationsEnabled.openai) {
    try {
      const { generateDraft } = require('../integrations/openai/client');
      body = await generateDraft({
        maxTokens: 2000,
        systemPrompt: SYSTEM,
        userPrompt: `Real data snapshot:\n\n${dataBrief}\n\nWrite the full SEO report in Markdown.`,
      });
      generatedBy = 'openai';
    } catch (err) {
      console.warn('[growthops] SEO report OpenAI failed:', err.message);
      body = dataBrief;
    }
  } else {
    body = dataBrief;
  }

  const compliance = scanDraft(`${title}\n${body}`);
  return {
    title,
    body,
    markdown: body,
    lede: body.split('\n').find((l) => l.trim() && !l.startsWith('#')) || 'SEO report from live Search Console and GA4 data.',
    compliance,
    generatedBy,
    research: {
      searchConsole: config.integrationsEnabled.searchConsole,
      analytics: config.integrationsEnabled.ga4,
    },
    signals,
  };
}

module.exports = { generateSeoReport };
