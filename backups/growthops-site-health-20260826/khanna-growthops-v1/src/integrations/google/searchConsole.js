const config = require('../../config');
const { getGoogleAccessToken } = require('./auth');

// Search Console Search Analytics API — read-only.
// https://developers.google.com/webmaster-tools/v1/searchanalytics/query

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function querySearchAnalytics(token, siteUrl, requestBody) {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data.error && data.error.message) || `HTTP ${res.status}`;
    throw new Error(`Search Console query failed: ${detail}`);
  }
  return Array.isArray(data.rows) ? data.rows : [];
}

/**
 * Fetch a Search Console snapshot for the last 28 days.
 * @returns {Promise<{ topQueries, lowCtrPages }>}
 */
async function fetchSearchConsoleSnapshot() {
  const siteUrl = config.google.gscSiteUrl;
  if (!siteUrl) throw new Error('GSC_SITE_URL is not configured');

  const token = await getGoogleAccessToken();
  const startDate = isoDaysAgo(28);
  const endDate = isoDaysAgo(1); // GSC data lags ~2-3 days; yesterday is the safest upper bound

  // Top queries by clicks
  const queryRows = await querySearchAnalytics(token, siteUrl, {
    startDate,
    endDate,
    dimensions: ['query'],
    rowLimit: 10,
    dataState: 'all',
  });

  const topQueries = queryRows.map((r) => ({
    query: (r.keys && r.keys[0]) || '',
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: Number((r.position || 0).toFixed(1)),
  }));

  // Site-wide organic totals (no dimensions) — matches Search Console performance summary.
  const totalRows = await querySearchAnalytics(token, siteUrl, {
    startDate,
    endDate,
    dataState: 'all',
  });
  const site = totalRows[0] || {};

  // Pages with impressions >= 500, sorted by lowest CTR, top 5
  const pageRows = await querySearchAnalytics(token, siteUrl, {
    startDate,
    endDate,
    dimensions: ['page'],
    rowLimit: 250,
    dataState: 'all',
  });

  const lowCtrPages = pageRows
    .filter((r) => (r.impressions || 0) >= 500)
    .sort((a, b) => (a.ctr || 0) - (b.ctr || 0))
    .slice(0, 5)
    .map((r) => ({
      page: pathFromUrl((r.keys && r.keys[0]) || ''),
      ctr: r.ctr || 0,
      impressions: r.impressions || 0,
    }));

  return {
    topQueries,
    lowCtrPages,
    totalClicks: site.clicks || 0,
    totalImpressions: site.impressions || 0,
    avgCtr: site.ctr || 0,
    avgPosition: Number((site.position || 0).toFixed(1)),
  };
}

// Reduce full URLs to path-only to keep the brief readable and avoid leaking nothing sensitive.
function pathFromUrl(u) {
  try {
    return new URL(u).pathname || u;
  } catch {
    return u;
  }
}

module.exports = { fetchSearchConsoleSnapshot };
