#!/usr/bin/env node
/**
 * Pull static files from github.com/Surya21111999/kvi-physician-portal → public/physician-portal/
 * Rewrites `/kvi-physician-portal` → `/Doctorportal`.
 *
 * Run: node scripts/sync-physician-portal.js
 * or: npm run sync:physician-portal
 *
 * Optional env:
 * - PHYSICIAN_PORTAL_REF — git ref (default main)
 * - PORTAL_AUTH_BUNDLE — query string bump for Cognito snippets
 * - PORTAL_AUTH_INJECT=true — re-append portal-auth markup (off by default; login disabled)
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(ROOT, 'public', 'physician-portal');
const REF = (process.env.PHYSICIAN_PORTAL_REF || 'main').trim();
const PORTAL_AUTH_BUNDLE =
  (process.env.PORTAL_AUTH_BUNDLE || '20260701').trim() || '20260701';

/** Set PORTAL_AUTH_INJECT=true only if you wire Cognito + auth assets again */
const SHOULD_INJECT_AUTH = String(process.env.PORTAL_AUTH_INJECT || '').toLowerCase() === 'true';

const PORTAL_AUTH_SNIPPET = SHOULD_INJECT_AUTH
  ? `<!-- kvi-portal-auth -->
<link rel="stylesheet" href="/Doctorportal/auth/portal-auth.css?v=${PORTAL_AUTH_BUNDLE}">
<script defer src="/Doctorportal/auth/config.js?v=${PORTAL_AUTH_BUNDLE}"></script>
<script defer src="/Doctorportal/auth/portal-auth.js?v=${PORTAL_AUTH_BUNDLE}"></script>
`
  : '';

const FILES = [
  'for-physicians.html',
  'refer-a-patient.html',
  'book-consultation.html',
  'physician-hub.css',
  'physician-portal-brochure.css'
];

const RAW_BASE = `https://raw.githubusercontent.com/Surya21111999/kvi-physician-portal/${REF}`;

function rewrite(body) {
  return String(body)
    .replaceAll('/kvi-physician-portal/', '/Doctorportal/')
    .replaceAll('/kvi-physician-portal"', '/Doctorportal"')
    .replaceAll("'/kvi-physician-portal/", "'/Doctorportal/")
    .replaceAll('/kvi-physician-portal', '/Doctorportal');
}

/** Re-inject Cognito/helper assets after upstream HTML refresh (snippet lives before </body>). */
function injectPortalAuthMarkup(html, filename) {
  if (!filename.endsWith('.html')) return html;
  const text = String(html);
  if (!SHOULD_INJECT_AUTH || !PORTAL_AUTH_SNIPPET.trim()) return text;
  if (text.includes('<!-- kvi-portal-auth -->')) return text;

  const close = '</body>';
  const idx = text.lastIndexOf(close);
  if (idx === -1) {
    console.warn('[sync-physician-portal] WARN: missing </body> in', filename, '(auth snippet skipped)');
    return text;
  }
  return text.slice(0, idx).trimEnd() + '\n' + PORTAL_AUTH_SNIPPET + '\n' + text.slice(idx);
}

async function main() {
  fs.mkdirSync(DEST, { recursive: true });
  console.log('[sync-physician-portal] destination:', DEST);
  console.log('[sync-physician-portal] ref:', REF);

  for (const name of FILES) {
    const url = `${RAW_BASE}/${name}`;
    const res = await axios.get(url, { responseType: 'text', validateStatus: () => true });
    if (res.status >= 400) {
      throw new Error(`Fetch failed (${res.status}): ${url}`);
    }
    const out = injectPortalAuthMarkup(rewrite(res.data || ''), name);
    fs.writeFileSync(path.join(DEST, name), out, 'utf8');
    console.log('  ✓', name, `(${out.length} chars)`);
  }

  console.log(
    SHOULD_INJECT_AUTH
      ? '[sync-physician-portal] Cognito snippets will be appended (PORTAL_AUTH_INJECT=true)'
      : '[sync-physician-portal] Cognito snippets omitted (default). Export PORTAL_AUTH_INJECT=true to re-enable gated login.'
  );
  console.log('[sync-physician-portal] done. Restart the app (e.g. pm2 restart).');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
