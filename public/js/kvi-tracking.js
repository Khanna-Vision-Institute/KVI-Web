/* KVI site tagging: phone/text click events + lead events, with every Google Ads send
 * behind the ADS_TAGS_ENABLED switch (config/tracking.js -> window.KVI_TRACKING, rendered by
 * partials/tracking-tags.ejs).
 *
 * GA4 (always, not affected by ADS_TAGS_ENABLED):
 *   phone_click  { link_url: tel number, link_location }   on any a[href^="tel:"] click
 *   sms_click    { link_url: sms number, link_location }   on any a[href^="sms:"] click
 *   generate_lead { form_id, procedure? }                  via KviTracking.lead() after a SUCCESSFUL submit
 * Google Ads phone/sms (only when window.KVI_TRACKING.ads.staged has a send_to, i.e.
 * ADS_TAGS_ENABLED='all' AND the label is filled in): conversion { send_to }.
 * Google Ads lead: if ads.staged.generate_lead is set, send that label only.
 * If staged is empty and ads.legacy is present, map the booking MENU procedure
 * (config/tracking.js legacyLeadSendTo): smile -> legacy.smile, pie or vip -> legacy.vip.
 * LASIK, SuperLASIK, EVO ICL, cataract, pterygium, CXL, Other, and blank do not send.
 * No names, emails, phone numbers typed by patients, or the procedure string are sent to Ads.
 */
(function (window, document) {
  'use strict';
  var cfg = window.KVI_TRACKING || {};
  var GA4 = cfg.ga4 || 'G-Q0TGBPVS92';
  var staged = (cfg.ads && cfg.ads.staged) || {};
  var legacy = (cfg.ads && cfg.ads.legacy) || {};
  var adsConfigured = {};

  function gtagReady() { return typeof window.gtag === 'function'; }
  function sendConversion(sendTo, extra) {
    if (!sendTo || !/^AW-\d+\/[A-Za-z0-9_-]+$/.test(sendTo) || !gtagReady()) return false;
    var tagId = sendTo.split('/')[0];
    if (!adsConfigured[tagId]) { window.gtag('config', tagId); adsConfigured[tagId] = true; }
    var p = { send_to: sendTo };
    if (extra && extra.transaction_id) p.transaction_id = extra.transaction_id;
    window.gtag('event', 'conversion', p);
    return true;
  }
  function adsSend(eventName, extra) {
    return sendConversion(staged[eventName], extra);
  }
  // Keep in sync with legacyLeadSendTo in config/tracking.js. Menu value only.
  function legacyLeadSendTo(procedure) {
    var p = String(procedure || '').toLowerCase();
    if (!p) return null;
    if (p.indexOf('smile') !== -1) return legacy.smile || null;
    if (p.indexOf('pie') !== -1 || p.indexOf('vip') !== -1) return legacy.vip || null;
    return null;
  }
  function stagedEmpty() {
    return Object.keys(staged).length === 0;
  }
  function ga4Send(eventName, params) {
    if (!gtagReady()) return false;
    var p = { send_to: GA4 };
    Object.keys(params || {}).forEach(function (k) { if (params[k] != null && params[k] !== '') p[k] = params[k]; });
    window.gtag('event', eventName, p);
    return true;
  }
  function where(a) {
    if (a.closest('header, .main-header')) return 'header';
    if (a.closest('footer')) return 'footer';
    return 'body';
  }
  function receipt() {
    try { return window.crypto.randomUUID(); } catch (_) { return String(Date.now()) + Math.random().toString(16).slice(2); }
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = (a.getAttribute('href') || '').trim().toLowerCase();
    var kind = href.indexOf('tel:') === 0 ? 'phone_click' : (href.indexOf('sms:') === 0 ? 'sms_click' : null);
    if (!kind) return;
    // The dialed number is the practice's own (office main or tracking number), never patient data.
    var num = href.replace(/^(tel|sms):/, '').replace(/[^\d+]/g, '');
    ga4Send(kind, { link_url: num, link_location: where(a), pool_number: a.getAttribute('data-kvi-pool') === '1' ? 'yes' : 'no' });
    adsSend(kind);
  }, true);

  /** Call ONLY after the server confirmed the submission. formId: short fixed id, procedure: menu value. */
  function lead(formId, procedure) {
    if (typeof formId !== 'string' || !/^[a-z0-9_]{2,40}$/.test(formId)) return false;
    var proc = typeof procedure === 'string' ? procedure.slice(0, 60) : '';
    var sent = ga4Send('generate_lead', { form_id: formId, procedure: proc });
    var receiptId = receipt();
    if (staged.generate_lead) {
      // Mode 'all': staged label only. Do not also send a legacy label.
      adsSend('generate_lead', { transaction_id: receiptId });
    } else if (stagedEmpty() && (legacy.smile || legacy.vip)) {
      var sendTo = legacyLeadSendTo(proc);
      if (sendTo) sendConversion(sendTo, { transaction_id: receiptId });
    }
    return sent;
  }

  window.KviTracking = Object.freeze({ lead: lead, adsMode: cfg.adsMode || 'legacy' });
})(window, document);
