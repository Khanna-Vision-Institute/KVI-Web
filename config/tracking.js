/**
 * Site tagging config: GA4 + Google Ads conversions (single switch for every Ads send).
 * Exposed to templates as `siteTracking` (app.locals, server.js) and to the browser as
 * window.KVI_TRACKING by partials/tracking-tags.ejs.
 *
 * ---------------------------------------------------------------------------------------
 * ADS_TAGS_ENABLED - the ONE switch for every Google Ads conversion send on the site.
 *   'legacy' (DEFAULT on this review branch): only the two conversions that are ALREADY LIVE
 *            on production keep firing - PIE/VIP and SMILE (AW-16512183014).
 *            consult-conversion.js thank-you path, and KviTracking.lead() when the booking
 *            menu procedure contains smile, or pie/vip. The new staged conversions
 *            (phone_click, sms_click, generate_lead, phone_call) do NOT send.
 *   'all'    : legacy + the new staged conversions (each one also needs its label filled in below;
 *            an empty label never sends). This is the "flip on" for Google Ads account 811-555-5501.
 *   'off'    : no Google Ads sends at all, including VIP/SMILE. GA4 events keep working.
 * Override without a code change with the env var ADS_TAGS_ENABLED=legacy|all|off
 * (true/1 = all, false/0 = off). Anything else falls back to 'legacy'.
 * GA4 (G-Q0TGBPVS92) page views and GA4 events are NOT controlled by this flag.
 * ---------------------------------------------------------------------------------------
 */
const ADS_TAGS_ENABLED_DEFAULT = 'legacy';

function resolveAdsMode(raw) {
  const v = String(raw == null ? '' : raw).trim().toLowerCase();
  if (v === 'all' || v === 'true' || v === '1' || v === 'on') return 'all';
  if (v === 'off' || v === 'false' || v === '0' || v === 'none') return 'off';
  if (v === 'legacy') return 'legacy';
  return ADS_TAGS_ENABLED_DEFAULT;
}

const ADS_TAGS_ENABLED = resolveAdsMode(process.env.ADS_TAGS_ENABLED);

const GA4_MEASUREMENT_ID = 'G-Q0TGBPVS92';

/** Google Ads account the new conversions are staged for. */
const ADS_CUSTOMER_ID = '811-555-5501';

/** Google Ads tag. Configured in the page only when mode is legacy or all. */
const ADS_AW_TAG_ID = 'AW-16512183014';

/**
 * Already live on production (do not change without Khanna's approval).
 * Confirmed 2026-09-28 (Ads & Analytics): AW-16512183014 is account 811-555-5501.
 *   vip = 'PIE Google Ads Lead', smile = 'SMILE Google Ads Lead' (both Primary).
 */
const ADS_LEGACY_CONVERSIONS = Object.freeze({
  vip: 'AW-16512183014/qFoZCJal6qscEObVz8E9',
  smile: 'AW-16512183014/d1J1CK2xzqscEObVz8E9',
});

/**
 * NEW, STAGED, OFF. Fill each send_to ('AW-<tag id>/<label>') after the conversion action is
 * created in 811-555-5501. Empty = never sends, even with ADS_TAGS_ENABLED='all'.
 *   phone_click   - click on any tel: link (browser)
 *   sms_click     - click on any sms: link (browser)
 *   generate_lead - successful submit of the booking widget, schedule-consultation page,
 *                   virtual consult form or SMILE LA landing form (browser, only on server success)
 *   phone_call    - tracked call of PHONE_CALL_MIN_SECONDS or more (SERVER side, offline click
 *                   conversion upload by the call tracker; see services/callConversion.js)
 */
const ADS_STAGED_CONVERSIONS = Object.freeze({
  phone_click: 'AW-16512183014/VZUiCOPo64kdEObVz8E9', // 'Website Phone Click' (Secondary)
  sms_click: '', // no Ads action created; GA4 only
  generate_lead: 'AW-16512183014/_7tKCObo64kdEObVz8E9', // 'Website Lead Form (all forms)' (Secondary)
  phone_call: 'customers/8115555501/conversionActions/7805407420', // 'Qualified Phone Call (server, 60s+)', GCLID import; uploads need Ads API developer token
});

const PHONE_CALL_MIN_SECONDS = 60;

const SEND_TO_RE = /^AW-\d+\/[A-Za-z0-9_-]+$/;

/**
 * AW tag id to gtag('config'), or null when Ads is off.
 * This is the only switch: header.ejs and header-less fragments read it from clientConfig().adsId.
 */
function googleAdsTagId(mode = ADS_TAGS_ENABLED) {
  const m = resolveAdsMode(mode);
  return (m === 'legacy' || m === 'all') ? ADS_AW_TAG_ID : null;
}

