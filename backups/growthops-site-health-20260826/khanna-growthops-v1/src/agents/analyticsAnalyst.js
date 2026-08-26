const { mockAnalyticsSnapshot } = require('./mockData');
const config = require('../config');

async function collectGrowthSignals() {
  if (config.mockMode) return mockAnalyticsSnapshot();
  // Live mode — fetch real signals with per-source sample fallbacks.
  // Required lazily so sample/demo mode never loads integration code.
  const { fetchLiveSignals } = require('../integrations');
  return fetchLiveSignals();
}

function pct(n) {
  return `${((n || 0) * 100).toFixed(1)}%`;
}

function buildBriefMarkdown(signals) {
  const sc = signals.searchConsole || {};
  const topQueries = sc.topQueries || [];
  const lowCtrPages = sc.lowCtrPages || [];
  const landingPages = (signals.ga4 && signals.ga4.landingPages) || [];
  const ads = signals.ads || {};

  const q = topQueries[0];
  const lowCtr = lowCtrPages[0];
  const ga = landingPages[0];

  const organic = q
    ? `- **Rising query:** "${q.query}" — ${q.clicks} clicks, position ${q.position} (CTR ${pct(q.ctr)})
- **Low CTR opportunity:** ${lowCtr ? `${lowCtr.page} — ${pct(lowCtr.ctr)} CTR on ${(lowCtr.impressions || 0).toLocaleString()} impressions` : 'No high-impression low-CTR pages found'}
- **Recommendation:** Draft comparison content (SMILE vs LASIK vs EVO ICL) and improve title/meta on high-impression pages`
    : '- No Search Console data available for this period.';

  const sitePerf = ga
    ? `- Top landing page: **${ga.path}** — ${(ga.sessions || 0).toLocaleString()} sessions, ${ga.conversions || 0} consult intents
- **Recommendation:** Add internal links from blog to ${ga.path}; test hero CTA variant`
    : '- No GA4 landing-page data available for this period.';

  const paid = renderPaidMedia(ads);

  const zoho = signals.zoho || {};
  const zohoSection = `- ${zoho.newLeads7d ?? 0} consult leads (Zoho Leads created · 7d)
- Top sources: ${(zoho.topSources && zoho.topSources.length ? zoho.topSources.join(', ') : '—')}`;

  return `# Daily Growth Brief
*Generated ${new Date(signals.generatedAt).toLocaleString()}*

## Organic search
${organic}

## Site performance (GA4)
${sitePerf}

## Paid media
${paid}

## Zoho CRM (7 days)
${zohoSection}

## Action queue (requires human approval)
1. Draft SMILE vs LASIK vs EVO ICL blog
2. SEO title/meta refresh for top low-CTR page
3. Google Ads — pause low-intent broad match review
4. Newsletter draft from monthly vision news scout
`;
}

function renderPaidMedia(ads) {
  const g = ads.google;
  const m = ads.meta;
  if (!g && !m) {
    return '- **Not connected** — ad platforms are not wired yet (read-only stubs).';
  }
  const lines = [];
  if (g) {
    lines.push(
      `- **Google Ads:** $${(g.spend || 0).toLocaleString()} spend → ${g.leads || 0} leads (CPL $${(g.cpl || 0).toFixed(0)})`
    );
  } else {
    lines.push('- **Google Ads:** Not connected');
  }
  if (m) {
    lines.push(
      `- **Meta:** $${(m.spend || 0).toLocaleString()} spend → ${m.leads || 0} leads, ${m.booked || 0} booked`
    );
  } else {
    lines.push('- **Meta:** Not connected');
  }
  lines.push('- **Recommendation:** Review broad LASIK terms; test qualifying copy on Meta');
  return lines.join('\n');
}

module.exports = { collectGrowthSignals, buildBriefMarkdown };
