const express = require('express');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const dotenv = require('dotenv');
const cron = require('node-cron');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');

dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });


const visionQuestRoutes = require('./routes/visionQuest');
const bookingRoutes = require('./routes/booking');
const blogRoutes = require('./routes/blog');
const seminarRsvpRoutes = require('./routes/seminarRsvp');
const smileLandingLeadRoutes = require('./routes/smileLandingLead');
const smileBookConsultRoutes = require('./routes/smileBookConsult');
const physicianReferralRoutes = require('./routes/physicianReferral');
const bookConsultPortalRoutes = require('./routes/bookConsultPortal');
const internalGrowthopsBlogRoutes = require('./routes/internalGrowthopsBlog');
const kviVoiceWebRoutes = require('./routes/kviVoiceWeb');
const { getPageBySlug } = require('./services/pages');
const { getAllBlogs } = require('./services/mongodb');
const legacyWordPressRedirects = require('./legacy-wordpress-redirects');
const { loadReferralOfficesRegistry, normalizeSlugKey, practiceNameToClinicKey } = require('./services/referralOffices');

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, 'public');
const CHAT_OPENERS_JSON = path.join(PUBLIC_DIR, 'js', 'kvi-chat-openers.json');

/* Nginx / Cloudflare — needed so req.protocol and forwarded Host/proto match the browser URL for OAuth redirect_uri. */
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname));
app.set("view cache", false);

// Guru proxy MUST be before body parsing so the raw request body is forwarded
const GURU_SERVER = process.env.GURU_SERVER_URL || 'http://ec2-100-28-122-42.compute-1.amazonaws.com:8000';
app.use('/api/guru', createProxyMiddleware({
  target: GURU_SERVER,
  changeOrigin: true,
  pathRewrite: { '^/api/guru': '' },
  proxyTimeout: 60000,
  onError: (err, req, res) => {
    console.error('Guru proxy error:', err.message);
    res.status(502).json({ error: 'Guru service temporarily unavailable. Please try again later.' });
  }
}));

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

/**
 * Physician portal — same-origin `/me` proxy.
 * Browsers/extensions sometimes break cross-origin `Authorization` fetches to API Gateway,
 * while same-origin GET + Bearer works reliably server-side forward.
 *
 * `.env`:
 *   PHYSICIAN_PORTAL_ME_URL=https://xxxx.execute-api.us-east-1.amazonaws.com/prod/me
 */
const PHYSICIAN_PORTAL_ME_URL = (process.env.PHYSICIAN_PORTAL_ME_URL || '').trim();

function jwtClaimPeek(authBearer) {
  try {
    const m = /^Bearer\s+(.+)$/i.exec(String(authBearer || '').trim());
    const jwt = m && m[1];
    const p = String(jwt || '').split('.')[1];
    if (!p) return null;
    const b64 = p.replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(b64 + pad, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return {
      iss: typeof payload.iss === 'string' ? payload.iss : undefined,
      aud: payload.aud,
      token_use: payload.token_use,
      client_id: payload.client_id,
    };
  } catch (_) {
    return null;
  }
}

app.get('/api/physician-portal/me', async (req, res) => {
  const rawAuth =
    typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
  const rawXHdr =
    (typeof req.get === 'function' ? String(req.get('X-KVI-Physician-Bearer') || '').trim() : '') ||
    String((req.headers && req.headers['x-kvi-physician-bearer']) || '').trim();

  let auth = rawAuth;
  if (!/^Bearer\s+\S+/i.test(auth) && rawXHdr) {
    auth = /^Bearer\s+/i.test(rawXHdr) ? rawXHdr.trim() : `Bearer ${rawXHdr}`;
  }

  if (!/^Bearer\s+\S+/i.test(auth)) {
    console.warn('[physician-portal/me] missing bearer headers', {
      authorizationChars: rawAuth.length,
      xPhysicianBearerChars: rawXHdr.length,
    });
    return res.status(401).json({
      ok: false,
      code: 'MISSING_TOKEN',
      message:
        'JWT did not reach Express — Authorization and X-KVI-Physician-Bearer empty/malformed.',
    });
  }

  if (!PHYSICIAN_PORTAL_ME_URL) {
    return res.status(503).json({
      ok: false,
      code: 'ME_URL_MISSING',
      message:
        'Set PHYSICIAN_PORTAL_ME_URL in the .env next to pm2 cwd (often `~/kvi-home/kvi home/.env`).',
    });
  }

  try {
    const upstream = await axios.get(PHYSICIAN_PORTAL_ME_URL, {
      headers: {
        Authorization: auth,
        Accept: 'application/json',
      },
      validateStatus: () => true,
      timeout: 12000,
    });

    if (upstream.status === 401 || upstream.status === 403) {
      const peek = jwtClaimPeek(auth);
      const preview =
        typeof upstream.data === 'string'
          ? upstream.data.slice(0, 300)
          : JSON.stringify(upstream.data ?? {}).slice(0, 500);
      console.warn('[physician-portal/me] upstream rejected JWT', {
        upstreamStatus: upstream.status,
        peek,
        bodyPreview: preview,
      });
    }

    let body = upstream.data;
    if (
      (upstream.status === 401 || upstream.status === 403) &&
      upstream.data &&
      typeof upstream.data === 'object' &&
      !Array.isArray(upstream.data)
    ) {
      body = { ...upstream.data, kviRejectedBy: 'upstream_jwt_authorizer' };
    }

    res.status(upstream.status);
    return res.json(body);
  } catch (err) {
    console.error('[physician-portal/me] proxy error:', err && err.message ? err.message : err);
    return res.status(502).json({ ok: false, code: 'UPSTREAM_unreachable', message: 'Upstream /me unreachable.' });
  }
});

/* Long cache for /public + /assets (ETag still allows revalidation after deploys). Omit immutable — filenames are not content-hashed. */
const STATIC_MAX_AGE = process.env.NODE_ENV === 'production' ? '7d' : 0;

/* Explicit JSON endpoint so reverse proxies/CDNs can distinguish from long-lived static bundles; avoids 7d cache on editable copy */
app.get('/api/kvi-chat-openers.json', (req, res) => {
  if (!fs.existsSync(CHAT_OPENERS_JSON)) {
    res.status(404).json({ error: 'chat_openers_file_missing', openers: [], source: 'server' });
    return;
  }
  res.type('application/json');
  res.setHeader(
    'Cache-Control',
    process.env.NODE_ENV === 'production' ? 'public, max-age=300, stale-while-revalidate=3600' : 'no-store'
  );
  res.sendFile(CHAT_OPENERS_JSON);
});

app.use('/public', express.static(PUBLIC_DIR, {
  maxAge: STATIC_MAX_AGE || undefined,
  etag: true,
  setHeaders(res, absPath) {
    if (path.basename(absPath) === 'kvi-chat-openers.json') {
      res.setHeader(
        'Cache-Control',
        process.env.NODE_ENV === 'production' ? 'public, max-age=300, stale-while-revalidate=3600' : 'no-store'
      );
    }
  },
}));

if (!fs.existsSync(CHAT_OPENERS_JSON)) {
  console.warn('[KVI] Missing chat openers JSON (chat widget falls back):', CHAT_OPENERS_JSON);
}
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
  maxAge: STATIC_MAX_AGE || undefined,
  etag: true,
}));

/* VIP hero video: public/media/vip-consult-hero.mp4 — use /public/media/... (NOT /media/...; many hosts map /media/* to S3). */

// Serve master report static files
app.get('/kvi-master-report.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'kvi-master-report.css'));
});

app.get('/kvi-master-report.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'kvi-master-report.js'));
});

const resolveViewPath = (reqPath, { ensureHtml = false } = {}) => {
  let normalized = decodeURIComponent(reqPath)
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (!normalized) {
    normalized = 'index';
  }

  if (ensureHtml && !normalized.endsWith('.html')) {
    normalized += '.html';
  }

  return normalized;
};

const originalFileLoader = ejs.fileLoader;
ejs.fileLoader = (filePath) => {
  const candidates = [];

  const addCandidate = (candidate) => {
    if (!candidates.includes(candidate)) {
      candidates.push(candidate);
    }
    if (!path.extname(candidate)) {
      const withExt = `${candidate}.ejs`;
      if (!candidates.includes(withExt)) {
        candidates.push(withExt);
      }
    }
  };

  const normalizedPath = path.normalize(filePath);

  addCandidate(filePath);
  addCandidate(path.join(__dirname, normalizedPath));

  const partialMarker = `${path.sep}partials${path.sep}`;
  const idx = normalizedPath.lastIndexOf(partialMarker);
  if (idx !== -1) {
    const partialPath = normalizedPath.slice(idx + 1); // remove leading separator
    addCandidate(partialPath);
    addCandidate(path.join(__dirname, partialPath));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return originalFileLoader(candidate);
    }
  }

  return originalFileLoader(filePath);
};

const renderView = (viewPath, res, next) => {
  res.render(viewPath, (err, html) => {
    if (err) {
      if (err.message && err.message.includes('Failed to lookup view')) {
        return next();
      }
      return next(err);
    }
    res.send(html);
  });
};

