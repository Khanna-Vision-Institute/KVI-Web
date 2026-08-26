(function () {
  'use strict';

  var NS = 'kvi_physician_';

  function getCfg() {
    return typeof window !== 'undefined' ? window.KVI_PORTAL_AUTH : null;
  }

  function qs(el, sel) {
    return el && el.querySelector ? el.querySelector(sel) : document.querySelector(sel);
  }

  function decodeJwtPayload(jwt) {
    try {
      var p = String(jwt || '').split('.')[1];
      if (!p) return null;
      p = p.replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';
      return JSON.parse(atob(p));
    } catch (_) {
      return null;
    }
  }

  function jwtExpUnix(jwt) {
    var o = decodeJwtPayload(jwt);
    var exp = o && typeof o.exp === 'number' ? o.exp : 0;
    return exp || 0;
  }

  function nowSec() {
    return Math.floor(Date.now() / 1000);
  }

  function getAccessToken() {
    try {
      return sessionStorage.getItem(NS + 'access_token');
    } catch (_) {
      return null;
    }
  }

  function getRefreshToken() {
    try {
      return sessionStorage.getItem(NS + 'refresh_token');
    } catch (_) {
      return null;
    }
  }

  function getIdToken() {
    try {
      return sessionStorage.getItem(NS + 'id_token');
    } catch (_) {
      return null;
    }
  }

  function getDisplayEmail() {
    try {
      return sessionStorage.getItem(NS + 'display_email');
    } catch (_) {
      return null;
    }
  }

  function readProfile() {
    try {
      var raw = sessionStorage.getItem(NS + 'profile');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function writeProfile(obj) {
    try {
      if (!obj) {
        sessionStorage.removeItem(NS + 'profile');
        return;
      }
      sessionStorage.setItem(NS + 'profile', JSON.stringify(obj));
    } catch (_) {}
  }

  function syncProfileFromIdToken() {
    var id = getIdToken();
    if (!id) return readProfile();
    var p = decodeJwtPayload(id);
    if (!p) return readProfile();
    var cur = readProfile() || {};
    var next = {
      given_name: p.given_name || cur.given_name || '',
      family_name: p.family_name || cur.family_name || '',
      email: p.email || cur.email || '',
      name: p.name || cur.name || '',
    };
    writeProfile(next);
    return next;
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(NS + 'access_token');
      sessionStorage.removeItem(NS + 'refresh_token');
      sessionStorage.removeItem(NS + 'id_token');
      sessionStorage.removeItem(NS + 'display_email');
      sessionStorage.removeItem(NS + 'profile');
    } catch (_) {}
  }

  function signInHref(cfg, returnUrl) {
    var base = cfg.signInPath || '/Doctorportal/auth/sign-in.html';
    try {
      return base + '?return=' + encodeURIComponent(returnUrl || location.pathname + location.search);
    } catch (_) {
      return base;
    }
  }

  function isAuthPublicPath(pathname) {
    var p = String(pathname || '').toLowerCase();
    return p.indexOf('/doctorportal/auth') === 0;
  }

  function pathSansQuery(pathname) {
    return String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/';
  }

  function isProtectedPortalPage(pathname) {
    var pl = pathSansQuery(pathname).toLowerCase();
    if (pl.endsWith('/')) pl = pl.replace(/\/+$/, '') || '/';

    if (/^\/doctorportal\/for-physicians(\.html)?$/i.test(pl)) return true;
    if (/^\/doctorportal\/refer-a-patient(\.html)?$/i.test(pl)) return true;
    if (/^\/doctorportal\/book-consultation(\.html)?$/i.test(pl)) return true;
    if (/^\/referral(\.html)?$/i.test(pl)) return true;
    return false;
  }

  /**
   * - requirePortalSignIn === true → lock hub + worksheet + scheduler pages.
   * - Otherwise fall back to requireReferralSignIn (worksheet + /Referral only).
   */
  function needsProtectedPortalPath(cfg, pathname) {
    if (!cfg) return false;
    if (isAuthPublicPath(pathname)) return false;

    if (cfg.requirePortalSignIn === true) {
      return isProtectedPortalPage(pathname);
    }

    return !!cfg.requireReferralSignIn && isReferralWorksheetPath(pathname);
  }

  function isReferralWorksheetPath(pathname) {
    var pl = pathSansQuery(pathname).toLowerCase();
    return /^\/doctorportal\/refer-a-patient(\.html)?$/i.test(pl) || /^\/referral(\.html)?$/i.test(pl);
  }

  function isBookConsultPath(pathname) {
    var pl = pathSansQuery(pathname).toLowerCase();
    return /^\/doctorportal\/book-consultation(\.html)?$/i.test(pl);
  }

  function isApiConfigured(url) {
    var s = String(url || '').trim();
    if (!s) return false;
    if (s.indexOf('REPLACE') !== -1) return false;
    if (s.startsWith('/')) return true;
    return /^https:\/\//i.test(s);
  }

  function physicianMeEndpoint(cfg) {
    var base = String((cfg && cfg.apiBaseUrl) || '').trim();
    if (!base) return '';
    base = base.replace(/\/+$/, '');
    if (/^https?:\/\//i.test(base)) return base + '/me';
    if (base.startsWith('/')) return base + '/me';
    return '/' + base.replace(/^\/+/g, '') + '/me';
  }

  async function cognitoFetch(cfg, target, bodyObj) {
    var url = 'https://cognito-idp.' + cfg.region + '.amazonaws.com/';
    var resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        Accept: 'application/json',
        'X-Amz-Target': target,
      },
      body: JSON.stringify(bodyObj),
    });
    var txt = await resp.text();
    var data;
    try {
      data = JSON.parse(txt);
    } catch (_) {
      data = { __parseError: txt };
    }
    return { ok: resp.ok && !data.__type && !data.__parseError, resp: resp, data: data };
  }

  async function refreshIfNeeded(cfg) {
    var at = getAccessToken();
    var rt = getRefreshToken();
    if (!cfg || !rt || !cfg.clientId) return at;

    var exp = jwtExpUnix(at || '');
    if (at && exp && exp - nowSec() > 90) return at;

    var r = await cognitoFetch(cfg, 'AWSCognitoIdentityProviderService.InitiateAuth', {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: cfg.clientId,
      AuthParameters: { REFRESH_TOKEN: rt },
    });

    if (!r.ok) {
      /** Only revoke local session on definitive Cognito auth failures — not network blips. */
      var errType =
        r.data && typeof r.data.__type === 'string'
          ? r.data.__type
          : r.data && typeof r.data.code === 'string'
            ? r.data.code
            : '';
      if (
        /NotAuthorized/i.test(errType) ||
        /NotAuthorizedException/i.test(errType) ||
        errType.endsWith(':NotAuthorizedException')
      ) {
        clearSession();
        return null;
      }
      return at;
    }

    var ar = r.data && r.data.AuthenticationResult;
    if (!ar || !ar.AccessToken) {
      /** Successful HTTP + JSON shape we did not anticipate — avoid wiping cookies/tokens blindly. */
      return at;
    }

    try {
      sessionStorage.setItem(NS + 'access_token', ar.AccessToken);
      if (ar.IdToken) sessionStorage.setItem(NS + 'id_token', ar.IdToken);
      if (!getDisplayEmail() && ar.IdToken) {
        var idp = decodeJwtPayload(ar.IdToken);
        if (idp && idp.email) sessionStorage.setItem(NS + 'display_email', String(idp.email));
      }
      if (ar.IdToken) syncProfileFromIdToken();
      if (!ar.RefreshToken) {
      } else {
        sessionStorage.setItem(NS + 'refresh_token', ar.RefreshToken);
      }
    } catch (_) {}

    return sessionStorage.getItem(NS + 'access_token');
  }

  function normalizeMePayload(status, txt) {
    var data = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch (_) {
      data = null;
    }
    if (status === 401 || status === 403) {
      return { __unauthorized: true, status: status, body: data };
    }
    if (status < 200 || status >= 300) {
      return { __httpError: true, status: status, body: data };
    }
    return data;
  }

  async function fetchMeViaXhr(endpoint, bearer) {
    return await new Promise(function (resolve) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', endpoint);
        xhr.setRequestHeader('Authorization', 'Bearer ' + bearer);
        /** Same token for Express proxy if an extension strips `Authorization` (`requests.js` etc.). */
        xhr.setRequestHeader('X-KVI-Physician-Bearer', bearer);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.timeout = 20000;
        xhr.onerror = function () {
          resolve({ __networkError: true });
        };
        xhr.ontimeout = function () {
          resolve({ __networkError: true });
        };
        xhr.onload = function () {
          resolve(normalizeMePayload(xhr.status, xhr.responseText || ''));
        };
        xhr.send();
      } catch (_) {
        resolve({ __networkError: true });
      }
    });
  }

  async function fetchMeViaFetch(endpoint, bearer) {
    try {
      var resp = await fetch(endpoint, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          Authorization: 'Bearer ' + bearer,
          'X-KVI-Physician-Bearer': bearer,
          Accept: 'application/json',
        },
      });
      var txt = await resp.text();
      return normalizeMePayload(resp.status, txt);
    } catch (_) {
      return { __networkError: true };
    }
  }

  async function fetchMeWithBearer(cfg, bearer) {
    if (!cfg || !isApiConfigured(cfg.apiBaseUrl) || !bearer) return null;

    var endpoint = physicianMeEndpoint(cfg);
    if (!endpoint) return null;

    /**
     * Some browser extensions wrap `fetch` (Network tab initiator shows `requests.js`).
     * `XMLHttpRequest` still carries `Authorization` more reliably on same-origin calls.
     */
    var xhrRes = await fetchMeViaXhr(endpoint, bearer);
    if (xhrRes && xhrRes.__networkError) {
      return await fetchMeViaFetch(endpoint, bearer);
    }
    return xhrRes;
  }

  /**
   * Try ID token first, then access token — Cognito JWT authorizers line up cleanly
   * with ID token `aud`; access tokens expose `client_id` when `aud` is absent.
   * Never clear the session until *both* hard-fail with 401/403.
   */
  async function verifySessionWithMe(cfg) {
    if (!cfg || !isApiConfigured(cfg.apiBaseUrl)) {
      return { me: null, hardAuthFailure: false };
    }

    var candidates = [];
    var at = getAccessToken();
    var it = getIdToken();
    if (it) candidates.push(it);
    if (at && at !== it) candidates.push(at);

    if (!candidates.length) {
      return { me: null, hardAuthFailure: false };
    }

    var unauthorizedAll = true;
    var anyTried = false;

    for (var i = 0; i < candidates.length; i++) {
      var res = await fetchMeWithBearer(cfg, candidates[i]);
      if (!res) continue;
      if (res.__networkError) {
        unauthorizedAll = false;
        continue;
      }
      if (res.__httpError) {
        unauthorizedAll = false;
        continue;
      }
      if (res.__unauthorized) {
        anyTried = true;
        continue;
      }
      if (res && res.ok) {
        return { me: res, hardAuthFailure: false };
      }
    }

    return { me: null, hardAuthFailure: !!(anyTried && unauthorizedAll) };
  }

  function normalizeTitle(raw) {
    var s = String(raw || '').trim();
    if (!s) s = 'Dr.';
    // Allow "Dr" or "Dr." — display nicely
    if (!/\.$/.test(s)) s += '.';
    return s;
  }

  function mergeMeIntoProfile(profile, me) {
    if (!profile) profile = {};
    if (!me || !me.physician || typeof me.physician !== 'object') return profile;
    var ph = me.physician;
    if (typeof ph.given_name === 'string' && ph.given_name && !profile.given_name)
      profile.given_name = ph.given_name;
    if (typeof ph.family_name === 'string' && ph.family_name && !profile.family_name)
      profile.family_name = ph.family_name;
    if (typeof ph.email === 'string' && ph.email && !profile.email) profile.email = ph.email;
    writeProfile(profile);
    return profile;
  }

  function buildWelcomeLine(cfg, profile) {
    var title = normalizeTitle((cfg && cfg.profileTitle) || 'Dr.');
    var fam = profile && profile.family_name ? String(profile.family_name).trim() : '';
    var giv = profile && profile.given_name ? String(profile.given_name).trim() : '';
    if (fam) return 'Welcome, ' + title + ' ' + fam + '!';
    if (giv) return 'Welcome, ' + title + ' ' + giv + '!';
    if (profile && profile.email) return 'Welcome back!';
    return 'Welcome!';
  }

  function headerLabel(cfg, profile, email) {
    var title = normalizeTitle((cfg && cfg.profileTitle) || 'Dr.');
    var fam = profile && profile.family_name ? String(profile.family_name).trim() : '';
    if (fam) return title + ' ' + fam;
    var giv = profile && profile.given_name ? String(profile.given_name).trim() : '';
    if (giv) return title + ' ' + giv;
    return email || 'Signed in';
  }

  function slugifyAscii(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  function maybePersonalizedUrlHash(cfg, profile) {
    if (!cfg || cfg.personalizedUrlHash === false) return;
    if (!profile) return;

    var giv = slugifyAscii(profile.given_name || '');
    var fam = slugifyAscii(profile.family_name || '');
    var token = '';
    if (fam && giv) token = 'dr-' + giv + '-' + fam;
    else token = 'dr-' + (fam || giv || '');
    token = token.replace(/^dr-+/, 'dr-');
    if (token === 'dr-' || token.length < 4) return;

    try {
      var cur = String(location.hash || '').replace(/^#/, '');
      if (cur === token) return;
      history.replaceState(null, '', location.pathname + location.search + '#' + token);
    } catch (_) {}
  }

  function applyPersonalization(cfg, profile, signed) {
    if (!signed || !profile) return;
    if (cfg && cfg.personalizePortal === false) return;

    var line = buildWelcomeLine(cfg, profile);

    var kicker = document.querySelector('.fp-hub-banner-kicker');
    if (kicker) kicker.textContent = line;

    var lead = document.querySelector('.fp-hub-banner-lead');
    if (lead && (profile.given_name || profile.family_name || profile.email)) {
      var first = (profile.given_name || '').trim() || String(profile.email || '').split('@')[0] || 'there';
      lead.textContent =
        'Hi ' +
        first +
        ' — Beverly Hills & Westlake Village referrals, scheduling, and co-management tools live below.';
    }

    var rh = document.querySelector('.rf-refer-main .rf-hero h1');
    if (rh && !rh.dataset.kviPersonalized) {
      rh.dataset.kviPersonalized = '1';
      var sub = document.createElement('p');
      sub.className = 'rf-sub';
      sub.style.marginTop = '0.45rem';
      sub.textContent = line;
      rh.insertAdjacentElement('afterend', sub);
    }

    var bcHero = document.querySelector('.bc-sched-page .bc-sched-hero h1');
    if (bcHero && !bcHero.dataset.kviPersonalized) {
      bcHero.dataset.kviPersonalized = '1';
      var sub2 = document.createElement('p');
      sub2.className = 'rf-sub';
      sub2.style.marginTop = '0.55rem';
      sub2.style.maxWidth = '52rem';
      sub2.textContent = line;
      bcHero.insertAdjacentElement('afterend', sub2);
    }

    maybePersonalizedUrlHash(cfg, profile);
  }

  function ensureHeaderSlot(cfg) {
    if (document.getElementById('kvi-portal-auth-slot')) return;

    var hub = qs(document, '.fp-hub-header-links');
    var inner = qs(document, '.kh-header-inner');
    var nav = qs(document, '.kh-nav');

    var slot = document.createElement('div');
    slot.id = 'kvi-portal-auth-slot';

    if (hub && hub.parentNode) {
      hub.parentNode.insertBefore(slot, hub);
      return;
    }
    if (nav && inner) {
      nav.insertAdjacentElement('afterbegin', slot);
      return;
    }
    if (inner && !slot.parentNode) {
      inner.insertAdjacentElement('beforeend', slot);
    }
  }

  function paintHeader(cfg, opts) {
    var slot = document.getElementById('kvi-portal-auth-slot');
    if (!slot) return;

    var signedIn = !!(opts && opts.accessTokenOk);
    var email = opts && opts.email ? String(opts.email) : getDisplayEmail();
    var profile = (opts && opts.profile) || readProfile();
    slot.innerHTML = '';

    if (signedIn) {
      var wrap = document.createElement('span');
      wrap.className = 'kvi-pa-badge';
      wrap.title = email || '';

      var small = document.createElement('small');
      small.textContent = headerLabel(cfg, profile, email);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kvi-pa-link';
      btn.textContent = 'Sign out';
      btn.addEventListener('click', function () {
        clearSession();
        location.reload();
      });

      wrap.appendChild(small);
      wrap.appendChild(btn);
      slot.appendChild(wrap);
      return;
    }

    var a = document.createElement('a');
    a.className = 'kvi-pa-link';
    a.href = signInHref(cfg, location.pathname + location.search);
    a.textContent = 'Physician sign in';
    slot.appendChild(a);
  }

  function buildGateCard(cfg) {
    var gate = document.createElement('section');
    gate.id = 'kvi-portal-auth-gate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.setAttribute('aria-label', 'Sign in required');

    gate.innerHTML =
      '' +
      '<div class="kvi-pa-gate-card">' +
      '<h2>Physician sign-in required</h2>' +
      '<p>The Khanna Vision Institute physician portal is limited to enrolled referring clinicians.</p>' +
      '</div>';

    var a = document.createElement('a');
    a.href = signInHref(cfg, location.pathname + location.search + location.hash);
    a.className = 'kvi-pa-btn';
    a.style.marginTop = '0.5rem';
    a.textContent = 'Continue to sign in';
    gate.querySelector('.kvi-pa-gate-card').appendChild(a);

    return gate;
  }

  function ensurePortalGate(cfg, verified) {
    document.querySelectorAll('#kvi-portal-auth-gate').forEach(function (n) {
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });

    if (!needsProtectedPortalPath(cfg, location.pathname)) return;
    if (verified) return;

    var gate = buildGateCard(cfg);

    var path = pathSansQuery(location.pathname);
    var inlineMount = null;

    if (isReferralWorksheetPath(path)) inlineMount = document.querySelector('.rf-form-wrap');
    if (isBookConsultPath(path)) inlineMount = document.querySelector('.bc-rf-form-wrap') || inlineMount;

    if (inlineMount) {
      inlineMount.appendChild(gate);
      return;
    }

    gate.classList.add('kvi-portal-auth-gate--fixed');
    document.body.appendChild(gate);
  }

  function blockSubmitIfGated(cfg) {
    document.addEventListener(
      'submit',
      function (ev) {
        if (!needsProtectedPortalPath(cfg, location.pathname)) return;
        var form = ev.target && ev.target.closest ? ev.target.closest('form') : null;
        if (!form) return;
        if (form.id !== 'rf-form' && form.id !== 'bc-form') return;
        if (!window.__kviPortalVerified) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      },
      true,
    );
  }

  async function boot() {
    var cfg = getCfg();
    if (!cfg) return;

    /** Mirrors `needsProtectedPortalPath`: any gated surface triggers Cognito/me flow */
    var portalGateOn =
      cfg.requirePortalSignIn === true || !!cfg.requireReferralSignIn;
    if (!portalGateOn) {
      window.__kviPortalVerified = true;
      return;
    }

    if (!cfg.clientId || cfg.clientId === 'DISABLED' || cfg.clientId.indexOf('REPLACE') !== -1) {
      return;
    }

    window.__kviPortalVerified = false;
    blockSubmitIfGated(cfg);
    ensureHeaderSlot(cfg);
    ensurePortalGate(cfg, false);

    if (!isApiConfigured(cfg.apiBaseUrl)) {
      var p0a = syncProfileFromIdToken();
      paintHeader(cfg, { accessTokenOk: false, email: getDisplayEmail(), profile: p0a });
      ensurePortalGate(cfg, false);
      return;
    }

    await refreshIfNeeded(cfg);
    var hasToken = !!(getAccessToken() || getIdToken());
    if (!hasToken) {
      var p0 = syncProfileFromIdToken();
      paintHeader(cfg, { accessTokenOk: false, email: getDisplayEmail(), profile: p0 });
      ensurePortalGate(cfg, false);
      return;
    }

    var verify = await verifySessionWithMe(cfg);
    var me = verify.me;
    /** When `/me` hard-fails (e.g. API Gateway JWT mismatch), scrubbing session hides Cognito tokens in DevTools. */
    var keepTk = !!(cfg && cfg.keepSessionTokensOnMe401 === true);
    if (verify.hardAuthFailure && !keepTk) {
      clearSession();
      me = null;
    }

    var signed = !!(me && me.ok);
    var emailFromMe =
      signed && me.physician && typeof me.physician.email === 'string' ? me.physician.email : null;

    var email = emailFromMe || getDisplayEmail();
    if (email) {
      try {
        sessionStorage.setItem(NS + 'display_email', email);
      } catch (_) {}
    }

    var profile = syncProfileFromIdToken();
    if (signed) profile = mergeMeIntoProfile(profile || {}, me);
    else if (verify.hardAuthFailure && !keepTk) profile = null;

    window.__kviPortalVerified = signed;
    paintHeader(cfg, { accessTokenOk: signed, email: email, profile: profile });
    ensurePortalGate(cfg, signed);
    if (signed) applyPersonalization(cfg, profile, signed);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot().catch(function () {});
    });
  } else {
    boot().catch(function () {});
  }
})();
