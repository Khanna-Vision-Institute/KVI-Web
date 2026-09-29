/**
 * Site tagging config: GA4 + Google Ads conversions (single switch for every Ads send).
 * Exposed to templates as `siteTracking` (app.locals, server.js) and to the browser as
 * window.KVI_TRACKING by partials/tracking-tags.ejs.
 *
 * ---------------------------------------------------------------------------------------
 * ADS_TAGS_ENABLED - the ONE switch for every Google Ads conversion send on the site.
 *   'legacy' (DEFAULT on this review branch): only the two conversions that are ALREADY LIVE
 *            on production keep firing - VIP consult and SMILE book consult
 *            (AW-16512183014, public/js/consult-conversion.js). This is today's behavior.
 *            The new staged conversions (phone_click, sms_click, generate_lead, phone_call) do NOT send.
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

/** What the browser is allowed to see: only labels whose group is switched on and filled in. */
function clientConfig(callTracking, mode = ADS_TAGS_ENABLED) {
  mode = resolveAdsMode(mode);
  const legacyOn = mode === 'legacy' || mode === 'all';
  const stagedOn = mode === 'all';
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
  ADS_LEGACY_CONVERSIONS,
  ADS_STAGED_CONVERSIONS,
  PHONE_CALL_MIN_SECONDS,
  clientConfig,
  clientConfigJson(callTracking, mode) {
    // Safe to inline in <script>: escape "<" so the JSON can never close the tag.
    return JSON.stringify(clientConfig(callTracking, mode)).replace(/</g, '\\u003c');
  },
};