app.use('/api/vision-quest', visionQuestRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/seminar-rsvp', seminarRsvpRoutes);
app.use('/api/smile-landing-lead', smileLandingLeadRoutes);
app.use('/api/smile-book-consult', smileBookConsultRoutes);
app.use('/api/physician-referral', physicianReferralRoutes);
app.use('/api/book-consultation', bookConsultPortalRoutes);
app.use('/api/kvi-voice', kviVoiceWebRoutes);
app.use('/api/internal/growthops', internalGrowthopsBlogRoutes);
try {
  const { createInternalNurtureRouter } = require('./routes/internalNurtureAutoresponder');
  app.use('/api/internal/nurture-autoresponder', createInternalNurtureRouter());
} catch (nurtureRouteErr) {
  console.warn('[nurture-autoresponder] API route not loaded:', nurtureRouteErr.message || nurtureRouteErr);
}
app.use('/blog', blogRoutes);

// Physician portal → public/physician-portal (populate with npm run sync:physician-portal)
const PHYSICIAN_PORTAL_DIR = path.join(PUBLIC_DIR, 'physician-portal');
const PHYSICIAN_PORTAL_PREFIX = '/Doctorportal';
const PHYSICIAN_PORTAL_HUB_HTML = path.join(PHYSICIAN_PORTAL_DIR, 'for-physicians.html');
const PHYSICIAN_PORTAL_REFER_HTML = path.join(PHYSICIAN_PORTAL_DIR, 'refer-a-patient.html');
const PHYSICIAN_PORTAL_BOOK_HTML = path.join(PHYSICIAN_PORTAL_DIR, 'book-consultation.html');
const PHYSICIAN_PORTAL_DIRECTORY_HTML = path.join(PHYSICIAN_PORTAL_DIR, 'referral-directory.html');
/** True when referral partner hub/listing HTML exists (`referral-directory.html`). */
const PHYSICIAN_PORTAL_DIRECTORY_HTML_READY = fs.existsSync(PHYSICIAN_PORTAL_DIRECTORY_HTML);
const PHYSICIAN_PORTAL_READY =
  fs.existsSync(PHYSICIAN_PORTAL_HUB_HTML) && fs.existsSync(PHYSICIAN_PORTAL_REFER_HTML);

const referralOffices = loadReferralOfficesRegistry({ logger: console });

/** Prefer canonical MD vanity with -md/-do suffix when a legacy alias is used. */
function redirectToCanonicalBookingVanity(seg, res) {
  if (!referralOffices.hasBookingVanityKey(seg)) return false;
  const canon = referralOffices.resolveBookingVanityCanon(seg);
  const preferred = canon ? referralOffices.getBookingVanitySlug(canon) : null;
  const nk = normalizeSlugKey(seg);
  if (preferred && preferred !== nk) {
    res.redirect(301, `/${preferred}`);
    return true;
  }
  return false;
}

/**
 * Personalized referral worksheets — fetch one office JSON by URL key / marketing slug.
 * Does not ship the whole manifest to the browser.
 */
app.get('/api/referral-office/:key', (req, res) => {
  const raw = typeof req.params.key === 'string' ? req.params.key : '';
  const office = referralOffices.getOffice(raw);
  if (!office) {
    return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Unknown referral office key.' });
  }
  let rawBlockTrimmed = '';
  if (typeof office.rawBlock === 'string' && office.rawBlock.trim()) {
    rawBlockTrimmed = office.rawBlock.trim();
    if (rawBlockTrimmed.length > 2000) rawBlockTrimmed = rawBlockTrimmed.slice(0, 2000) + '…';
  }
  const safe = {
    ok: true,
    office: {
      slug: office.slug,
      matchedKey: office.resolvedFromKey,
      practiceName: office.practiceName || '',
      doctorName: office.doctorName || '',
      phone: office.phone || '',
      addressLine: office.addressLine || '',
      rawBlock: rawBlockTrimmed || undefined,
      npi: office.npi || '',
      email: office.email || '',
      fax: office.fax || '',
      credentials: office.credentials || '',
      addressStreet: office.addressStreet || '',
      city: office.city || '',
      stateOrZip: office.stateOrZip || '',
      practiceClinicKey: (() => {
        const ck = practiceNameToClinicKey(office.practiceName || '');
        if (!ck || !referralOffices.hasClinicKey(ck)) return undefined;
        return ck;
      })(),
    },
  };
  res.setHeader('Cache-Control', process.env.NODE_ENV === 'production' ? 'public, max-age=60, stale-while-revalidate=3600' : 'no-store');
  return res.json(safe);
});

/**
 * Clinic-hub worksheet personalization — grouped by normalized `practiceName` (single vanity per optometry clinic).
 */
app.get('/api/referral-clinic/:key', (req, res) => {
  const raw = typeof req.params.key === 'string' ? req.params.key : '';
  const clinic = referralOffices.getClinic(raw);
  if (!clinic) {
    return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Unknown referral clinic key.' });
  }

  /** @type {{ slug: string, doctorName: string, practiceName: string, phone: string, addressLine: string, credentials?: string }[]} */
  const physicians = clinic.physicians.map((p) => {
    let rb = '';
    if (typeof p.rawBlock === 'string' && p.rawBlock.trim()) {
      rb = p.rawBlock.trim();
      if (rb.length > 800) rb = rb.slice(0, 800) + '…';
    }
    return {
      slug: p.slug,
      doctorName: p.doctorName || '',
      practiceName: p.practiceName || '',
      phone: p.phone || '',
      addressLine: p.addressLine || '',
      rawBlock: rb || undefined,
      npi: p.npi || '',
      email: p.email || '',
      fax: p.fax || '',
      credentials: p.credentials || '',
      addressStreet: p.addressStreet || '',
      city: p.city || '',
      stateOrZip: p.stateOrZip || '',
    };
  });

  physicians.sort((a, b) =>
    String(a.doctorName || '').localeCompare(String(b.doctorName || ''), undefined, { sensitivity: 'base' })
  );

  const safe = {
    ok: true,
    clinic: {
      clinicKey: clinic.clinicKey,
      matchedKey: clinic.resolvedFromKey,
      practiceName: clinic.practiceName || '',
      physicians,
    },
  };
  res.setHeader('Cache-Control', process.env.NODE_ENV === 'production' ? 'public, max-age=60, stale-while-revalidate=3600' : 'no-store');
  return res.json(safe);
});

/**
 * Referral partner directory (+ optional search) — used by /Doctorportal/network/:hub and apex hub pages.
 */
app.get('/api/referral-directory/:hubKey', (req, res) => {
  const rawHub = typeof req.params.hubKey === 'string' ? req.params.hubKey.replace(/\.html$/i, '') : '';
  if (!referralOffices.hasDirectoryKey(rawHub)) {
    return res.status(404).json({ ok: false, code: 'HUB_UNKNOWN', message: 'Unknown referral directory hub.' });
  }

  return referralDirectoryRespond(req, res, rawHub);
});

function referralDirectoryRespond(req, res, rawHub) {
  const meta = referralOffices.getDirectoryMeta(rawHub);
  const hubNorm = meta?.hubNorm || normalizeSlugKey(rawHub);
  const q = String(req.query.q || '').trim();
  const limitRaw = Number(req.query.limit);
  const offsetRaw = Number(req.query.offset);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 500;
  const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;

  let offices = referralOffices.listDirectorySummaries({ hubNorm, q, offset, limit });

  const xfHostRaw = typeof req.get === 'function' ? req.get('host') : '';
  const xfHost = typeof xfHostRaw === 'string' ? xfHostRaw.trim() : '';
  const siteBase =
    xfHost && typeof req.protocol === 'string' && req.protocol
      ? `${req.protocol}://${xfHost}`
      : '';
  if (siteBase) {
    offices = offices.map((o) => ({
      ...o,
      referralAbsoluteUrl: `${siteBase}${o.referralRelativeUrl}`,
      bookingAbsoluteUrl: o.bookingRelativeUrl ? `${siteBase}${o.bookingRelativeUrl}` : undefined,
    }));
  }

  res.setHeader(
    'Cache-Control',
    process.env.NODE_ENV === 'production' ? 'public, max-age=120, stale-while-revalidate=3600' : 'no-store'
  );

  return res.json({
    ok: true,
    hub: meta
      ? { title: meta.title, subtitle: meta.subtitle, displaySlug: meta.displaySlug }
      : { title: rawHub, subtitle: '', displaySlug: rawHub },
    q,
    offices,
    limit,
    offset,
  });
}

/**
 * Explicit apex routes — registered **early** so `/HeritageFamily` cannot fall through blog/catch‑alls
 * on some stacks when the hub exists in manifest.
 */
function heritageFamilyDirectoryRespond(req, res, next) {
  if (!(PHYSICIAN_PORTAL_READY && PHYSICIAN_PORTAL_DIRECTORY_HTML_READY && referralOffices.hasDirectoryKey('HeritageFamily'))) {
    return next();
  }
  if (!fs.existsSync(PHYSICIAN_PORTAL_DIRECTORY_HTML)) return next();
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  return res.sendFile(PHYSICIAN_PORTAL_DIRECTORY_HTML);
}

app.get(['/HeritageFamily', '/HeritageFamily/', '/HeritageFamily.html'], heritageFamilyDirectoryRespond);

if (PHYSICIAN_PORTAL_READY) {
  /**
   * Public hub pages listing partners + worksheet deep links (/Doctorportal/network/:hub …).
   * Works even when apex /Hub is blocked by WP (prefer this path operationally).
   */
  if (PHYSICIAN_PORTAL_DIRECTORY_HTML_READY) {
    app.get(
      [
        `${PHYSICIAN_PORTAL_PREFIX}/network/:hubKey`,
        `${PHYSICIAN_PORTAL_PREFIX}/network/:hubKey/`,
        `${PHYSICIAN_PORTAL_PREFIX}/network/:hubKey.html`,
      ],
      (req, res, next) => {
        const raw = typeof req.params.hubKey === 'string' ? req.params.hubKey.replace(/\.html$/i, '') : '';
        if (!referralOffices.hasDirectoryKey(raw)) return next();
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
        return res.sendFile(PHYSICIAN_PORTAL_DIRECTORY_HTML);
      }
    );
  }

  /** MD partner booking — short vanity under /Doctorportal/book-consultation?ref=… → /doctor-city */
  app.get(
    [
      `${PHYSICIAN_PORTAL_PREFIX}/book-consultation`,
      `${PHYSICIAN_PORTAL_PREFIX}/book-consultation/`,
      `${PHYSICIAN_PORTAL_PREFIX}/book-consultation.html`,
    ],
    (req, res, next) => {
      const refRaw = typeof req.query.ref === 'string' ? req.query.ref.trim() : '';
      if (!refRaw) return next();
      const office = referralOffices.getOffice(refRaw);
      if (!office || typeof office.slug !== 'string') return next();
      const vanity = referralOffices.getBookingVanitySlug(office.slug);
      if (!vanity) return next();
      return res.redirect(301, `/${vanity}`);
    }
  );

  /**
   * Personalized worksheet under /Doctorportal/link/:key
   * Use when apex /Key returns WP 404 (nginx does not proxy bare single-segment paths to Node).
   */
  app.get(
    [
      `${PHYSICIAN_PORTAL_PREFIX}/link/:referralVanityKey`,
      `${PHYSICIAN_PORTAL_PREFIX}/link/:referralVanityKey/`,
      `${PHYSICIAN_PORTAL_PREFIX}/link/:referralVanityKey.html`,
    ],
    (req, res, next) => {
      const raw = typeof req.params.referralVanityKey === 'string' ? req.params.referralVanityKey : '';
      const seg = raw.replace(/\.html$/i, '');
      if (referralOffices.hasDirectoryKey(seg)) return next();
      if (referralOffices.hasBookingVanityKey(seg)) {
        if (redirectToCanonicalBookingVanity(seg, res)) return;
        if (!fs.existsSync(PHYSICIAN_PORTAL_BOOK_HTML)) return next();
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
        return res.sendFile(PHYSICIAN_PORTAL_BOOK_HTML);
      }
      if (referralOffices.hasClinicKey(seg) || referralOffices.hasOfficeKey(seg)) {
        if (!fs.existsSync(PHYSICIAN_PORTAL_REFER_HTML)) return next();
        return res.sendFile(PHYSICIAN_PORTAL_REFER_HTML);
      }
      return next();
    }
  );

  /** Static assets: /Doctorportal/for-physicians.html, physician-hub.css, … */
  app.use(
    PHYSICIAN_PORTAL_PREFIX,
    express.static(PHYSICIAN_PORTAL_DIR, {
      etag: true,
      maxAge: STATIC_MAX_AGE || undefined,
      extensions: ['html'],
      /** Auth JS/CSS carries apiBaseUrl; long cache hides deploys behind stale execute-api calls + CORS. */
      setHeaders(res, absPath) {
        const p = typeof absPath === 'string' ? absPath.replace(/\\/g, '/') : '';
        if (/\/auth\//i.test(p)) {
          res.setHeader(
            'Cache-Control',
            process.env.NODE_ENV === 'production' ? 'private, max-age=0, must-revalidate' : 'no-store'
          );
        }
      },
    })
  );

  /** Short hub URLs */
  app.get(['/Doctorportal', '/Doctorportal/'], (req, res) => {
    res.redirect(301, `${PHYSICIAN_PORTAL_PREFIX}/for-physicians.html`);
  });
  app.get(['/doctorportal', '/doctorportal/', '/DOCTORPORTAL', '/DOCTORPORTAL/'], (req, res) => {
    res.redirect(301, `${PHYSICIAN_PORTAL_PREFIX}/for-physicians.html`);
  });

  /** Referral worksheet short URL → same HTML as GH refer-a-patient */
  app.get(['/Referral', '/Referral/', '/referral', '/referral/'], (req, res, next) => {
    if (!fs.existsSync(PHYSICIAN_PORTAL_REFER_HTML)) {
      return next();
    }
    res.sendFile(PHYSICIAN_PORTAL_REFER_HTML);
  });

  /** Legacy paths from brochure / older links → /Doctorportal/… */
  app.use('/kvi-physician-portal', (req, res) => {
    const ou = typeof req.originalUrl === 'string' ? req.originalUrl.split('?', 1)[0] : '';
    const q = typeof req.originalUrl === 'string' && req.originalUrl.includes('?')
      ? '?' + (req.originalUrl.split('?', 2)[1] || '')
      : '';
    const stripped = ou.replace(/^\/kvi-physician-portal\/?/i, '/') || '/';
    const pathOnly = stripped === '' ? '/' : stripped.startsWith('/') ? stripped : '/' + stripped;
    const tail = pathOnly === '/' ? '/for-physicians.html' : pathOnly;
    res.redirect(301, `${PHYSICIAN_PORTAL_PREFIX}${tail}${q}`);
  });
} else {
  app.get(
    [
      '/Doctorportal',
      '/Doctorportal/',
      '/Referral',
      '/Referral/',
      '/doctorportal',
      '/doctorportal/',
      '/referral',
      '/referral/',
      '/DOCTORPORTAL',
      '/DOCTORPORTAL/',
      '/kvi-physician-portal',
      '/kvi-physician-portal/'
    ],
    (req, res) => {
      res
        .status(503)
        .type('html')
        .send(
          `<!DOCTYPE html><html lang="en"><meta charset="utf-8"/><title>Physician portal · setup</title><body style="font-family:system-ui;padding:24px;line-height:1.5;"><p>The physician portal static files are not installed.</p><p><strong>On the server</strong>, from the repo root run:</p><pre style="background:#f4f6f8;padding:12px;border-radius:8px;">npm run sync:physician-portal\npm restart kvi-home   # or: pm2 restart kvi-home</pre><p>Then deploy <code>public/physician-portal/</code> with those files.</p></body></html>`
        );
    }
  );
}

// SMILE landing pages
app.get(['/experience-crystal-clear-vision-with-smile', '/experience-crystal-clear-vision-with-smile/'], (req, res, next) => {
  renderView('experience-crystal-clear-vision-with-smile', res, next);
});

app.get(['/see-the-world-differently-with-smile', '/see-the-world-differently-with-smile/'], (req, res, next) => {
  renderView('see-the-world-differently-with-smile', res, next);
});

app.get(['/the-latest-fda-approved-vision-correction-smile', '/the-latest-fda-approved-vision-correction-smile/'], (req, res, next) => {
  renderView('the-latest-fda-approved-vision-correction-smile', res, next);
});

app.get(['/tired-of-glasses-contacts-discover-smile-with-khanna-vision-institute', '/tired-of-glasses-contacts-discover-smile-with-khanna-vision-institute/'], (req, res, next) => {
  renderView('tired-of-glasses-contacts-discover-smile-with-khanna-vision-institute', res, next);
});

app.get(['/gentle-blade-free-vision-correction', '/gentle-blade-free-vision-correction/'], (req, res, next) => {
  renderView('gentle-blade-free-vision-correction', res, next);
});

// ============================================
// SITEMAP ROUTES
// ============================================

/**
 * sitemap-index.xml — references static + blog sitemaps
 */
app.get('/sitemap-index.xml', (req, res) => {
  const base = `https://khannainstitute.com`;
  const today = new Date().toISOString().split('T')[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${base}/sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${base}/sitemap-blog-pages.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;
  res.set('Content-Type', 'application/xml').send(xml);
});

/**
 * sitemap.xml — all static / procedure / patient pages
 */
app.get('/sitemap.xml', (req, res) => {
  const base = 'https://khannainstitute.com';
  const today = new Date().toISOString().split('T')[0];

  // [url, priority, changefreq]
  const pages = [
    ['/', '1.0', 'weekly'],

    // Procedures – Laser Vision
    ['/procedures/laser-vision/smile-laser/', '0.9', 'monthly'],
    ['/procedures/laser-vision/lasik/', '0.9', 'monthly'],
    ['/procedures/laser-vision/superlasik/', '0.8', 'monthly'],
    ['/procedures/laser-vision/asa/', '0.8', 'monthly'],
    ['/procedures/laser-vision/compare/', '0.7', 'monthly'],
    ['/procedures/laser-vision/compare/pie-vs-evo-icl/', '0.7', 'monthly'],
    ['/procedures/laser-vision/compare/presbyopic-iol/', '0.7', 'monthly'],

    // Procedures – Lens Solutions
    ['/procedures/lens-solutions/evo-icl/', '0.9', 'monthly'],
    ['/procedures/lens-solutions/pie/', '0.9', 'monthly'],
    ['/procedures/lens-solutions/robotic-cataract-surgery/', '0.8', 'monthly'],
    ['/procedures/lens-solutions/which-lens-is-right/', '0.7', 'monthly'],

    // Procedures – Specialty Treatments
    ['/procedures/specialty-treatments/cxl-keratoconus/', '0.8', 'monthly'],
    ['/procedures/specialty-treatments/ctak-keratoconus/', '0.8', 'monthly'],
    ['/procedures/specialty-treatments/epioxa-westlake-village/', '0.8', 'monthly'],
    ['/procedures/specialty-treatments/epioxa-beverly-hills/', '0.8', 'monthly'],
    ['/procedures/specialty-treatments/pterygium-surgery/', '0.8', 'monthly'],
    ['/procedures/specialty-treatments/dry-eye-solutions/', '0.8', 'monthly'],
    ['/procedures/specialty-treatments/chalazion-treatment/', '0.7', 'monthly'],

    // Booking
    ['/book-consultation/', '0.9', 'weekly'],

    // Landing pages
    ['/smile-la-landing-page-2026', '0.85', 'weekly'],

    // Blog & education
    ['/blog/procedure-guides/', '0.8', 'weekly'],

    // About – Dr. Khanna
    ['/about/dr-khanna/biography/', '0.8', 'monthly'],
    ['/about/dr-khanna/credentials-awards/', '0.7', 'monthly'],
    ['/about/dr-khanna/books/', '0.7', 'monthly'],
    ['/about/dr-khanna/media/', '0.7', 'monthly'],

    // About – Why Choose Us
    ['/about/why-choose-us/technology/', '0.7', 'monthly'],
    ['/about/why-choose-us/success-stories/', '0.7', 'monthly'],
    ['/about/why-choose-us/celebrity-patients/', '0.7', 'monthly'],
    ['/about/why-choose-us/gallery/', '0.6', 'monthly'],

    // About – Locations
    ['/about/locations/beverly-hills/', '0.8', 'monthly'],
    ['/about/locations/westlake-village/', '0.8', 'monthly'],

    // Patients – Your Journey
    ['/patients/your-journey/first-visit-guide/', '0.7', 'monthly'],
    ['/patients/your-journey/what-to-expect/', '0.7', 'monthly'],
    ['/patients/your-journey/what-to-expect/lasik/', '0.7', 'monthly'],
    ['/patients/your-journey/what-to-expect/smile/', '0.7', 'monthly'],
    ['/patients/your-journey/what-to-expect/cataract/', '0.7', 'monthly'],
    ['/patients/your-journey/what-to-expect/cxl/', '0.7', 'monthly'],
    ['/patients/your-journey/what-to-expect/pterygium/', '0.7', 'monthly'],
    ['/patients/your-journey/recovery-timeline/', '0.7', 'monthly'],
    ['/patients/your-journey/post-op-care/', '0.7', 'monthly'],
    ['/patients/your-journey/recovery/lasik/', '0.7', 'monthly'],
    ['/patients/your-journey/recovery/smile/', '0.7', 'monthly'],
    ['/patients/your-journey/recovery/cataract/', '0.6', 'monthly'],
    ['/patients/your-journey/recovery/cxl/', '0.6', 'monthly'],
    ['/patients/your-journey/recovery/pterygium/', '0.6', 'monthly'],

    // Patients – Resources
    ['/patients/resources/faqs/', '0.7', 'monthly'],
    ['/patients/resources/faqs/smile/', '0.7', 'monthly'],
    ['/patients/resources/faqs/lasik/', '0.7', 'monthly'],
    ['/patients/resources/faqs/cxl/', '0.6', 'monthly'],
    ['/patients/resources/faqs/ctak/', '0.6', 'monthly'],
    ['/patients/resources/faqs/pterygium-surgery/', '0.6', 'monthly'],
    ['/patients/resources/faqs/robotic-laser-cataract/', '0.6', 'monthly'],
    ['/patients/resources/faqs/yag-vitreolysis/', '0.6', 'monthly'],
    ['/patients/resources/financing-options/', '0.7', 'monthly'],

    // Patients – Results
    ['/patients/results/reviews/', '0.7', 'monthly'],

    // Pricing & Financing
    ['/pricing-financing/procedure-costs/', '0.8', 'monthly'],
    ['/pricing-financing/calculator/', '0.7', 'monthly'],
    ['/pricing-financing/special-offers/', '0.7', 'monthly'],

    // Contact
    ['/contact/schedule-consultation/', '0.8', 'weekly'],
    ['/contact/virtual-consultation/', '0.7', 'monthly'],
    ['/contact/emergency-care/', '0.6', 'monthly'],

    // Legal
    ['/privacy/', '0.3', 'yearly'],
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  pages.forEach(([url, priority, changefreq]) => {
    xml += `  <url>\n`;
    xml += `    <loc>${base}${url}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${changefreq}</changefreq>\n`;
    xml += `    <priority>${priority}</priority>\n`;
    xml += `  </url>\n`;
  });
  xml += `</urlset>`;

  res.set('Content-Type', 'application/xml').send(xml);
});

/**
 * robots.txt
 */
app.get('/robots.txt', (req, res) => {
  const txt = `User-agent: *
Allow: /

Sitemap: https://khannainstitute.com/sitemap-index.xml
`;
  res.set('Content-Type', 'text/plain').send(txt);
});

/**
 * Generate sitemap-blog-pages.xml
 * Automatically fetches all blog posts from /blog/latest/ and generates XML sitemap
 * 
 * This sitemap is dynamically generated on each request, so:
 * - New blog posts added to Strapi or MongoDB will automatically appear
 * - No manual updates needed
 * - Always reflects the current state of all published blog posts
 * 
 * Blog URLs format: /YYYY/MM/slug (e.g., /2025/11/lasik-vs-smile)
 */
app.get('/sitemap-blog-pages.xml', async (req, res) => {
  try {
    // Fetch all blog posts (from both Strapi and MongoDB)
    // This automatically includes all published posts from both sources
    const blogs = await getAllBlogs();
    
    // Set XML content type
    res.set('Content-Type', 'application/xml');
    
    // Generate XML sitemap
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Base URL - always use https for production
    const host = req.get('host') || 'khannainstitute.com';
    const baseUrl = `https://${host}`;
    
    // Add each blog post to sitemap
    blogs.forEach(blog => {
      // Blog posts use format: /YYYY/MM/slug
      // The slug already contains the full path (year/month/slug) from transformStrapiBlog
      const blogUrl = blog.slug.startsWith('/') ? blog.slug : `/${blog.slug}`;
      const fullUrl = `${baseUrl}${blogUrl}`;
      
      // Get last modified date (use publishedAt or date field)
      const lastMod = blog.publishedAt || blog.date || new Date();
      const lastModDate = new Date(lastMod).toISOString().split('T')[0];
      
      // Determine priority (newer posts get higher priority)
      const postDate = new Date(lastMod);
      const daysSincePost = (Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24);
      let priority = '0.7'; // Default
      if (daysSincePost < 30) priority = '0.9'; // Recent posts
      else if (daysSincePost < 90) priority = '0.8'; // Recent-ish posts
      
      xml += '  <url>\n';
      xml += `    <loc>${fullUrl}</loc>\n`;
      xml += `    <lastmod>${lastModDate}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>${priority}</priority>\n`;
      xml += '  </url>\n';
    });
    
    xml += '</urlset>';
    
    res.send(xml);
  } catch (error) {
    console.error('Error generating blog sitemap:', error);
    res.status(500).set('Content-Type', 'application/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?>\n<error>Failed to generate sitemap</error>'
    );
  }
});

// ============================================
// TEST ROUTE - Strapi Page Testing
// ============================================
// This route lets you test Strapi pages without affecting production
app.get('/test/smile-laser/', async (req, res, next) => {
  try {
    const pageData = await getPageBySlug('test-smile-laser-eye-surgery');
    
    if (pageData) {
      console.log('✅ Loaded Strapi test page:', pageData.title);
      // Render with the actual SMILE template (with all the beautiful design)
      return res.render('procedures/laser-vision/smile-page-complete.html', { pageData });
    } else {
      return res.status(404).send('Test page not found in Strapi. Make sure the page with slug "test-smile-laser-eye-surgery" is published.');
    }
  } catch (error) {
    console.error('Error loading test page:', error);
    return res.status(500).send('Error loading test page: ' + error.message);
  }
});

// ============================================
// CRON JOB SYSTEM
// ============================================

// Import extended cron jobs (will be available once file is copied to jobs/ directory)
let extendedCronJobs = null;
try {
  extendedCronJobs = require('./jobs/kvi-cron-system-extended');
} catch (error) {
  console.log('Extended cron jobs not loaded. Copy kvi-cron-system-extended.js to jobs/ directory when disk space is available.');
}

// Store job results (keep last 50 results per job type)
const jobResults = {
  backups: [],
  fourOhFour: [],
  phoneValidation: [],
  sslCheck: [],
  formTesting: [],
  schemaValidation: [],
  internalLinking: [],
  internalLinks: [], // Alias for master report
  externalLinks: [],
  brokenLinks: [],
  contentValidation: [],
  coreWebVitals: [],
  // Additional SEO jobs for master report
  ogTagsValidation: [],
  metaTagsValidation: [],
  imageAltValidation: [],
  canonicalValidation: [],
  robotsTagValidation: [],
  sitemapValidation: [],
  structuredDataValidation: [],
  hreflangValidation: [],
  pagespeedValidation: []
};

// Helper function to send alerts (can be extended with email/SMS/Slack)
async function sendAlert(type, message) {
  console.log(`[ALERT] ${type}: ${message}`);
  // TODO: Add email/SMS/Slack notifications here
}

// Schedule extended cron jobs if available
if (extendedCronJobs) {
  // SSL check daily at 2am
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Running SSL certificate check...');
    try {
      const result = await extendedCronJobs.checkSSLCertificate();
      jobResults.sslCheck.unshift(result);
      if (jobResults.sslCheck.length > 50) jobResults.sslCheck.pop();
      
      if (result.warnings && result.warnings.length > 0) {
        await sendAlert('SSL EXPIRY WARNING', `Certificate expiring soon! ${result.warnings.length} warning(s)`);
      }
    } catch (error) {
      console.error('[CRON] SSL check error:', error.message);
    }
  });

  // Form testing every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    console.log('[CRON] Running form submission tests...');
    try {
      const result = await extendedCronJobs.testFormSubmissions();
      jobResults.formTesting.unshift(result);
      if (jobResults.formTesting.length > 50) jobResults.formTesting.pop();
      
      const failed = result.forms?.filter(f => f.submissionStatus === 'failed' || f.submissionStatus === 'error') || [];
      if (failed.length > 0) {
        await sendAlert('FORM FAILURE', `${failed.length} form(s) not working!`);
      }
    } catch (error) {
      console.error('[CRON] Form testing error:', error.message);
    }
  });

  // Schema validation daily at 3am
  cron.schedule('0 3 * * *', async () => {
    console.log('[CRON] Running schema markup validation...');
    try {
      const result = await extendedCronJobs.validateSchemaMarkup();
      jobResults.schemaValidation.unshift(result);
      if (jobResults.schemaValidation.length > 50) jobResults.schemaValidation.pop();
      
      const complianceRate = parseFloat(result.stats?.complianceRate?.replace('%', '') || '0');
      if (complianceRate < 80) {
        await sendAlert('SCHEMA ISSUES', `Only ${result.stats.complianceRate} compliance!`);
      }
    } catch (error) {
      console.error('[CRON] Schema validation error:', error.message);
    }
  });

  // Internal linking check weekly on Sundays at 4am
  cron.schedule('0 4 * * 0', async () => {
    console.log('[CRON] Running internal linking check...');
    try {
      const result = await extendedCronJobs.checkInternalLinking();
      jobResults.internalLinking.unshift(result);
      if (jobResults.internalLinking.length > 50) jobResults.internalLinking.pop();
    } catch (error) {
      console.error('[CRON] Internal linking check error:', error.message);
    }
  });

  // Content validation weekly on Mondays at 5am
  cron.schedule('0 5 * * 1', async () => {
    console.log('[CRON] Running content validation...');
    try {
      const result = await extendedCronJobs.validateContent();
      jobResults.contentValidation.unshift(result);
      if (jobResults.contentValidation.length > 50) jobResults.contentValidation.pop();
    } catch (error) {
      console.error('[CRON] Content validation error:', error.message);
    }
  });

  // Core Web Vitals daily at 6am
  cron.schedule('0 6 * * *', async () => {
    console.log('[CRON] Running Core Web Vitals check...');
    try {
      const result = await extendedCronJobs.checkCoreWebVitals();
      jobResults.coreWebVitals.unshift(result);
      if (jobResults.coreWebVitals.length > 50) jobResults.coreWebVitals.pop();
    } catch (error) {
      console.error('[CRON] Core Web Vitals check error:', error.message);
    }
  });

  console.log('[CRON] Extended cron jobs scheduled successfully');
  
  // Add sample data for testing (only if no real data exists)
  if (jobResults.schemaValidation.length === 0) {
    console.log('[TEST] Adding sample data for master report testing...');
    addSampleJobData();
  }
} else {
  console.log('[CRON] Extended cron jobs not available. To enable:');
  console.log('  1. Free up disk space');
  console.log('  2. Copy kvi-cron-system-extended.js from Downloads/files (9)/ to jobs/ directory');
  console.log('  3. Restart the server');
  
  // Add sample data even if extended jobs aren't loaded
  addSampleJobData();
}

