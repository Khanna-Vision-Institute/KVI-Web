/* KVI in-house call tracker: dynamic number swap (replaces CallRail swap.js).
 * STAGED, OFF: rendered by partials/tracking-tags.ejs ONLY when config/call-tracking.js
 * KVI_CALLTRACKER_ENABLED is true. Reads its settings from window.KVI_TRACKING.swap.
 *
 * - The HTML always keeps the office mains, (310) 482-1240 and (805) 230-2126 (NAP/SEO, works with JS off).
 * - Only TRACKED visitors (arrived with gclid/gbraid/wbraid/fbclid/msclkid/utm_*) get a pool number.
 *   Everyone else keeps the office mains. The tracked flag lasts for the browser session.
 * - One pool number per visitor, leased by the tracker (POST {origin}/api/session), held
 *   POOL_HOLD_MINUTES after last activity. It replaces both office-main tel: links.
 * - mode 'href' (default): only the tel: link changes; visible text keeps the office main.
 * - A number from the tracker is used only if it is one of the 10 configured pool numbers,
 *   so a main number or (818) 857-1735 can never be swapped in. (818) 857-1735 links are never touched.
 * - If the tracker is unreachable nothing changes.
 */
(function (window, document) {
  'use strict';
  var cfg = window.KVI_TRACKING && window.KVI_TRACKING.swap;
  if (!cfg || cfg.enabled !== true || !cfg.origin || !window.fetch) return;

  function digits(s) { return String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); }
  function fmt(d) { d = digits(d); return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6); }

  var TARGETS = {}; (cfg.targets || []).forEach(function (n) { TARGETS[digits(n)] = true; });
  var NEVER = {}; (cfg.never || []).forEach(function (n) { NEVER[digits(n)] = true; });
  var POOL = {}; (cfg.pool || []).forEach(function (n) { POOL[digits(n)] = n; });
  var MODE = cfg.mode === 'text' ? 'text' : 'href';
  var HOLD_MS = (cfg.holdMinutes || 30) * 60 * 1000;
  var KEY = 'kvi_ct_v2';
  var TRACKED_KEY = 'kvi_ct_tracked_v1';

  var qs = new URLSearchParams(window.location.search);
  var params = {};
  (cfg.trackedParams || []).forEach(function (k) { if (qs.get(k)) params[k] = qs.get(k); });
  var arrivedTracked = Object.keys(params).length > 0;
  try {
    if (arrivedTracked) window.sessionStorage.setItem(TRACKED_KEY, '1');
    if (window.sessionStorage.getItem(TRACKED_KEY) !== '1') return; // organic visitor: keep office mains
  } catch (_) { if (!arrivedTracked) return; }

  function load() {
    try { var s = JSON.parse(window.localStorage.getItem(KEY) || 'null'); return s && Date.now() - s.t < HOLD_MS ? s : null; } catch (_) { return null; }
  }
  function store(s) { s.t = Date.now(); try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }
  function gaClientId() { var m = document.cookie.match(/(?:^|; )_ga=GA\d\.\d\.(\d+\.\d+)/); return m ? m[1] : null; }
  function validPool(n) { var d = digits(n); return POOL[d] && !TARGETS[d] && !NEVER[d] ? POOL[d] : null; }

  var prev = load();
  var number = prev ? validPool(prev.number) : null;
  var payload = { sid: prev && prev.sid, currentPage: window.location.pathname + window.location.search, gaClientId: gaClientId() };
  Object.keys(params).forEach(function (k) { payload[k] = params[k]; });
  if (!prev) {
    payload.landingPage = window.location.pathname + window.location.search;
    var ref = document.referrer; try { if (ref && new URL(ref).host === window.location.host) ref = ''; } catch (_) {}
    payload.referrer = ref || '';
  }

  function replaceText(a, pool) {
    var w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT, null), n, re = /\(?\b(\d{3})\)?[\s.\-]?(\d{3})[\s.\-](\d{4})\b/g;
    while ((n = w.nextNode())) {
      n.nodeValue = n.nodeValue.replace(re, function (m, x, y, z) { return TARGETS[x + y + z] ? fmt(pool) : m; });
    }
  }
  function swap(root) {
    if (!number) return;
    var links = (root && root.querySelectorAll ? root : document).querySelectorAll('a[href^="tel:"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], d = digits(a.getAttribute('data-kvi-orig') || a.getAttribute('href'));
      if (NEVER[d] || !TARGETS[d]) continue;
      if (!a.getAttribute('data-kvi-orig')) a.setAttribute('data-kvi-orig', a.getAttribute('href'));
      a.setAttribute('href', 'tel:' + number);
      a.setAttribute('data-kvi-pool', '1');
      if (MODE === 'text') replaceText(a, number);
    }
  }
  function send() {
    window.fetch(cfg.origin + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        // Accept { number } or the prototype's { numbers: { '310': { e164 } } }.
        var n = validPool(j && (j.number || (j.numbers && (j.numbers['310'] || j.numbers['805'] || {}).e164)));
        if (!n) return;
        number = n; store({ sid: j.sid, number: n }); payload.sid = j.sid;
        delete payload.landingPage; delete payload.referrer;
        swap(document);
      })
      .catch(function () {});
  }
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    swap(document);
    send();
    if (window.MutationObserver) {
      new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) swap(n); }); }); })
        .observe(document.body, { childList: true, subtree: true });
    }
    setInterval(function () { if (document.visibilityState === 'visible') send(); }, 5 * 60 * 1000);
  });
  window.KviCallTracker = { get number() { return number; }, refresh: send };
})(window, document);
