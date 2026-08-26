const config = require('../../config');
const { getZohoAccessToken, apiHost } = require('./auth');

// Zoho CRM v6 read endpoints. READ-ONLY in phase 1.
// We only read aggregate counts and Lead_Source labels — no names, emails, or phone numbers.
//
// Why COQL (not the plain Records API): this org's Records API omits the system audit fields
// (Created_Time / Modified_Time) from list and detail responses, even when explicitly named in
// `fields=`. A Created_Time-based "last N days" filter over that API therefore sees every row as
// epoch 0 and silently returns nothing. COQL returns Created_Time reliably for the same records,
// and we already hold the ZohoCRM.coql.READ scope.

function sinceIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  // COQL datetime literals must be single-quoted ISO-8601 with an explicit offset.
  return d.toISOString().replace('.000Z', '+00:00');
}

// COQL string/datetime literals are single-quoted; escape embedded quotes.
function coqlLiteral(value) {
  return `'${String(value).replace(/'/g, "\\'")}'`;
}

async function coqlQuery(token, dc, selectQuery) {
  const res = await fetch(`${apiHost(dc)}/crm/v6/coql`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ select_query: selectQuery }),
  });
  if (res.status === 204) return { data: [], info: {} };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data && (data.message || data.code)) || `HTTP ${res.status}`;
    throw new Error(`Zoho COQL request failed: ${detail}`);
  }
  return data;
}

/**
 * List records created in the last N days via COQL, newest-first.
 * `fields` is an array of API names; `extraWhere` is an optional COQL predicate
 * (already escaped) AND-ed onto the Created_Time window.
 */
async function listRecentRecords(token, dc, moduleName, fields, days, extraWhere) {
  const cols = fields.join(', ');
  let where = `Created_Time >= ${coqlLiteral(sinceIso(days))}`;
  if (extraWhere) where += ` and ${extraWhere}`;

  const rows = [];
  const perPage = 200; // COQL max page size

  // Guard the loop; a 7-day window never approaches COQL's offset ceiling.
  for (let offset = 0; offset < 2000; offset += perPage) {
    const limitClause = offset === 0 ? `limit ${perPage}` : `limit ${offset}, ${perPage}`;
    const query =
      `select ${cols} from ${moduleName} ` +
      `where ${where} order by Created_Time desc ${limitClause}`;

    const data = await coqlQuery(token, dc, query);
    const page = Array.isArray(data.data) ? data.data : [];
    rows.push(...page);

    if (!data.info || !data.info.more_records) break;
  }

  return rows;
}

function topLeadSources(leads, limit = 5) {
  const counts = new Map();
  for (const row of leads) {
    const src = (row.Lead_Source || '').trim();
    if (src) counts.set(src, (counts.get(src) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([src, count]) => ({ source: src, count }));
}

function leadsByStatus(leads, limit = 8) {
  const counts = new Map();
  for (const row of leads) {
    const st = String(row.Lead_Status || 'Unknown').trim() || 'Unknown';
    counts.set(st, (counts.get(st) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([status, count]) => ({ status, count }));
}

/**
 * Fetch a Zoho CRM snapshot for the last 7 days.
 * `newLeads7d` = all Leads created in the window (each lead is a consult booking in this CRM).
 * @returns {Promise<{ newLeads7d, topSources, leadsByStatus, leadSources }>}
 */
async function fetchZohoSnapshot() {
  const { dc, leadModule } = config.zoho;
  const token = await getZohoAccessToken();

  const recentLeads = await listRecentRecords(
    token,
    dc,
    leadModule,
    ['id', 'Created_Time', 'Lead_Source', 'Lead_Status'],
    7
  );

  const newLeads7d = recentLeads.length;
  const topSources = topLeadSources(recentLeads).map((r) => r.source);
  const statusBreakdown = leadsByStatus(recentLeads);

  return { newLeads7d, topSources, leadsByStatus: statusBreakdown, leadSources: topLeadSources(recentLeads) };
}

module.exports = { fetchZohoSnapshot };
