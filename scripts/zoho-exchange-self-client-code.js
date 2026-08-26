#!/usr/bin/env node
/**
 * Exchange a Zoho **Self Client → Generate Code** grant without redirect_uri.
 * Docs: https://www.zoho.com/accounts/protocol/oauth/self-client/authorization-code-flow.html
 *
 * Requires .env next to server.js with ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET for **that Self Client**.
 *
 * Usage (on server, inside app folder):
 *   node scripts/zoho-exchange-self-client-code.js "<grant_code>"
 * Optional — explicit accounts host (default env ZOHO_ACCOUNTS_URL or US):
 *   node scripts/zoho-exchange-self-client-code.js "<grant_code>" https://accounts.zoho.eu
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const zohoService = require('../services/zohoService');

async function main() {
  const code = process.argv[2];
  const accountsUrl = process.argv[3];

  if (!code) {
    console.error(
      'Usage: node scripts/zoho-exchange-self-client-code.js "<grant_code>" [accounts_base_url]'
    );
    console.error(
      'Create code in Zoho API Console → Self Client → Generate Code (CRM scopes), then paste here.'
    );
    process.exit(1);
  }

  try {
    const tokens = await zohoService.generateRefreshToken(code, {
      selfClient: true,
      accountsUrl: accountsUrl || undefined
    });

    console.log('');
    console.log('ZOHO_REFRESH_TOKEN=' + tokens.refresh_token);
    if (tokens.api_domain) {
      console.log('');
      console.log('Optional — set api domain if CRM is not US:');
      console.log('ZOHO_API_DOMAIN=' + tokens.api_domain);
    }
    console.log('');
  } catch (e) {
    console.error(e.message || e);
    if (e.zohoSnapshot) {
      console.error(JSON.stringify(e.zohoSnapshot, null, 2));
    }
    process.exit(1);
  }
}

main();