// Function to add sample data for testing
function addSampleJobData() {
  const now = new Date().toISOString();
  
  // Sample schema validation data
  if (jobResults.schemaValidation.length === 0) {
    jobResults.schemaValidation.push({
      status: 'completed',
      timestamp: now,
      duration: 45000,
      stats: {
        pagesValidated: 547,
        complianceRate: '68.4',
        missing: 173
      },
      errors: [
        { url: '/pie-surgery-beverly-hills', missingSchemas: ['MedicalProcedure', 'Organization'] },
        { url: '/smile-laser-los-angeles', missingSchemas: ['MedicalProcedure', 'LocalBusiness'] }
      ]
    });
  }
  
  // Sample 404 data
  if (jobResults.fourOhFour.length === 0) {
    jobResults.fourOhFour.push({
      status: 'completed',
      timestamp: now,
      duration: 120000,
      stats: {
        totalPages: 547,
        notFound: 45,
        errorRate: '8.2'
      },
      errors: [
        { url: '/pie-surgery-malibu-2', status: 404 },
        { url: '/smile-laser-beverly-hills-old', status: 404 }
      ]
    });
  }
  
  // Sample internal links data
  if (jobResults.internalLinking.length === 0) {
    jobResults.internalLinking.push({
      status: 'completed',
      timestamp: now,
      duration: 89000,
      stats: {
        pagesAnalyzed: 547,
        totalInternalLinks: 8234,
        averageLinksPerPage: 15.1,
        averagePerPage: 15.1,
        orphanPages: 7
      }
    });
  }
  
  // Sample content validation data
  if (jobResults.contentValidation.length === 0) {
    jobResults.contentValidation.push({
      status: 'completed',
      timestamp: now,
      duration: 156000,
      stats: {
        totalPages: 547,
        thinContent: 45,
        averageWordCount: 1823,
        duplicateContent: 15
      }
    });
  }
  
  // Sample core web vitals data
  if (jobResults.coreWebVitals.length === 0) {
    jobResults.coreWebVitals.push({
      status: 'completed',
      timestamp: now,
      duration: 234000,
      stats: {
        avgLCP: 2100,
        avgFID: 75,
        avgCLS: 0.08,
        avgScore: 88
      }
    });
  }
  
  // Sample SSL check data
  if (jobResults.sslCheck.length === 0) {
    jobResults.sslCheck.push({
      status: 'completed',
      timestamp: now,
      duration: 5000,
      stats: {
        daysLeft: 287,
        valid: true
      }
    });
  }
  
  // Sample form testing data
  if (jobResults.formTesting.length === 0) {
    jobResults.formTesting.push({
      status: 'completed',
      timestamp: now,
      duration: 30000,
      stats: {
        totalForms: 12,
        workingForms: 12,
        failedForms: 0
      },
      forms: [
        { name: 'Booking Form', submissionStatus: 'success' },
        { name: 'Contact Form', submissionStatus: 'success' }
      ]
    });
  }
  
  // Sample OG tags validation (mock data)
  if (jobResults.ogTagsValidation.length === 0) {
    jobResults.ogTagsValidation.push({
      status: 'completed',
      timestamp: now,
      duration: 67000,
      stats: {
        totalPages: 547,
        missingOG: 85,
        complianceRate: '84.5'
      },
      pages: [
        { url: '/blog/eye-health-tips', hasOGTags: false, missingTags: ['og:image', 'og:description'] }
      ]
    });
  }
  
  // Sample meta tags validation (mock data)
  if (jobResults.metaTagsValidation.length === 0) {
    jobResults.metaTagsValidation.push({
      status: 'completed',
      timestamp: now,
      duration: 45000,
      stats: {
        totalPages: 547,
        missingTitle: 0,
        missingDescription: 86,
        duplicateTitles: 12,
        duplicateDescriptions: 28
      }
    });
  }
  
  // Sample image alt validation (mock data)
  if (jobResults.imageAltValidation.length === 0) {
    jobResults.imageAltValidation.push({
      status: 'completed',
      timestamp: now,
      duration: 123000,
      stats: {
        totalImages: 2847,
        missingAlt: 312,
        complianceRate: '89.0'
      },
      images: [
        { pageUrl: '/gallery', src: '/images/gallery-1.jpg', hasAlt: false }
      ]
    });
  }
  
  // Sample canonical validation (mock data)
  if (jobResults.canonicalValidation.length === 0) {
    jobResults.canonicalValidation.push({
      status: 'completed',
      timestamp: now,
      duration: 34000,
      stats: {
        totalPages: 547,
        missingCanonical: 45,
        incorrectCanonical: 8,
        complianceRate: '91.8'
      }
    });
  }
  
  // Sample robots tag validation (mock data)
  if (jobResults.robotsTagValidation.length === 0) {
    jobResults.robotsTagValidation.push({
      status: 'completed',
      timestamp: now,
      duration: 28000,
      stats: {
        totalPages: 547,
        noindexPages: 12,
        nofollowPages: 3,
        blockedPages: 0
      }
    });
  }
  
  // Sample external links (mock data)
  if (jobResults.externalLinks.length === 0) {
    jobResults.externalLinks.push({
      status: 'completed',
      timestamp: now,
      duration: 89000,
      stats: {
        pagesAnalyzed: 547,
        totalExternalLinks: 423,
        brokenExternalLinks: 8,
        nofollowLinks: 156
      }
    });
  }
  
  console.log('[TEST] Sample data added for testing');
}

