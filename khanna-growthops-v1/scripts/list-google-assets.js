#!/usr/bin/env node
/**
 * List Search Console sites + GA4 properties for the authorized Google account.
 * Run after GOOGLE_REFRESH_TOKEN is in .env.
 *
 * Usage: npm run list:google
 */
const config = require('../src/config');
const { getGoogleAccessToken } = require('../src/integrations/google/auth');

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

async function listSearchConsoleSites(token) {
  const res = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data.error && data.error.message) || `HTTP ${res.status}`;
    throw new Error(`Search Console sites list failed: ${detail}`);
  }
  return (data.siteEntry || []).map((s) => ({
    url: s.siteUrl,
    permission: s.permissionLevel,
  }));
}

async function listGa4Properties(token) {
  const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data.error && data.error.message) || `HTTP ${res.status}`;
    throw new Error(`GA4 account list failed: ${detail}`);
  }

  const props = [];
  for (const account of data.accountSummaries || []) {
    for (const p of account.propertySummaries || []) {
      const id = String(p.property || '').replace('properties/', '');
      props.push({
        propertyId: id,
        displayName: p.displayName,
        account: account.displayName,
      });
    }
  }
  return props;
}

async function main() {
  const { clientId, clientSecret, refreshToken } = config.google;
  if (!clientId || !clientSecret) {
    fail('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.');
  }
  if (!refreshToken) {
    fail('Set GOOGLE_REFRESH_TOKEN in .env first (run: npm run auth:google).');
  }

  console.log('\n=== Google assets for your account ===\n');
  const token = await getGoogleAccessToken();

  console.log('Search Console sites (copy one into GSC_SITE_URL):\n');
  try {
    const sites = await listSearchConsoleSites(token);
    if (!sites.length) {
      console.log('  (none — add khannainstitute.com in Search Console first)\n');
    } else {
      for (const s of sites) {
        console.log(`  ${s.url}  [${s.permission}]`);
      }
      console.log('');
    }
  } catch (err) {
    console.log(`  Error: ${err.message}\n`);
  }

  console.log('GA4 properties (copy propertyId into GA4_PROPERTY_ID):\n');
  try {
    const props = await listGa4Properties(token);
    if (!props.length) {
      console.log('  (none — check GA4 access for this Google account)\n');
    } else {
      for (const p of props) {
        console.log(`  ${p.propertyId}  —  ${p.displayName} (${p.account})`);
      }
      console.log('');
    }
  } catch (err) {
    console.log(`  Error: ${err.message}`);
    console.log('  Tip: enable "Google Analytics Admin API" in Google Cloud → APIs & Services → Library\n');
  }

  console.log('Suggested .env lines:\n');
  console.log('GSC_SITE_URL=https://khannainstitute.com/');
  console.log('GA4_PROPERTY_ID=<property id from above>');
  console.log('GA4_CONSULT_EVENT=consult_intent\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
