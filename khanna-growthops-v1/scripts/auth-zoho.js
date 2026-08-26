#!/usr/bin/env node
/**
 * One-time Zoho CRM OAuth helper.
 *
 * Produces a long-lived ZOHO_REFRESH_TOKEN for CRM read (phase 1).
 *
 * Prerequisites (see docs/integrations-setup.md):
 *   1. A Zoho API console "Server-based Applications" client.
 *   2. Authorized redirect URI added to that client:  http://localhost:53682/zoho/callback
 *   3. ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_DC set in .env
 *
 * Scopes requested (read-only, plus tasks.CREATE for the optional phase-6 write-back):
 *   ZohoCRM.modules.READ, ZohoCRM.settings.READ, ZohoCRM.coql.READ, ZohoCRM.modules.Tasks.CREATE
 *
 * Usage:  npm run auth:zoho
 */
const http = require('http');
const config = require('../src/config');

const REDIRECT_URI = 'http://localhost:53682/zoho/callback';
const SCOPES = [
  'ZohoCRM.modules.READ',
  'ZohoCRM.settings.READ',
  'ZohoCRM.coql.READ',
  // Needed only if you later enable ZOHO_WRITE_ENABLED=true (phase 6). Harmless to grant now.
  'ZohoCRM.modules.Tasks.CREATE',
];

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const { clientId, clientSecret, dc } = config.zoho;
if (!clientId || !clientSecret) {
  fail('Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in .env first.');
}

const accountsHost = `https://accounts.zoho.${dc}`;
const authUrl =
  `${accountsHost}/oauth/v2/auth?` +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(','),
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

console.log(`\n=== Zoho CRM OAuth (data center: ${dc}) ===\n`);
console.log('1. Make sure this redirect URI is registered on your Zoho client:');
console.log(`     ${REDIRECT_URI}\n`);
console.log('2. Open this URL in your browser and approve access:\n');
console.log(`   ${authUrl}\n`);
console.log('Scopes requested:', SCOPES.join(', '), '\n');
console.log('Waiting for the redirect on http://localhost:53682 ...\n');

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/zoho/callback')) {
    res.writeHead(404).end('Not found');
    return;
  }
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');

  if (err) {
    res.writeHead(400).end(`OAuth error: ${err}`);
    fail(`OAuth error: ${err}`);
    return;
  }
  if (!code) {
    res.writeHead(400).end('Missing authorization code');
    return;
  }

  try {
    const tokenRes = await fetch(`${accountsHost}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok || !data.refresh_token) {
      res.writeHead(500).end('Token exchange failed — see terminal.');
      fail(
        `Token exchange failed: ${data.error || 'no refresh_token returned'}\n` +
          'Tip: the authorization code expires in ~2 minutes and is single-use. Restart and retry quickly.'
      );
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>✓ Zoho authorized.</h2><p>You can close this tab and return to the terminal.</p>');

    console.log('✓ Success! Add this line to your .env:\n');
    console.log(`ZOHO_REFRESH_TOKEN=${data.refresh_token}\n`);
    console.log(`(Confirm ZOHO_DC=${dc} matches your account region.)\n`);
    server.close(() => process.exit(0));
  } catch (e) {
    res.writeHead(500).end('Token exchange error — see terminal.');
    fail(`Token exchange error: ${e.message}`);
  }
});

server.listen(53682);