// API endpoints for React Dashboard compatibility
app.get('/api/status', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    jobs: {
      backups: jobResults.backups?.[0] || null,
      fourOhFour: jobResults.fourOhFour?.[0] || null,
      phoneValidation: jobResults.phoneValidation?.[0] || null,
      sslCheck: jobResults.sslCheck?.[0] || null,
      formTesting: jobResults.formTesting?.[0] || null,
      schemaValidation: jobResults.schemaValidation?.[0] || null,
      internalLinking: jobResults.internalLinking?.[0] || null,
      contentValidation: jobResults.contentValidation?.[0] || null,
      coreWebVitals: jobResults.coreWebVitals?.[0] || null
    }
  });
});

app.get('/api/jobs/:jobType', (req, res) => {
  const { jobType } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  
  // Map job type names (support both internalLinking and internalLinks)
  const jobTypeMap = {
    'backups': 'backups',
    'fourOhFour': 'fourOhFour',
    'phoneValidation': 'phoneValidation',
    'sslCheck': 'sslCheck',
    'formTesting': 'formTesting',
    'schemaValidation': 'schemaValidation',
    'internalLinking': 'internalLinking',
    'internalLinks': 'internalLinking', // Map to internalLinking for compatibility
    'externalLinks': 'externalLinks',
    'brokenLinks': 'brokenLinks',
    'contentValidation': 'contentValidation',
    'coreWebVitals': 'coreWebVitals',
    'ogTagsValidation': 'ogTagsValidation',
    'metaTagsValidation': 'metaTagsValidation',
    'imageAltValidation': 'imageAltValidation',
    'canonicalValidation': 'canonicalValidation',
    'robotsTagValidation': 'robotsTagValidation',
    'sitemapValidation': 'sitemapValidation',
    'structuredDataValidation': 'structuredDataValidation',
    'hreflangValidation': 'hreflangValidation',
    'pagespeedValidation': 'pagespeedValidation'
  };
  
  const mappedType = jobTypeMap[jobType] || jobType;
  
  if (jobResults[mappedType]) {
    // If mapping to internalLinking but master report expects internalLinks format
    let results = jobResults[mappedType].slice(0, limit);
    if (jobType === 'internalLinks' && mappedType === 'internalLinking') {
      // Transform internalLinking data to internalLinks format if needed
      results = results.map(r => ({
        ...r,
        stats: {
          ...r.stats,
          pagesAnalyzed: r.stats?.pagesAnalyzed || r.stats?.totalPages || 0,
          averageLinksPerPage: r.stats?.averageLinksPerPage || r.stats?.averagePerPage || 0
        }
      }));
    }
    res.json(results);
  } else {
    // Return empty result for jobs that don't exist yet (master report will handle gracefully)
    res.json([]);
  }
});

