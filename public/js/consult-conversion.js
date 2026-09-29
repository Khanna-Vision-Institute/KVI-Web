(function (window) {
  'use strict';
  var targets = {
    vip: 'AW-16512183014/qFoZCJal6qscEObVz8E9',
    smile: 'AW-16512183014/d1J1CK2xzqscEObVz8E9'
  };
  // ADS_TAGS_ENABLED (config/tracking.js, via window.KVI_TRACKING from partials/tracking-tags.ejs):
  // 'legacy' (default) and 'all' keep these two Ads conversions firing exactly as on production;
  // 'off' stops the Ads send (GA4 generate_lead still fires). If KVI_TRACKING is missing
  // (page without the partial), behave exactly as before.
  var kt = window.KVI_TRACKING;
  var adsTargets = (kt && kt.ads && kt.ads.legacy) ? kt.ads.legacy : targets;
  var maxAge = 5 * 60 * 1000;
  function key(kind) { return 'kvi_consult_success_v1_' + kind; }
  function reset(kind) {
    if (!Object.prototype.hasOwnProperty.call(targets, kind)) return;
    try { window.sessionStorage.removeItem(key(kind)); } catch (_) {}
  }
  function recordSuccess(kind) {
    if (!Object.prototype.hasOwnProperty.call(targets, kind)) return false;
    reset(kind);
    try {
      // A random submission receipt, never a patient/CRM identifier or form value.
      var receipt = window.crypto.randomUUID();
      window.sessionStorage.setItem(key(kind), JSON.stringify({ at: Date.now(), receipt: receipt }));
      return true;
    } catch (_) { return false; }
  }
  function reportSuccess(kind) {
    if (!Object.prototype.hasOwnProperty.call(targets, kind) || typeof window.gtag !== 'function') return false;
    try {
      var raw = window.sessionStorage.getItem(key(kind));
      // Consume before queueing either event. Direct visits/reloads cannot recount it.
      window.sessionStorage.removeItem(key(kind));
      if (!raw) return false;
      var pending = JSON.parse(raw);
      var age = Date.now() - pending.at;
      if (typeof pending.at !== 'number' || !Number.isFinite(age) || age < 0 || age > maxAge ||
          typeof pending.receipt !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pending.receipt)) return false;
      window.gtag('event', 'generate_lead', {
        send_to: 'G-Q0TGBPVS92', form_id: kind === 'vip' ? 'vip_consult' : 'smile_consult'
      });
      var sendTo = adsTargets[kind];
      if (sendTo) {
        window.gtag('config', sendTo.split('/')[0]);
        window.gtag('event', 'conversion', { send_to: sendTo, transaction_id: pending.receipt });
      }
      return true;
    } catch (_) { return false; }
  }
  window.KviConsultConversion = Object.freeze({ reset: reset, recordSuccess: recordSuccess, reportSuccess: reportSuccess });
})(window);
