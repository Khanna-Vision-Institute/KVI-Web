/**
 * Tagging + call-tracking guard tests (review branch).  Run: node --test test/tracking.test.js
 * No network, no server needed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ejs = require('ejs');

const ROOT = path.resolve(__dirname, '..');
delete process.env.ADS_TAGS_ENABLED; // test the committed default
const ct = require('../config/call-tracking');
const tracking = require('../config/tracking');
const phone = require('../config/phone');
const { scan } = require('../scripts/check-ga4-tag');
const { planCallConversion } = require('../services/callConversion');

const OFFICE_MAINS = ['+13104821240', '+18052302126'];
const HIDDEN = '+18188571735';
const SETTLED_POOL = ['+13106770760', '+13232049995', '+13237593722', '+18182931955', '+18184659340',
  '+18185799866', '+18186471190', '+18057023111', '+18182305325', '+18182397069'];

// ---------------------------------------------------------------- number pool
test('website swap pool has exactly 10 slots, unique, E.164', () => {
  assert.equal(ct.WEBSITE_SWAP_POOL.length, 10);
  assert.equal(ct.WEBSITE_SWAP_POOL_SIZE, 10);
  assert.equal(new Set(ct.WEBSITE_SWAP_POOL).size, 10);
  ct.WEBSITE_SWAP_POOL.forEach((n) => assert.match(n, /^\+1[2-9]\d{9}$/));
  assert.deepEqual([...ct.WEBSITE_SWAP_POOL].sort(), [...SETTLED_POOL].sort());
  assert.ok(Object.isFrozen(ct.WEBSITE_SWAP_POOL));
});

test('office mains and (818) 857-1735 are never in the pool', () => {
  for (const n of [...OFFICE_MAINS, HIDDEN]) assert.ok(!ct.WEBSITE_SWAP_POOL.includes(n), `${n} must not be a pool number`);
  assert.deepEqual([...ct.SWAP_TARGETS].sort(), [...OFFICE_MAINS].sort());
  assert.ok(ct.NEVER_SWAP.includes(HIDDEN));
  assert.ok(!ct.SWAP_TARGETS.includes(HIDDEN));
});

test('swap stays OFF (in-house and CallRail)', () => {
  assert.equal(ct.KVI_CALLTRACKER_ENABLED, false);
  assert.equal(phone.CALLRAIL_SWAP_ENABLED, false);
  assert.equal(tracking.clientConfig(ct).swap.enabled, false);
});

// Files allowed to contain pool numbers (config, this test, the retired script, docs). Never a served template.
const POOL_NUMBER_ALLOWLIST = new Set([
  'config/call-tracking.js',
  'test/tracking.test.js',
  'scripts/deploy-callrail-phone-replace.sh',
  'docs/TRACKING-CHANGE-NOTE-2026-09-28.md',
  'REVIEW-NOTES.md', // reviewer notes (not served)
]);
const SKIP_DIRS = new Set(['node_modules', '.git', 'backups', 'server-reports', '.aws-sam']);
const TEXT_EXT = /\.(html?|ejs|js|mjs|cjs|json|xml|txt|md|css|csv|sh|ya?ml|env|template)$/i;
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(abs, out); } else if (TEXT_EXT.test(e.name)) out.push(abs);
  }
  return out;
}
function numberPattern(e164) {
  const d = e164.slice(2); const a = d.slice(0, 3), b = d.slice(3, 6), c = d.slice(6);
  return new RegExp(`(?<!\\d)(?:\\+?1[\\s.\\-]?)?\\(?${a}\\)?[\\s.\\-]*${b}[\\s.\\-]*${c}(?!\\d)`);
}

test('no pool number is displayed as a static number anywhere (incl. (310) 677-0760)', () => {
  const patterns = ct.WEBSITE_SWAP_POOL.map((n) => [n, numberPattern(n)]);
  const hits = [];
  for (const abs of walk(ROOT)) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    if (POOL_NUMBER_ALLOWLIST.has(rel)) continue;
    const st = fs.statSync(abs); if (st.size > 5 * 1024 * 1024) continue;
    const src = fs.readFileSync(abs, 'utf8');
    for (const [n, re] of patterns) if (re.test(src)) hits.push(`${rel}: ${n}`);
  }
  assert.deepEqual(hits, [], `pool numbers found outside config:\n${hits.join('\n')}`);
});

test('the swap script only ever swaps in a configured pool number', () => {
  const src = fs.readFileSync(path.join(ROOT, 'public/js/kvi-swap.js'), 'utf8');
  assert.match(src, /function validPool/);
  assert.match(src, /if \(NEVER\[d\] \|\| !TARGETS\[d\]\) continue;/);
  assert.match(src, /sessionStorage\.getItem\(TRACKED_KEY\) !== '1'\) return;/); // organic visitors keep the mains
});

// ---------------------------------------------------------------- tracking-tags partial
function renderTags(callTracking) {
  const tpl = fs.readFileSync(path.join(ROOT, 'partials/tracking-tags.ejs'), 'utf8');
  return ejs.render(tpl, { siteTracking: tracking, siteCallTracking: callTracking, sitePhone: phone });
}
test('tracking-tags partial: no swap script while OFF; config carries only allowed labels', () => {
  const html = renderTags(ct);
  assert.ok(!html.includes('kvi-swap.js'));
  assert.ok(html.includes('/public/js/kvi-tracking.js'));
  const json = JSON.parse(html.match(/window\.KVI_TRACKING = (.*?);<\/script>/)[1]);
  assert.equal(json.adsMode, 'legacy');
  assert.deepEqual(Object.keys(json.ads.staged), []);
  assert.ok(!html.includes('+13106770760'));
  const on = renderTags({ ...ct, KVI_CALLTRACKER_ENABLED: true });
  assert.ok(on.includes('kvi-swap.js'));
});

// ---------------------------------------------------------------- ADS_TAGS_ENABLED
test('ADS_TAGS_ENABLED defaults to legacy: VIP/SMILE keep firing, new conversions off', () => {
  assert.equal(tracking.ADS_TAGS_ENABLED_DEFAULT, 'legacy');
  assert.equal(tracking.ADS_TAGS_ENABLED, 'legacy');
  const c = tracking.clientConfig(ct);
  assert.deepEqual(c.ads.legacy, { vip: 'AW-16512183014/qFoZCJal6qscEObVz8E9', smile: 'AW-16512183014/d1J1CK2xzqscEObVz8E9' });
  assert.deepEqual(c.ads.staged, {});
  for (const k of ['phone_click', 'sms_click', 'generate_lead', 'phone_call']) assert.equal(tracking.ADS_STAGED_CONVERSIONS[k], '', `${k} label must stay empty until the action exists`);
  assert.equal(tracking.ADS_CUSTOMER_ID, '811-555-5501');
});
test('ADS_TAGS_ENABLED values', () => {
  assert.equal(tracking.resolveAdsMode('all'), 'all');
  assert.equal(tracking.resolveAdsMode('true'), 'all');
  assert.equal(tracking.resolveAdsMode('off'), 'off');
  assert.equal(tracking.resolveAdsMode('false'), 'off');
  assert.equal(tracking.resolveAdsMode(''), 'legacy');
  assert.equal(tracking.resolveAdsMode('garbage'), 'legacy');
  assert.deepEqual(tracking.clientConfig(ct, 'off').ads, { legacy: {}, staged: {} });
  assert.deepEqual(tracking.clientConfig(ct, 'all').ads.staged, {}); // empty labels never send
});

// ---------------------------------------------------------------- browser scripts in a sandbox
function sandbox(kviTracking) {
  const calls = []; const store = new Map(); let clickHandler = null;
  const window = {
    gtag: (...a) => calls.push(a),
    sessionStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    crypto: { randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' },
  };
  if (kviTracking) window.KVI_TRACKING = kviTracking;
  const document = { addEventListener: (t, fn) => { if (t === 'click') clickHandler = fn; } };
  const ctx = vm.createContext({ window, document, Date, JSON, Number, Object, String, Math });
  return { ctx, window, calls, click: (href) => clickHandler({ target: { closest: (sel) => (sel === 'a[href]' ? { getAttribute: (n) => (n === 'href' ? href : null), closest: () => null } : null) } }) };
}
function runConsult(kviTracking) {
  const sb = sandbox(kviTracking);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public/js/consult-conversion.js'), 'utf8'), sb.ctx);
  sb.window.KviConsultConversion.recordSuccess('vip');
  sb.window.KviConsultConversion.reportSuccess('vip');
  return sb.calls;
}
test('consult-conversion.js: legacy keeps the VIP Ads conversion; off stops it; no config = unchanged', () => {
  const legacy = runConsult(tracking.clientConfig(ct, 'legacy'));
  assert.ok(legacy.some((c) => c[1] === 'conversion' && c[2].send_to === 'AW-16512183014/qFoZCJal6qscEObVz8E9'));
  const off = runConsult(tracking.clientConfig(ct, 'off'));
  assert.ok(off.some((c) => c[1] === 'generate_lead'));
  assert.ok(!off.some((c) => c[1] === 'conversion'));
  const none = runConsult(null);
  assert.ok(none.some((c) => c[1] === 'conversion' && c[2].send_to === 'AW-16512183014/qFoZCJal6qscEObVz8E9'));
});
test('kvi-tracking.js: tel/sms clicks send GA4 only unless a staged label is allowed', () => {
  const sb = sandbox(tracking.clientConfig(ct, 'legacy'));
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public/js/kvi-tracking.js'), 'utf8'), sb.ctx);
  sb.click('tel:+13104821240'); sb.click('sms:+13104821240'); sb.window.KviTracking.lead('booking_widget', 'SMILE');
  const names = sb.calls.map((c) => c[1]);
  assert.deepEqual(names, ['phone_click', 'sms_click', 'generate_lead']);
  assert.ok(!sb.calls.some((c) => String(c[1]).startsWith('AW-') || c[1] === 'conversion'));

  const cfg = tracking.clientConfig(ct, 'all'); cfg.ads.staged = { phone_click: 'AW-1/abc' }; // simulated filled label
  const sb2 = sandbox(cfg);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public/js/kvi-tracking.js'), 'utf8'), sb2.ctx);
  sb2.click('tel:+13104821240');
  assert.ok(sb2.calls.some((c) => c[1] === 'conversion' && c[2].send_to === 'AW-1/abc'));
});

test('server-side phone_call: 60 s minimum and gated by ADS_TAGS_ENABLED', () => {
  assert.equal(planCallConversion({ durationSeconds: 59, gclid: 'x', gaClientId: '1.2' }).qualifies, false);
  const legacy = planCallConversion({ durationSeconds: 60, gclid: 'x', gaClientId: '1.2' }, 'legacy');
  assert.equal(legacy.ads, null); assert.equal(legacy.ga4.events[0].name, 'phone_call');
  assert.equal(planCallConversion({ durationSeconds: 90, gclid: 'x' }, 'all').ads, null); // no action configured yet
});

// ---------------------------------------------------------------- GA4 on every page
test('GA4 G-Q0TGBPVS92 loads on every page template (incl. the 9 standalone pages)', () => {
  const r = scan(ROOT);
  assert.equal(r.headerOk, true);
  assert.deepEqual(r.missing, [], `pages without GA4:\n${r.missing.join('\n')}`);
  assert.deepEqual(r.duplicate, []);
  const ok = new Set(r.ok.map((o) => o.file));
  for (const f of ['vip-consult.html', 'vip-consult-thank-you.html', 'smile-book-consultation.html',
    'smile-book-consultation-thank-you.html', 'smile-cost.html', 'smile-la-landing-page-2026.html',
    'critical-page-quiz.html', 'khanna-genz.html', 'khanna-gamified-forms.html']) assert.ok(ok.has(f), `${f} must load GA4`);
});
test('every page with its own GA4 snippet also loads the tracking tags', () => {
  const missing = scan(ROOT).ok.filter((o) => o.via === 'own snippet')
    .filter((o) => !/include\(\s*['"]\/partials\/tracking-tags['"]/.test(fs.readFileSync(path.join(ROOT, o.file), 'utf8')))
    .map((o) => o.file);
  assert.deepEqual(missing, []);
});