// API endpoint to view cron job results
app.get('/api/cron/results', (req, res) => {
  res.json({
    success: true,
    jobs: {
      sslCheck: jobResults.sslCheck.slice(0, 10),
      formTesting: jobResults.formTesting.slice(0, 10),
      schemaValidation: jobResults.schemaValidation.slice(0, 10),
      internalLinking: jobResults.internalLinking.slice(0, 10),
      contentValidation: jobResults.contentValidation.slice(0, 10),
      coreWebVitals: jobResults.coreWebVitals.slice(0, 10)
    },
    extendedJobsAvailable: extendedCronJobs !== null
  });
});

// API endpoint to manually trigger a cron job (for testing)
app.post('/api/cron/trigger/:jobName', async (req, res) => {
  if (!extendedCronJobs) {
    return res.status(503).json({
      success: false,
      message: 'Extended cron jobs not available. Copy kvi-cron-system-extended.js to jobs/ directory.'
    });
  }

  const { jobName } = req.params;
  const jobMap = {
    'ssl': extendedCronJobs.checkSSLCertificate,
    'forms': extendedCronJobs.testFormSubmissions,
    'schema': extendedCronJobs.validateSchemaMarkup,
    'links': extendedCronJobs.checkInternalLinking,
    'content': extendedCronJobs.validateContent,
    'vitals': extendedCronJobs.checkCoreWebVitals
  };

  const job = jobMap[jobName];
  if (!job) {
    return res.status(400).json({
      success: false,
      message: `Unknown job: ${jobName}. Available: ${Object.keys(jobMap).join(', ')}`
    });
  }

  try {
    const result = await job();
    const resultKey = {
      'ssl': 'sslCheck',
      'forms': 'formTesting',
      'schema': 'schemaValidation',
      'links': 'internalLinking',
      'content': 'contentValidation',
      'vitals': 'coreWebVitals'
    }[jobName];

    jobResults[resultKey].unshift(result);
    if (jobResults[resultKey].length > 50) jobResults[resultKey].pop();

    res.json({
      success: true,
      job: jobName,
      result: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Endpoint to manually trigger jobs for testing
app.post('/api/jobs/:jobType/run', async (req, res) => {
  const { jobType } = req.params;
  
  try {
    // Map job types to their execution functions
    const jobMap = {
      'schemaValidation': extendedCronJobs ? () => extendedCronJobs.validateSchemaMarkup() : null,
      'sslCheck': extendedCronJobs ? () => extendedCronJobs.checkSSLCertificate() : null,
      'formTesting': extendedCronJobs ? () => extendedCronJobs.testFormSubmissions() : null,
      'internalLinks': extendedCronJobs ? () => extendedCronJobs.checkInternalLinking() : null,
      'internalLinking': extendedCronJobs ? () => extendedCronJobs.checkInternalLinking() : null,
      'contentValidation': extendedCronJobs ? () => extendedCronJobs.validateContent() : null,
      'coreWebVitals': extendedCronJobs ? () => extendedCronJobs.checkCoreWebVitals() : null
    };
    
    const job = jobMap[jobType];
    if (!job) {
      return res.status(404).json({ 
        error: 'Job type not found or not implemented',
        availableJobs: Object.keys(jobMap).filter(k => jobMap[k] !== null)
      });
    }
    
    if (!extendedCronJobs) {
      return res.status(503).json({ 
        error: 'Extended cron jobs not available',
        message: 'The kvi-cron-system-extended.js file is not loaded'
      });
    }
    
    const result = await job();
    
    // Store result in appropriate array
    const resultKeyMap = {
      'schemaValidation': 'schemaValidation',
      'sslCheck': 'sslCheck',
      'formTesting': 'formTesting',
      'internalLinks': 'internalLinking',
      'internalLinking': 'internalLinking',
      'contentValidation': 'contentValidation',
      'coreWebVitals': 'coreWebVitals'
    };
    
    const resultKey = resultKeyMap[jobType];
    if (resultKey && jobResults[resultKey]) {
      jobResults[resultKey].unshift(result);
      if (jobResults[resultKey].length > 50) jobResults[resultKey].pop();
    }
    
    res.json({
      success: true,
      job: jobType,
      result: result,
      message: 'Job executed successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      message: 'Job execution failed'
    });
  }
});

// Manual trigger endpoints for React Dashboard
app.post('/api/trigger/:jobType', async (req, res) => {
  const { jobType } = req.params;
  
  if (!extendedCronJobs) {
    return res.status(503).json({ error: 'Extended cron jobs not available' });
  }
  
  try {
    let result;
    const jobMap = {
      'backup': () => Promise.resolve({ status: 'not_implemented', message: 'Backup job not implemented in extended cron system' }),
      'fourOhFour': () => Promise.resolve({ status: 'not_implemented', message: '404 check not implemented in extended cron system' }),
      'phoneValidation': () => Promise.resolve({ status: 'not_implemented', message: 'Phone validation not implemented in extended cron system' }),
      'ssl': () => extendedCronJobs.checkSSLCertificate(),
      'forms': () => extendedCronJobs.testFormSubmissions(),
      'schema': () => extendedCronJobs.validateSchemaMarkup(),
      'links': () => extendedCronJobs.checkInternalLinking(),
      'content': () => extendedCronJobs.validateContent(),
      'vitals': () => extendedCronJobs.checkCoreWebVitals()
    };
    
    const job = jobMap[jobType];
    if (!job) {
      return res.status(404).json({ error: 'Invalid job type' });
    }
    
    result = await job();
    
    // Store result in appropriate array
    const resultKeyMap = {
      'ssl': 'sslCheck',
      'forms': 'formTesting',
      'schema': 'schemaValidation',
      'links': 'internalLinking',
      'content': 'contentValidation',
      'vitals': 'coreWebVitals'
    };
    
    const resultKey = resultKeyMap[jobType];
    if (resultKey && jobResults[resultKey]) {
      jobResults[resultKey].unshift(result);
      if (jobResults[resultKey].length > 50) jobResults[resultKey].pop();
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route mapping for clean URLs
const routeMap = {
  // HOME
  '/': 'index.html',
  
  // CRON DASHBOARD
  '/cron-dashboard': 'cron-dashboard.html',
  
  // MASTER SEO REPORT
  '/master-report': 'kvi-master-report.html',
  '/master.html': 'kvi-master-report.html',
  
  // PROCEDURES - Laser Vision
  '/procedures/laser-vision/smile-laser/': 'procedures/laser-vision/smile-page-complete.html',
  '/procedures/laser-vision/lasik/': 'procedures/laser-vision/lasik-page-complete.html',
  '/procedures/laser-vision/superlasik/': 'procedures/laser-vision/superlasik-no-cut-page.html',
  '/procedures/laser-vision/asa/': 'procedures/laser-vision/asa_procedure_page_gen_z.html',
  '/procedures/laser-vision/compare/': 'procedures/laser-vision/compare.html',
  '/procedures/laser-vision/compare/pie-vs-evo-icl/': 'procedures/laser-vision/compare/pie-vs-evo-icl.html',
  '/procedures/laser-vision/compare/presbyopic-iol/': 'procedures/laser-vision/compare/presbyopic-iol.html',
  
  // PROCEDURES - Lens Solutions
  '/procedures/lens-solutions/evo-icl/': 'procedures/lens-solutions/evo-icl-service-page.html',
  '/procedures/lens-solutions/pie/': 'procedures/lens-solutions/pie-rle-service-page.html',
  '/procedures/lens-solutions/robotic-cataract-surgery/': 'procedures/lens-solutions/lensar-Robotic-Laser-cataract-surgery-page.html',
  '/procedures/lens-solutions/which-lens-is-right/': 'procedures/lens-solutions/which-lens-is-right.html',
  
  // PROCEDURES - Specialty Treatments
  '/procedures/specialty-treatments/cxl-keratoconus/': 'procedures/specialty-treatments/cxl-keratoconus-page.html',
  '/procedures/specialty-treatments/ctak-keratoconus/': 'procedures/specialty-treatments/ctak-keratoconus-page.html',
  '/procedures/specialty-treatments/epioxa-westlake-village/': 'procedures/specialty-treatments/epioxa-westlake-village.html',
  '/procedures/specialty-treatments/epioxa-beverly-hills/': 'procedures/specialty-treatments/epioxa-beverly-hills.html',
  '/procedures/specialty-treatments/pterygium-surgery/': 'procedures/specialty-treatments/Cosmetic Pterygium Surgery Restore Your Bright, Clear, Healthy-Looking Eyes.html',
  '/procedures/specialty-treatments/dry-eye-solutions/': 'procedures/specialty-treatments/hello-dry-eye-treatment.html',
  '/procedures/specialty-treatments/chalazion-treatment/': 'procedures/specialty-treatments/Advanced Chalazion Treatment.html',
  
  // TOOLS
  '/tools/am-i-a-candidate/': 'critical-page-quiz.html',
  '/tools/procedure-comparison/': 'procedures/laser-vision/compare.html',
  
  // BOOKING
  '/book-consultation/': 'khanna-booking.html',

  // SEMINAR RSVP
  '/seminar-rsvp/': 'seminar-rsvp.html',
  
  // ABOUT - Dr. Khanna
  '/about/dr-khanna/biography/': 'about/dr-khanna/biography.html',
  '/about/dr-khanna/credentials-awards/': 'about/dr-khanna/credentials-awards.html',
  '/about/dr-khanna/books/': 'about/dr-khanna/books.html',
  '/about/dr-khanna/media/': 'about/dr-khanna/media.html',
  
  // ABOUT - Why Choose Us
  '/about/why-choose-us/technology/': 'about/why-choose-us/Our technology.html',
  '/about/why-choose-us/success-stories/': 'about/why-choose-us/success-stories.html',
  '/about/why-choose-us/celebrity-patients/': 'about/why-choose-us/celebrity-patients.html',
  '/about/why-choose-us/gallery/': 'about/why-choose-us/gallery.html',
  
  // ABOUT - Locations
  '/about/locations/beverly-hills/': 'about/locations/beverly-hills-location.html',
  '/about/locations/westlake-village/': 'about/locations/westlake-village-location.html',
  
  // PATIENTS - Your Journey
  '/patients/your-journey/first-visit-guide/': 'patients/your-journey/first-visit-guide.html',
  '/patients/your-journey/what-to-expect/': 'patients/your-journey/what-to-expect.html',
  '/patients/your-journey/what-to-expect/lasik/': 'patients/your-journey/what-to-expect/lasik.html',
  '/patients/your-journey/what-to-expect/smile/': 'patients/your-journey/what-to-expect/smile.html',
  '/patients/your-journey/what-to-expect/cataract/': 'patients/your-journey/what-to-expect/cataract.html',
  '/patients/your-journey/what-to-expect/cxl/': 'patients/your-journey/what-to-expect/cxl.html',
  '/patients/your-journey/what-to-expect/pterygium/': 'patients/your-journey/what-to-expect/pterygium.html',
  '/patients/your-journey/recovery-timeline/': 'patients/your-journey/recovery-timeline.html',
  '/patients/your-journey/post-op-care/': 'patients/your-journey/post-op-care.html',
  '/patients/your-journey/recovery/lasik/': 'patients/your-journey/recovery/lasik.html',
  '/patients/your-journey/recovery/smile/': 'patients/your-journey/recovery/smile.html',
  '/patients/your-journey/recovery/cataract/': 'patients/your-journey/recovery/cataract.html',
  '/patients/your-journey/recovery/cxl/': 'patients/your-journey/recovery/cxl.html',
  '/patients/your-journey/recovery/pterygium/': 'patients/your-journey/recovery/pterygium.html',
  
  // PATIENTS - Resources
  '/patients/resources/faqs/': 'patients/resources/faqs/index.html',
  '/patients/resources/faqs/smile/': 'patients/resources/faqs/smile.html',
  '/patients/resources/faqs/lasik/': 'patients/resources/faqs/lasik.html',
  '/patients/resources/faqs/cxl/': 'patients/resources/faqs/cxl.html',
  '/patients/resources/faqs/ctak/': 'patients/resources/faqs/ctak.html',
  '/patients/resources/faqs/pterygium-surgery/': 'patients/resources/faqs/pterygium-surgery.html',
  '/patients/resources/faqs/robotic-laser-cataract/': 'patients/resources/faqs/robotic-laser-cataract.html',
  '/patients/resources/faqs/yag-vitreolysis/': 'patients/resources/faqs/yag-vitreolysis.html',
  '/patients/resources/financing-options/': 'patients/resources/All You Ever wanted to Know About financing.html',
  '/patients/resources/insurance-info/': 'patients/resources/insurance-info.html',
  
  // PATIENTS - Results
  '/patients/results/reviews/': 'patients/results/reviews.html',
  
  // PRICING & FINANCING
  '/pricing-financing/procedure-costs/': 'pricing-financing/procedure-costs.html',
  '/pricing-financing/insurance-coverage/': 'pricing-financing/insurance-coverage.html',
  '/pricing-financing/calculator/': 'financing-calculator-page.html',
  '/pricing-financing/special-offers/': 'pricing-financing/special-offers.html',
  
  // BLOGS - handled by blog router
  '/blog/procedure-guides/': 'blog/procedure-guides.html',
  
  // CONTACT
  '/contact/schedule-consultation/': 'khanna-booking.html',
  '/contact/virtual-consultation/': 'contact/Virtual  IRl Consult.html',
  '/contact/forms/': 'khanna-booking.html', // Display booking form but keep URL as /contact/forms/
  '/contact/emergency-care/': 'contact/Emergence Care after eye surgery.html',
  
  // Landing pages (trailing slash → also registers /smile-la-landing-page-2026 without slash)
  '/smile-cost/': 'smile-cost.html',
  '/smile-book-consultation/': 'smile-book-consultation.html',
  '/smile-book-consultation-thank-you/': 'smile-book-consultation-thank-you.html',
  '/smile-la-landing-page-2026/': 'smile-la-landing-page-2026.html',
  '/VIP-Consult/': 'vip-consult.html',
  '/VIP-Consult/thank-you/': 'vip-consult-thank-you.html',
  '/vip-consult/': 'vip-consult.html',

  // Legal
  '/privacy/': 'privacy.html',

  // Legacy routes (keep for backward compatibility)
  '/khanna-gamified-forms': 'khanna-gamified-forms.html',
  '/schedule-consultation': 'khanna-booking.html',
  '/khanna-booking': 'khanna-booking.html',
  '/booking-success': 'booking-success.html',
};

// Strapi page slugs mapping (URL path -> Strapi slug)
// Add pages here as you migrate them to Strapi
const strapiPageSlugs = {
  // Test URL - won't affect production page
  '/test/smile-laser/': 'test-smile-laser-eye-surgery',
  
  // Production URLs - NOW LIVE with Strapi! (First 6)
  '/procedures/laser-vision/smile-laser/': 'test-smile-laser-eye-surgery',
  // '/procedures/laser-vision/lasik/': 'lasik-eye-surgery', // body: partials/lasik-page-content.ejs (not Strapi)
  // '/procedures/lens-solutions/evo-icl/': 'evo-icl-surgery', // body: partials/evo-icl-page-content.ejs (not Strapi)
  '/procedures/lens-solutions/robotic-cataract-surgery/': 'robotic-cataract-surgery',
  '/procedures/laser-vision/superlasik/': 'superlasik-surgery',
  '/procedures/lens-solutions/pie/': 'pie-rle-surgery',
  
  // Additional Procedure Pages (Batch 2 - 10 more pages)
  '/procedures/laser-vision/asa/': 'asa-procedure',
  '/procedures/laser-vision/compare/': 'procedure-comparison',
  '/procedures/laser-vision/compare/pie-vs-evo-icl/': 'pie-vs-evo-icl-comparison',
  '/procedures/laser-vision/compare/presbyopic-iol/': 'presbyopic-iol-comparison',
  '/procedures/lens-solutions/which-lens-is-right/': 'which-lens-is-right',
  '/procedures/specialty-treatments/cxl-keratoconus/': 'cxl-keratoconus-treatment',
  // '/procedures/specialty-treatments/ctak-keratoconus/': 'ctak-keratoconus-treatment', // body: partials/ctak-keratoconus-page-content.ejs (not Strapi)
  // '/procedures/specialty-treatments/pterygium-surgery/': 'pterygium-surgery', // body: partials/pterygium-surgery-page-content.ejs (not Strapi)
  '/procedures/specialty-treatments/dry-eye-solutions/': 'dry-eye-solutions',
  '/procedures/specialty-treatments/chalazion-treatment/': 'chalazion-treatment',
  
  // About Pages (7 pages)
  '/about/dr-khanna/biography/': 'dr-khanna-biography',
  '/about/dr-khanna/credentials-awards/': 'dr-khanna-credentials-awards',
  '/about/dr-khanna/books/': 'dr-khanna-books',
  '/about/dr-khanna/media/': 'dr-khanna-media',
  '/about/why-choose-us/technology/': 'our-technology',
  '/about/locations/beverly-hills/': 'beverly-hills-location',
  '/about/locations/westlake-village/': 'westlake-village-location',
  
  // Patient Resource Pages (19 pages)
  '/patients/your-journey/what-to-expect/': 'what-to-expect',
  '/patients/your-journey/recovery-timeline/': 'recovery-timeline',
  '/patients/your-journey/post-op-care/': 'post-op-care',
  '/patients/your-journey/what-to-expect/lasik/': 'what-to-expect-lasik',
  '/patients/your-journey/what-to-expect/smile/': 'what-to-expect-smile',
  '/patients/your-journey/what-to-expect/cataract/': 'what-to-expect-cataract',
  '/patients/your-journey/what-to-expect/cxl/': 'what-to-expect-cxl',
  '/patients/your-journey/what-to-expect/pterygium/': 'what-to-expect-pterygium',
  '/patients/your-journey/recovery/lasik/': 'recovery-lasik',
  '/patients/your-journey/recovery/smile/': 'recovery-smile',
  '/patients/your-journey/recovery/cataract/': 'recovery-cataract',
  '/patients/your-journey/recovery/cxl/': 'recovery-cxl',
  '/patients/your-journey/recovery/pterygium/': 'recovery-pterygium',
  '/patients/resources/faqs/': 'faqs-main',
  '/patients/resources/faqs/smile/': 'faqs-smile',
  '/patients/resources/faqs/lasik/': 'faqs-lasik',
  '/patients/resources/faqs/cxl/': 'faqs-cxl',
  '/patients/resources/faqs/ctak/': 'faqs-ctak',
  '/patients/resources/faqs/pterygium-surgery/': 'faqs-pterygium',
  '/patients/resources/faqs/robotic-laser-cataract/': 'faqs-robotic-cataract',
  '/patients/resources/faqs/yag-vitreolysis/': 'faqs-yag-vitreolysis',
  // '/patients/resources/financing-options/': 'financing-options', // static: patients/resources/All You Ever wanted to Know About financing.html

  // Pricing & Financing
  // '/pricing-financing/procedure-costs/': 'procedure-costs', // body: partials/procedure-costs-page-content.ejs (not Strapi)
  '/pricing-financing/calculator/': 'financing-calculator',

  // Contact Pages
  '/contact/schedule-consultation/': 'contact-booking',
  '/contact/forms/': 'contact-booking',
  '/contact/virtual-consultation/': 'virtual-consultation',
  '/contact/emergency-care/': 'emergency-care',
};

// Permanent redirects — registered before routeMap so they override static/Strapi routes
const permanentRedirects = {
  '/patients/resources/insurance-info/': '/patients/resources/financing-options/',
  '/pricing-financing/insurance-coverage/': '/patients/resources/financing-options/',
  '/patients/results/testimonials/': '/patients/results/reviews/',
  '/patients/results/video-stories/': '/patients/results/reviews/',
  '/patients/resources/forms/': '/book-consultation/',
};
Object.entries(permanentRedirects).forEach(([fromPath, toPath]) => {
  app.get(fromPath, (req, res) => res.redirect(301, toPath));
  if (fromPath !== '/' && fromPath.endsWith('/')) {
    app.get(fromPath.slice(0, -1), (req, res) => res.redirect(301, toPath));
  }
});

/** Old WordPress / marketing URLs — register before routeMap */
function registerLegacy301Routes(redirects) {
  Object.entries(redirects).forEach(([fromPath, toPath]) => {
    if (fromPath.includes('.')) {
      app.get(fromPath, (req, res) => res.redirect(301, toPath));
      return;
    }
    const base = fromPath.replace(/\/$/, '');
    app.get(base, (req, res) => res.redirect(301, toPath));
    app.get(`${base}/`, (req, res) => res.redirect(301, toPath));
  });
}
registerLegacy301Routes(legacyWordPressRedirects);

// Register all mapped routes (handle both with and without trailing slash)
Object.entries(routeMap).forEach(([url, filePath]) => {
  // Normalize file path to handle spaces and special characters
  const normalizedFilePath = path.normalize(filePath);
  
  // Register route with trailing slash
  app.get(url, async (req, res, next) => {
    // Check if this route has a Strapi page
    const strapiSlug = strapiPageSlugs[url];
    
    if (strapiSlug) {
      try {
        const pageData = await getPageBySlug(strapiSlug);
        
        if (pageData) {
          // Render with Strapi data using the mapped template file
          return res.render(normalizedFilePath, { pageData });
        }
      } catch (error) {
        console.error(`Error fetching Strapi page for ${url}:`, error.message);
        // Fall through to static rendering
      }
    }
    
    // Fallback: render static file
    const fullPath = path.join(__dirname, normalizedFilePath);
    if (fs.existsSync(fullPath)) {
      // Use normalized path but ensure we don't expose the actual file path in URL
      renderView(normalizedFilePath, res, next);
    } else {
      // File doesn't exist but route is in menu - show coming soon page
      renderView('coming-soon.html', res, next);
    }
});

  // Also register without trailing slash (except for root)
  if (url !== '/' && url.endsWith('/')) {
    const urlWithoutSlash = url.slice(0, -1);
    app.get(urlWithoutSlash, async (req, res, next) => {
      // Check if this route has a Strapi page
      const strapiSlug = strapiPageSlugs[url]; // Use original URL with slash
      
      if (strapiSlug) {
        try {
          const pageData = await getPageBySlug(strapiSlug);
          
          if (pageData) {
            return res.render(normalizedFilePath, { pageData });
          }
        } catch (error) {
          console.error(`Error fetching Strapi page for ${urlWithoutSlash}:`, error.message);
          // Fall through to static rendering
        }
      }
      
      // Fallback: render static file
      const fullPath = path.join(__dirname, normalizedFilePath);
      if (fs.existsSync(fullPath)) {
        renderView(normalizedFilePath, res, next);
      } else {
        // File doesn't exist but route is in menu - show coming soon page
        renderView('coming-soon.html', res, next);
      }
    });
  }
});

// Redirect old file-based URLs to new clean URLs
const redirectMap = {
  '/smile-la-landing-page-2026.html': '/smile-la-landing-page-2026',
  '/smile-la-landing-page-2026.html/': '/smile-la-landing-page-2026',
  '/smile-cost.html': '/smile-cost/',
  '/smile-cost.html/': '/smile-cost/',
  '/smile-book-consultation.html': '/smile-book-consultation/',
  '/smile-book-consultation.html/': '/smile-book-consultation/',
  '/smile-book-consultation-thank-you.html': '/smile-book-consultation-thank-you/',
  '/smile-book-consultation-thank-you.html/': '/smile-book-consultation-thank-you/',

  // Procedures - Laser Vision
  '/procedures/laser-vision/smile-page-complete.html': '/procedures/laser-vision/smile-laser/',
  '/procedures/laser-vision/smile-page-complete': '/procedures/laser-vision/smile-laser/',
  '/procedures/laser-vision/lasik-page-complete.html': '/procedures/laser-vision/lasik/',
  '/procedures/laser-vision/lasik-page-complete': '/procedures/laser-vision/lasik/',
  '/procedures/laser-vision/superlasik-no-cut-page.html': '/procedures/laser-vision/superlasik/',
  '/procedures/laser-vision/superlasik-no-cut-page': '/procedures/laser-vision/superlasik/',
  '/procedures/laser-vision/asa_procedure_page_gen_z.html': '/procedures/laser-vision/asa/',
  '/procedures/laser-vision/asa_procedure_page_gen_z': '/procedures/laser-vision/asa/',
  
  // Procedures - Lens Solutions
  '/procedures/lens-solutions/evo-icl-service-page.html': '/procedures/lens-solutions/evo-icl/',
  '/procedures/lens-solutions/evo-icl-service-page': '/procedures/lens-solutions/evo-icl/',
  '/procedures/lens-solutions/pie-rle-service-page.html': '/procedures/lens-solutions/pie/',
  '/procedures/lens-solutions/pie-rle-service-page': '/procedures/lens-solutions/pie/',
  '/procedures/lens-solutions/lensar-Robotic-Laser-cataract-surgery-page.html': '/procedures/lens-solutions/robotic-cataract-surgery/',
  '/procedures/lens-solutions/lensar-Robotic-Laser-cataract-surgery-page': '/procedures/lens-solutions/robotic-cataract-surgery/',
  
  // Procedures - Specialty Treatments
  '/procedures/specialty-treatments/cxl-keratoconus-page.html': '/procedures/specialty-treatments/cxl-keratoconus/',
  '/procedures/specialty-treatments/cxl-keratoconus-page': '/procedures/specialty-treatments/cxl-keratoconus/',
  '/procedures/specialty-treatments/ctak-keratoconus-page.html': '/procedures/specialty-treatments/ctak-keratoconus/',
  '/procedures/specialty-treatments/ctak-keratoconus-page': '/procedures/specialty-treatments/ctak-keratoconus/',
  '/procedures/specialty-treatments/epioxa-westlake-village.html': '/procedures/specialty-treatments/epioxa-westlake-village/',
  '/procedures/specialty-treatments/epioxa-westlake-village': '/procedures/specialty-treatments/epioxa-westlake-village/',
  '/procedures/specialty-treatments/epioxa-beverly-hills.html': '/procedures/specialty-treatments/epioxa-beverly-hills/',
  '/procedures/specialty-treatments/epioxa-beverly-hills': '/procedures/specialty-treatments/epioxa-beverly-hills/',
  '/procedures/specialty-treatments/Cosmetic Pterygium Surgery Restore Your Bright, Clear, Healthy-Looking Eyes.html': '/procedures/specialty-treatments/pterygium-surgery/',
  '/procedures/specialty-treatments/hello-dry-eye-treatment.html': '/procedures/specialty-treatments/dry-eye-solutions/',
  '/procedures/specialty-treatments/hello-dry-eye-treatment': '/procedures/specialty-treatments/dry-eye-solutions/',
  '/procedures/specialty-treatments/Advanced Chalazion Treatment.html': '/procedures/specialty-treatments/chalazion-treatment/',
  
  // Tools
  '/critical-page-quiz.html': '/tools/am-i-a-candidate/',
  '/critical-page-quiz': '/tools/am-i-a-candidate/',
  
  // Contact
  '/contact/Virtual  IRl Consult.html': '/contact/virtual-consultation/',
  '/contact/Emergence Care after eye surgery.html': '/contact/emergency-care/',
  
  // Legal (plain draft file → canonical URL)
  '/privacy-policy.html': '/privacy/',
  '/privacy-policy': '/privacy/',

  // Patients Resources
  '/patients/resources/All You Ever wanted to Know About financing.html': '/patients/resources/financing-options/',
  '/patients/resources/insurance-info.html': '/patients/resources/financing-options/',
  '/pricing-financing/insurance-coverage.html': '/patients/resources/financing-options/',
  '/patients/results/testimonials.html': '/patients/results/reviews/',
  '/patients/results/video-stories.html': '/patients/results/reviews/',
  '/patients/resources/forms.html': '/book-consultation/',

  // FAQ Redirects
  '/patients/resources/faqs/smile.html': '/patients/resources/faqs/smile/',
  '/patients/resources/faqs/lasik.html': '/patients/resources/faqs/lasik/',
  '/patients/resources/faqs/cxl.html': '/patients/resources/faqs/cxl/',
  '/patients/resources/faqs/ctak.html': '/patients/resources/faqs/ctak/',
  '/patients/resources/faqs/pterygium-surgery.html': '/patients/resources/faqs/pterygium-surgery/',
  '/patients/resources/faqs/robotic-laser-cataract.html': '/patients/resources/faqs/robotic-laser-cataract/',
  '/patients/resources/faqs/yag-vitreolysis.html': '/patients/resources/faqs/yag-vitreolysis/',
  
  // What to Expect Redirects
  '/patients/your-journey/what-to-expect/lasik.html': '/patients/your-journey/what-to-expect/lasik/',
  '/patients/your-journey/what-to-expect/smile.html': '/patients/your-journey/what-to-expect/smile/',
  '/patients/your-journey/what-to-expect/cataract.html': '/patients/your-journey/what-to-expect/cataract/',
  '/patients/your-journey/what-to-expect/cxl.html': '/patients/your-journey/what-to-expect/cxl/',
  '/patients/your-journey/what-to-expect/pterygium.html': '/patients/your-journey/what-to-expect/pterygium/',
  
  // Pricing
  '/financing-calculator-page.html': '/pricing-financing/calculator/',
  '/financing-calculator-page': '/pricing-financing/calculator/',
};

// Register redirects
Object.entries(redirectMap).forEach(([oldUrl, newUrl]) => {
  app.get(oldUrl, (req, res) => {
    res.redirect(301, newUrl);
  });
});

/** Apex + short paths: hubs list partners first; MD booking vanities; OD worksheets for whitelist office keys. */
if (PHYSICIAN_PORTAL_READY && fs.existsSync(PHYSICIAN_PORTAL_REFER_HTML)) {
  app.get(['/:referralVanityKey', '/:referralVanityKey/'], (req, res, next) => {
    const seg = typeof req.params.referralVanityKey === 'string' ? req.params.referralVanityKey : '';
    if (!seg) return next();
    if (PHYSICIAN_PORTAL_DIRECTORY_HTML_READY && referralOffices.hasDirectoryKey(seg) && fs.existsSync(PHYSICIAN_PORTAL_DIRECTORY_HTML)) {
      return res.sendFile(PHYSICIAN_PORTAL_DIRECTORY_HTML);
    }
    if (referralOffices.hasBookingVanityKey(seg) && fs.existsSync(PHYSICIAN_PORTAL_BOOK_HTML)) {
      if (redirectToCanonicalBookingVanity(seg, res)) return;
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      return res.sendFile(PHYSICIAN_PORTAL_BOOK_HTML);
    }
    if (referralOffices.hasClinicKey(seg) || referralOffices.hasOfficeKey(seg)) {
      return res.sendFile(PHYSICIAN_PORTAL_REFER_HTML);
    }
    return next();
  });
}

// Blog routes (after specific routes to avoid conflicts, but exclude API routes)
app.use((req, res, next) => {
  // Skip blog routes for API endpoints
  if (req.path.startsWith('/api/')) {
    return next();
  }
  blogRoutes(req, res, next);
});

// Catch-all route for .html files to render with EJS (for includes)
// Exclude our clean URL patterns to prevent conflicts
app.get(/^(?!\/api)(?!\/public)(?!\/assets)(?!\/procedures\/laser-vision\/smile-laser)(?!\/procedures\/laser-vision\/lasik)(?!\/procedures\/laser-vision\/superlasik)(?!\/procedures\/laser-vision\/asa)(?!\/procedures\/laser-vision\/compare)(?!\/procedures\/lens-solutions\/evo-icl)(?!\/procedures\/lens-solutions\/pie)(?!\/procedures\/lens-solutions\/robotic-cataract-surgery)(?!\/procedures\/lens-solutions\/which-lens-is-right)(?!\/procedures\/specialty-treatments\/cxl-keratoconus)(?!\/procedures\/specialty-treatments\/ctak-keratoconus)(?!\/procedures\/specialty-treatments\/epioxa-westlake-village)(?!\/procedures\/specialty-treatments\/epioxa-beverly-hills)(?!\/procedures\/specialty-treatments\/pterygium-surgery)(?!\/procedures\/specialty-treatments\/dry-eye-solutions)(?!\/procedures\/specialty-treatments\/chalazion-treatment)(?!\/Referral)(?!\/referral)(?!\/Doctorportal)(?!\/doctorportal)(?!\/DOCTORPORTAL)(?!\/kvi-physician-portal).+\.html$/, (req, res, next) => {
  const viewPath = resolveViewPath(req.path);
  renderView(viewPath, res, next);
});

// JSON parse error handler (prevents noisy stack traces on malformed/attack traffic)
app.use((err, req, res, next) => {
  const isBadJson =
    (err && err.type === 'entity.parse.failed') ||
    (err instanceof SyntaxError && err.status === 400 && 'body' in err);

  if (isBadJson) {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload.' });
  }

  return next(err);
});

// Handle extension-less URLs by looking for matching HTML files
// Exclude our clean URL patterns (procedures, about, patients, pricing-financing, blog, contact, tools, book-consultation, faqs)
// Also exclude physician portal short paths (/Referral, /Doctorportal) so they never fall through to 404.html
app.get(/^(?!\/api)(?!\/public)(?!\/assets)(?!\/media)(?!\/procedures)(?!\/about)(?!\/patients)(?!\/pricing-financing)(?!\/blog)(?!\/contact)(?!\/tools)(?!\/book-consultation)(?!\/faq)(?!\/Referral)(?!\/referral)(?!\/Doctorportal)(?!\/doctorportal)(?!\/DOCTORPORTAL)(?!\/kvi-physician-portal)(?!.*\.[a-zA-Z0-9]+).+$/, (req, res, next) => {
  const viewPath = resolveViewPath(req.path, { ensureHtml: true });
  renderView(viewPath, res, next);
});

// 404 handler (skip for API routes)
app.use((req, res) => {
  // For API routes, return JSON error
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  // For other routes, render 404 page
  res.status(404);
  renderView('404.html', res, () => {
    res.status(404).send('Page not found');
  });
});


try {
  require('./services/pieAutoresponder/safe').startCronIfEnabled();
} catch (pieCronErr) {
  console.error('[pie-autoresponder] startup skipped:', pieCronErr.message || pieCronErr);
}

app.listen(PORT, () => {
  console.log(`KVI site running at http://localhost:${PORT}`);
});