/**
 * Booking menu procedure -> legacy Ads send_to, or null when this procedure must not convert.
 * Smile is checked first. PIE and VIP share the vip label. The procedure string is never
 * itself sent to Ads (menu value only; not a patient-typed field).
 * LASIK, SuperLASIK, EVO ICL, cataract, pterygium, CXL, Other, and blank return null.
 */
function legacyLeadSendTo(procedure, legacy) {
  if (!legacy || typeof legacy !== 'object') return null;
  const p = String(procedure == null ? '' : procedure).toLowerCase();
  if (!p) return null;
  if (p.includes('smile') && SEND_TO_RE.test(legacy.smile || '')) return legacy.smile;
  if ((p.includes('pie') || p.includes('vip')) && SEND_TO_RE.test(legacy.vip || '')) return legacy.vip;
  return null;
}

/**
 * Tag block for a header-less local content page (no visual site header).
 * Same pieces as partials/header.ejs: gtag.js + GA4 config + AW config when legacy/all
 * + window.KVI_TRACKING + kvi-tracking.js.
 */
function fragmentTrackingBlock(callTracking, mode = ADS_TAGS_ENABLED) {
  const cfg = clientConfig(callTracking, mode);
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c');
  const aw = cfg.adsId ? `  gtag('config','${cfg.adsId}');\n` : '';
  let html = `<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', '${GA4_MEASUREMENT_ID}');\n${aw}</script>\n<script>window.KVI_TRACKING = ${json};</script>\n<script src="/public/js/kvi-tracking.js" defer></script>\n`;
  if (callTracking && callTracking.KVI_CALLTRACKER_ENABLED === true && typeof callTracking.KVI_CALLTRACKER_SRC === 'string') {
    html += `<script src="${String(callTracking.KVI_CALLTRACKER_SRC).replace(/"/g, '')}" defer></script>\n`;
  }
  return html;
}

/** True when the rendered HTML already loads gtag.js or KVI_TRACKING (do not inject again). */
function pageAlreadyTagged(html) {
  if (typeof html !== 'string') return false;
  return /gtag\/js/i.test(html) || html.includes('KVI_TRACKING');
}

/** What the browser is allowed to see: only labels whose group is switched on and filled in. */
function clientConfig(callTracking, mode = ADS_TAGS_ENABLED) {
  mode = resolveAdsMode(mode);
  const legacyOn = mode === 'legacy' || mode === 'all';
  const stagedOn = mode === 'all';
  const adsId = googleAdsTagId(mode);
  const pick = (obj, keys) => keys.reduce((acc, k) => {
    if (SEND_TO_RE.test(obj[k] || '')) acc[k] = obj[k];
    return acc;
  }, {});
  const cfg = {
    ga4: GA4_MEASUREMENT_ID,
    adsMode: mode,
    ads: {
      legacy: legacyOn ? pick(ADS_LEGACY_CONVERSIONS, ['vip', 'smile']) : {},
      staged: stagedOn ? pick(ADS_STAGED_CONVERSIONS, ['phone_click', 'sms_click', 'generate_lead']) : {},
    },
    swap: { enabled: false },
  };
  // AW id only while legacy/all is on. Absent when off, so the page does not config the Ads tag.
  if (adsId) cfg.adsId = adsId;
  if (callTracking && callTracking.KVI_CALLTRACKER_ENABLED === true) {
    cfg.swap = {
      enabled: true,
      origin: callTracking.KVI_CALLTRACKER_ORIGIN,
      mode: callTracking.KVI_CALLTRACKER_MODE,
      holdMinutes: callTracking.POOL_HOLD_MINUTES,
      trackedParams: callTracking.TRACKED_PARAMS,
      targets: callTracking.SWAP_TARGETS,
      never: callTracking.NEVER_SWAP,
      pool: callTracking.WEBSITE_SWAP_POOL,
    };
  }
  return cfg;
}

module.exports = {
  ADS_TAGS_ENABLED,
  ADS_TAGS_ENABLED_DEFAULT,
  resolveAdsMode,
  GA4_MEASUREMENT_ID,
  ADS_CUSTOMER_ID,
  ADS_AW_TAG_ID,
  ADS_LEGACY_CONVERSIONS,
  ADS_STAGED_CONVERSIONS,
  PHONE_CALL_MIN_SECONDS,
  googleAdsTagId,
  legacyLeadSendTo,
  fragmentTrackingBlock,
  pageAlreadyTagged,
  clientConfig,
  clientConfigJson(callTracking, mode) {
    // Safe to inline in <script>: escape "<" so the JSON can never close the tag.
    return JSON.stringify(clientConfig(callTracking, mode)).replace(/</g, '\\u003c');
  },
};
