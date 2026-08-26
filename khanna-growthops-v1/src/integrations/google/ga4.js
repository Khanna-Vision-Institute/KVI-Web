const config = require('../../config');
const { getGoogleAccessToken } = require('./auth');

// GA4 Data API v1beta runReport — read-only.
// https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport

const DATE_RANGE = [{ startDate: '28daysAgo', endDate: 'yesterday' }];

async function runReport(propertyId, token, body) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data.error && data.error.message) || `HTTP ${res.status}`;
    throw new Error(`GA4 runReport failed: ${detail}`);
  }
  return data;
}

function metricValue(row, index = 0) {
  const v = row?.metricValues?.[index]?.value;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Site-wide GA4 totals for the last 28 days (matches GA4 property overview).
 */
async function fetchPropertyTotals(token, propertyId) {
  const data = await runReport(propertyId, token, {
    dateRanges: DATE_RANGE,
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'screenPageViews' },
    ],
  });
  const row = (data.rows || [])[0];
  return {
    totalSessions: metricValue(row, 0),
    totalUsers: metricValue(row, 1),
    pageViews: metricValue(row, 2),
  };
}

/**
 * Top landing pages by sessions (last 28 days).
 */
async function fetchTopLandingPages(token, propertyId, limit = 8) {
  const data = await runReport(propertyId, token, {
    dateRanges: DATE_RANGE,
    dimensions: [{ name: 'landingPagePlusQueryString' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ desc: true, metric: { metricName: 'sessions' } }],
    limit,
  });

  return (data.rows || []).map((row) => ({
    path: stripQuery(row.dimensionValues?.[0]?.value || '(not set)'),
    sessions: metricValue(row, 0),
    conversions: 0,
  }));
}

/**
 * Total consult-intent events (property-wide, matches GA4 Events report).
 */
async function fetchConsultEventTotal(token, propertyId, eventName) {
  const data = await runReport(propertyId, token, {
    dateRanges: DATE_RANGE,
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { matchType: 'EXACT', value: eventName },
      },
    },
  });
  return metricValue((data.rows || [])[0], 0);
}

/**
 * Fetch a GA4 snapshot: property totals + top landing pages + consult events.
 * All numbers are live from GA4 — no partial sums or estimates.
 */
async function fetchGa4Snapshot() {
  const propertyId = config.ga4.propertyId;
  if (!propertyId) throw new Error('GA4_PROPERTY_ID is not configured');

  const token = await getGoogleAccessToken();
  const eventName = config.ga4.consultEventName;

  const [totals, landingPages, consultIntentsTotal] = await Promise.all([
    fetchPropertyTotals(token, propertyId),
    fetchTopLandingPages(token, propertyId, 8),
    fetchConsultEventTotal(token, propertyId, eventName),
  ]);

  return {
    ...totals,
    landingPages,
    consultIntentsTotal,
  };
}

function stripQuery(p) {
  if (!p) return p;
  const i = p.indexOf('?');
  return i >= 0 ? p.slice(0, i) : p;
}

module.exports = { fetchGa4Snapshot };
