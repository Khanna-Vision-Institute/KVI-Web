const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function envBool(name, fallback = false) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  return String(v).trim().toLowerCase() === 'true';
}

function envStr(name, fallback = '') {
  const v = process.env[name];
  if (v === undefined || v === null) return fallback;
  const t = String(v).trim();
  return t === '' ? fallback : t;
}

const google = {
  clientId: envStr('GOOGLE_CLIENT_ID'),
  clientSecret: envStr('GOOGLE_CLIENT_SECRET'),
  refreshToken: envStr('GOOGLE_REFRESH_TOKEN'),
  // Property in Search Console — must match exactly (including trailing slash / sc-domain: prefix)
  gscSiteUrl: envStr('GSC_SITE_URL', 'https://khannainstitute.com/'),
  // Set GSC_ENABLED=false to skip Search Console until you have property access
  gscEnabled: envBool('GSC_ENABLED', true),
};

const ga4 = {
  propertyId: envStr('GA4_PROPERTY_ID'), // numeric, e.g. 123456789 (no "properties/" prefix needed)
  consultEventName: envStr('GA4_CONSULT_EVENT', 'consult_intent'),
};

const zoho = {
  clientId: envStr('ZOHO_CLIENT_ID'),
  clientSecret: envStr('ZOHO_CLIENT_SECRET'),
  refreshToken: envStr('ZOHO_REFRESH_TOKEN'),
  dc: envStr('ZOHO_DC', 'com'), // com | in | eu | com.au
  leadModule: envStr('ZOHO_LEAD_MODULE', 'Leads'),
  dealModule: envStr('ZOHO_DEAL_MODULE', 'Deals'),
  dealStageBooked: envStr('ZOHO_DEAL_STAGE_BOOKED', 'Consultation Booked'),
  // Leads use Lead_Status (not Deals). Comma-separate multiple booked statuses.
  leadStatusBooked: envStr('ZOHO_LEAD_STATUS_BOOKED'),
  // Phase 6 write-back — OFF by default. Only flips on with explicit opt-in.
  writeEnabled: envBool('ZOHO_WRITE_ENABLED', false),
  tasksOwnerId: envStr('ZOHO_TASKS_OWNER_ID'), // optional CRM user id to own created tasks
};

const openai = {
  apiKey: envStr('OPENAI_API_KEY'),
  model: envStr('OPENAI_MODEL', 'gpt-4o-mini'),
};

const ads = {
  googleAdsCustomerId: envStr('GOOGLE_ADS_CUSTOMER_ID'),
  metaAccessToken: envStr('META_ACCESS_TOKEN'),
  metaAdAccountId: envStr('META_AD_ACCOUNT_ID'),
};

// Derived flags — an integration is "enabled" only when its required credentials exist.
const integrationsEnabled = {
  searchConsole: Boolean(
    google.gscEnabled && google.clientId && google.clientSecret && google.refreshToken
  ),
  ga4: Boolean(google.clientId && google.clientSecret && google.refreshToken && ga4.propertyId),
  zoho: Boolean(zoho.clientId && zoho.clientSecret && zoho.refreshToken),
  openai: Boolean(openai.apiKey),
  googleAds: Boolean(ads.googleAdsCustomerId),
  metaAds: Boolean(ads.metaAccessToken && ads.metaAdAccountId),
};

const config = {
  port: Number(process.env.PORT) || 8080,
  mockMode: envBool('MOCK_MODE', true),
  adminUser: (process.env.GROWTHOPS_ADMIN_USER || 'admin').trim(),
  adminPassword: (process.env.GROWTHOPS_ADMIN_PASSWORD || 'growthops').trim(),
  requireAuth: envBool('GROWTHOPS_REQUIRE_AUTH', true),
  trustProxy: envBool('GROWTHOPS_TRUST_PROXY', true),
  blogPublish: {
    enabled: envBool('BLOG_PUBLISH_ENABLED', false),
    endpoint: envStr(
      'BLOG_PUBLISH_ENDPOINT',
      'http://127.0.0.1:3000/api/internal/growthops/publish-blog'
    ),
    token: envStr('BLOG_PUBLISH_TOKEN'),
    timeoutMs: Number(process.env.BLOG_PUBLISH_TIMEOUT_MS || 12000),
  },
  blogDefaultWords: Number(process.env.BLOG_DEFAULT_WORDS || 700) || 700,
  dataDir: envStr('DATA_DIR') || path.join(__dirname, '..', 'data'),
  google,
  ga4,
  zoho,
  openai,
  ads,
  integrationsEnabled,
};

module.exports = config;
