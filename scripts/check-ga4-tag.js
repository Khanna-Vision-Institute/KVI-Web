#!/usr/bin/env node
/**
 * Check that GA4 G-Q0TGBPVS92 loads on every page template.
 *
 * Scans every .html and .ejs file in the repo (skips node_modules, .git, backups).
 *   - PAGE     = a full HTML document (<html ...>) or a template that includes partials/header.
 *   - FRAGMENT = anything else (partials, Strapi paste files): not a page, not checked.
 * A page passes when it loads the tag itself (gtag.js?id=G-Q0TGBPVS92 + gtag('config','G-Q0TGBPVS92'))
 * or includes partials/header (which must itself contain the tag - also checked).
 * EXCLUDED lists non-public files on purpose, each with a reason; they are printed, never hidden.
 *
 * Usage: node scripts/check-ga4-tag.js [--json]    (exit 1 if any page is missing the tag)
 */
const fs = require('fs');
const path = require('path');

const GA4_ID = 'G-Q0TGBPVS92';
const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'backups', 'server-reports', '.aws-sam']);

const EXCLUDED = {
  'cron-dashboard.html': 'internal cron dashboard (route serves coming-soon.html)',
  'kvi-master-report.html': 'internal report',
  'kvi-monitoring-dashboard.html': 'internal monitoring dashboard',
  'kvi-monitoring-dashboard-secure.html': 'internal monitoring dashboard',
  'kvi-monitoring-login.html': 'internal monitoring login',
  'khanna-growthops-v1/src/public/index.html': 'internal GrowthOps app',
  'docs/zoho-bookings-confirmation-email.html': 'email template, not a web page',
  'test-mobile-menu.html': 'developer test page',
  'test-strapi-page.html': 'developer test page',
  'physicians/index.html': 'physician portal copy (meta-refresh only) - GA pending owner/privacy decision',
  'physicians/book-consultation.html': 'physician referral portal - GA pending owner/privacy decision',
  'physicians/for-physicians.html': 'physician referral portal - GA pending owner/privacy decision',
  'physicians/refer-a-patient.html': 'physician referral portal (patient referral form) - GA pending owner/privacy decision',
  'public/physician-portal/auth/sign-in.html': 'physician portal sign-in - GA pending owner/privacy decision',
  'public/physician-portal/book-consultation.html': 'physician referral portal - GA pending owner/privacy decision',
  'public/physician-portal/for-physicians.html': 'physician referral portal - GA pending owner/privacy decision',
  'public/physician-portal/refer-a-patient.html': 'physician referral portal (patient referral form) - GA pending owner/privacy decision',
  'public/physician-portal/referral-directory.html': 'physician referral portal - GA pending owner/privacy decision',
};

const HEADER_INCLUDE_RE = /include\(\s*['"]\/?partials\/header(\.ejs)?['"]/;
const TAG_SRC_RE = new RegExp(`googletagmanager\\.com/gtag/js\\?id=${GA4_ID}`);
const TAG_CONFIG_RE = new RegExp(`gtag\\(\\s*['"]config['"]\\s*,\\s*['"]${GA4_ID}['"]`);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); continue; }
    if (/\.(html|ejs)$/i.test(e.name) && !/\.backup/i.test(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}

function hasOwnTag(src) { return TAG_SRC_RE.test(src) && TAG_CONFIG_RE.test(src); }

function scan(root = ROOT) {
  const headerSrc = fs.readFileSync(path.join(root, 'partials/header.ejs'), 'utf8');
  const headerOk = hasOwnTag(headerSrc);
  const result = { headerOk, pages: 0, ok: [], missing: [], excluded: [], duplicate: [] };
  for (const abs of walk(root).sort()) {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    const src = fs.readFileSync(abs, 'utf8');
    const viaHeader = HEADER_INCLUDE_RE.test(src);
    const isPage = /<html[\s>]/i.test(src) || viaHeader;
    if (!isPage) continue;
    if (EXCLUDED[rel]) { result.excluded.push({ file: rel, reason: EXCLUDED[rel] }); continue; }
    result.pages += 1;
    const own = hasOwnTag(src);
    if (own || (viaHeader && headerOk)) result.ok.push({ file: rel, via: own ? 'own snippet' : 'partials/header' });
    else result.missing.push(rel);
    if (own && viaHeader) result.duplicate.push(rel);
  }
  return result;
}

module.exports = { scan, EXCLUDED, GA4_ID };

if (require.main === module) {
  const r = scan();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); }
  else {
    console.log(`GA4 ${GA4_ID} check: ${r.pages} page templates, ${r.ok.length} OK, ${r.missing.length} missing, ${r.excluded.length} excluded.`);
    if (!r.headerOk) console.log('FAIL: partials/header.ejs does not load the tag.');
    if (r.missing.length) { console.log('\nPages WITHOUT the tag:'); r.missing.forEach((f) => console.log(`  - ${f}`)); }
    if (r.duplicate.length) { console.log('\nWarning - tag loaded twice (own snippet + header partial, double page_view):'); r.duplicate.forEach((f) => console.log(`  - ${f}`)); }
    console.log('\nExcluded on purpose:'); r.excluded.forEach((e) => console.log(`  - ${e.file}: ${e.reason}`));
  }
  process.exit(r.missing.length || !r.headerOk ? 1 : 0);
}
