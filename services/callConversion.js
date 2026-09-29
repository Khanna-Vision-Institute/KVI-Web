/**
 * Server-side phone_call conversion (STAGED, DRY-RUN ONLY - nothing is sent from this module).
 *
 * The in-house call tracker calls planCallConversion() when a tracked call ends. It returns what
 * WOULD be sent:
 *   - GA4 Measurement Protocol event `phone_call` to G-Q0TGBPVS92 (needs a GA4 API secret; not set up)
 *   - Google Ads offline click conversion for account 811-555-5501 - ONLY when
 *     ADS_TAGS_ENABLED === 'all' AND ADS_STAGED_CONVERSIONS.phone_call is filled in AND the call
 *     had a gclid AND lasted PHONE_CALL_MIN_SECONDS (60 s) or more.
 * No caller number, name or other patient data goes into either payload.
 */
const tracking = require('../config/tracking');

function planCallConversion(call, mode = tracking.ADS_TAGS_ENABLED) {
  mode = tracking.resolveAdsMode(mode);
  const c = call || {};
  const seconds = Number(c.durationSeconds) || 0;
  const qualifies = seconds >= tracking.PHONE_CALL_MIN_SECONDS;
  const out = { qualifies, ga4: null, ads: null, adsSkippedReason: null };
  if (!qualifies) { out.adsSkippedReason = `call shorter than ${tracking.PHONE_CALL_MIN_SECONDS}s`; return out; }

  if (c.gaClientId) {
    out.ga4 = {
      measurement_id: tracking.GA4_MEASUREMENT_ID,
      client_id: String(c.gaClientId),
      events: [{ name: 'phone_call', params: {
        call_source: c.source || 'unknown',
        call_outcome: c.outcome || 'unknown',
        duration_seconds: seconds,
      } }],
    };
  }

  const action = tracking.ADS_STAGED_CONVERSIONS.phone_call;
  if (mode !== 'all') out.adsSkippedReason = `ADS_TAGS_ENABLED is '${mode}' (phone_call sends only when 'all')`;
  else if (!action) out.adsSkippedReason = 'phone_call conversion action not set in config/tracking.js';
  else if (!c.gclid) out.adsSkippedReason = 'no gclid on the tracked session';
  else {
    out.ads = {
      customerId: tracking.ADS_CUSTOMER_ID.replace(/-/g, ''),
      conversionAction: action,
      gclid: String(c.gclid),
      conversionDateTime: c.endedAt || null,
      conversionValue: null,
    };
  }
  return out;
}

module.exports = { planCallConversion };
