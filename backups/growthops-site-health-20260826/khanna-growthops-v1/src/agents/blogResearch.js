const config = require('../config');
const { collectGrowthSignals } = require('./analyticsAnalyst');
const { resolveCity } = require('./cities');

function briefingFromSignals(signals, { city, useSearchConsole, useAnalytics }) {
  const parts = [];
  const sc = signals.searchConsole || {};
  const ga = signals.ga4 || {};

  if (useSearchConsole && sc.topQueries && sc.topQueries.length) {
    parts.push(
      'SEARCH CONSOLE (top queries, last 28 days):\n' +
        sc.topQueries
          .slice(0, 8)
          .map((q) => `- "${q.query}" — ${q.clicks} clicks, ${q.impressions} impressions, pos ${q.position}`)
          .join('\n')
    );
  }
  if (useSearchConsole && sc.lowCtrPages && sc.lowCtrPages.length) {
    parts.push(
      'LOW CTR PAGES:\n' +
        sc.lowCtrPages
          .map((p) => `- ${p.page} — CTR ${((p.ctr || 0) * 100).toFixed(1)}%, ${p.impressions} impressions`)
          .join('\n')
    );
  }
  if (useAnalytics && ga.landingPages && ga.landingPages.length) {
    parts.push(
      'GA4 TOP LANDING PAGES:\n' +
        ga.landingPages
          .slice(0, 6)
          .map((p) => `- ${p.path} — ${p.sessions} sessions, ${p.conversions || 0} consult events`)
          .join('\n')
    );
  }
  if (city) parts.push(`LOCAL SEO FOCUS: ${city}`);
  return parts.join('\n\n') || 'Limited research data — write a general educational vision-correction post.';
}

async function gatherBlogResearch(options = {}) {
  const city = resolveCity(options.city);
  const useSearchConsole = options.useSearchConsole !== false;
  const useAnalytics = options.useAnalytics !== false;
  const signals = await collectGrowthSignals();
  const briefing = briefingFromSignals(signals, { city, useSearchConsole, useAnalytics });
  return {
    signals,
    briefing,
    city,
    used: {
      searchConsole: useSearchConsole && config.integrationsEnabled.searchConsole,
      analytics: useAnalytics && config.integrationsEnabled.ga4,
    },
  };
}

async function suggestTopics(options = {}) {
  const research = await gatherBlogResearch(options);
  const { briefing, city, signals } = research;

  if (config.integrationsEnabled.openai) {
    try {
      const { generateDraft } = require('../integrations/openai/client');
      const text = await generateDraft({
        maxTokens: 600,
        systemPrompt: `You are an SEO content strategist for Khanna Vision Institute (ophthalmology: SMILE, LASIK, EVO ICL, keratoconus).
Propose blog topics that match real search demand. Educational tone only. Respond as JSON array of 5 objects: [{"topic": string, "angle": string}].`,
        userPrompt: `${briefing}\n\nReturn 5 distinct blog topic ideas for Khanna Vision Institute${city ? ` with a local angle for ${city}` : ''}.`,
      });
      const parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, ''));
      if (Array.isArray(parsed) && parsed.length) {
        return { topics: parsed.slice(0, 5), used: research.used };
      }
    } catch (err) {
      console.warn('[growthops] topic suggest failed:', err.message);
    }
  }

  const fallback = (signals.searchConsole?.topQueries || [])
    .slice(0, 5)
    .map((q) => ({
      topic: `Patient guide: ${q.query}`,
      angle: `Answer search demand for "${q.query}" with an educational post.`,
    }));
  if (!fallback.length) {
    fallback.push({
      topic: 'SMILE vs LASIK vs EVO ICL: how to compare modern vision correction',
      angle: 'Neutral comparison for prospective patients.',
    });
  }
  return { topics: fallback, used: research.used };
}

module.exports = { gatherBlogResearch, suggestTopics, briefingFromSignals };
