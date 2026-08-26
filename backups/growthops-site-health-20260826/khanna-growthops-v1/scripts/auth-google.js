#!/usr/bin/env node
/**
 * One-time Google OAuth helper.
 *
 * Produces a long-lived GOOGLE_REFRESH_TOKEN for Search Console + GA4 (read-only).
 *
 * Prerequisites (see docs/integrations-setup.md):
 *   1. A Google Cloud OAuth 2.0 Client (type: Web application).
 *   2. Authorized redirect URI added to that client:  http://localhost:53682/oauth2callback
 *   3. GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set in .env
 *
 * Usage:  npm run auth:google
 */
const http = require('http');
const config = require('../src/config');

const REDIRECT_URI = 'http://localhost:53682/oauth2callback';
const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
];

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const { clientId, clientSecret } = config.google;
if (!clientId || !clientSecret) {
  fail('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.');
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token even if previously granted
    scope: SCOPES.join(' '),
  }).toString();

console.log('\n=== Google OAuth (Search Console + GA4, read-only) ===\n');
console.log('1. Make sure this redirect URI is registered on your OAuth client:');
console.log(`     ${REDIRECT_URI}\n`);
console.log('2. Open this URL in your browser and approve access:\n');
console.log(`   ${authUrl}\n`);
console.log('Waiting for the redirect on http://localhost:53682 ...\n');

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) {
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
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
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
        `Token exchange failed: ${data.error_description || data.error || 'no refresh_token returned'}\n` +
          'Tip: if no refresh_token came back, revoke prior access at https://myaccount.google.com/permissions and retry.'
      );
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>✓ Google authorized.</h2><p>You can close this tab and return to the terminal.</p>');

    console.log('✓ Success! Add this line to your .env:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}\n`);
    console.log('Then set MOCK_MODE=false and run:  npm run test:integrations\n');
    server.close(() => process.exit(0));
  } catch (e) {
    res.writeHead(500).end('Token exchange error — see terminal.');
    fail(`Token exchange error: ${e.message}`);
  }
});

server.listen(53682);
