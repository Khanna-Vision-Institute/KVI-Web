/**
 * Lightweight registry for referral-worksheet vanity URLs and office lookups.
 *
 * Loads JSON from disk at startup — see docs/physician-portal-hosting.md and data/referral-offices.sample.json.
 * Optional env override: KVI_REFERRAL_OFFICES_JSON=/absolute/path/to/referral-offices.json
 */
const fs = require('fs');
const path = require('path');

/**
 * Internal office row parsed from manifest.
 *
 * **`directoryHubsNorm`**: `null` = list on **every** `directoryPages` hub; non-empty array = only those hubs; `[]` = never listed.
 *
 * @typedef {{
 *   slug: string,
 *   practiceName: string,
 *   doctorName: string,
 *   addressLine?: string,
 *   phone?: string,
 *   rawBlock?: string,
 *   npi?: string,
 *   email?: string,
 *   fax?: string,
 *   credentials?: string,
 *   addressStreet?: string,
 *   city?: string,
 *   stateOrZip?: string,
 *   directoryHubsNorm?: string[] | null,
 *   providerType?: 'od' | 'md',
 * }} ReferralOffice
 */

function inferProviderType(row) {
  const explicit = String(row.providerType || row.provider_type || '')
    .trim()
    .toLowerCase();
  if (explicit === 'md' || explicit === 'physician') return 'md';
  if (explicit === 'od' || explicit === 'optometrist') return 'od';

  const cred = String(row.credentials || '').trim();
  if (/\b(MD|DO|FACC|FACP|FAAFP|FAAFM|MBBS)\b/i.test(cred) && !/\bOD\b/i.test(cred)) return 'md';
  if (/\bOD\b/i.test(cred)) return 'od';
  if (/^(?:mdvip-|heritage-md-)/i.test(String(row.slug || ''))) return 'md';
  return 'od';
}

function normalizeSlugKey(raw) {
  return String(raw || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

/**
 * Stable URL segment for a referring practice (group of worksheet rows sharing `practiceName`).
 * Example: "20/20 EYECARE CENTER" → `20-20-eyecare-center`.
 *
 * @param {string} name
 */
function practiceNameToClinicKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Short MD booking vanity segment — strips marketing prefixes from manifest slugs. */
function stripMdBookingVanityPrefix(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/^heritage-target-/i, '')
    .replace(/^heritage-md-/i, '')
    .replace(/^mdvip-/i, '');
}

/** @param {ReferralOffice} row @returns {'md' | 'do' | null} */
function inferMdDoSuffix(row) {
  const cred = String(row.credentials || '');
  const name = String(row.doctorName || '');
  const hay = `${cred} ${name}`;

  const hasDo = /\bDO\b/i.test(hay);
  const hasMd = /\bMD\b/i.test(hay) || /\bM\.D\.\b/i.test(hay);
  if (hasDo && !hasMd) return 'do';
  if (hasMd) return 'md';
  if (hasDo) return 'do';

  if ((row.providerType || inferProviderType(row)) === 'md') return 'md';
  return null;
}

/** @param {string} rawName */
function slugifyDoctorName(rawName) {
  const cleaned = String(rawName || '')
    .replace(/,\s*(MD|DO|M\.D\.|D\.O\.)\b.*$/i, '')
    .trim();
  return practiceNameToClinicKey(cleaned);
}

/** @param {ReferralOffice} row @param {string} baseShort @param {string} nameSlug */
function extractMdCitySlug(row, baseShort, nameSlug) {
  const practiceSlug = practiceNameToClinicKey(row.practiceName || '');

  if (nameSlug && baseShort.startsWith(`${nameSlug}-`)) {
    const tail = baseShort.slice(nameSlug.length + 1);
    if (tail) return tail;
  }

  if (practiceSlug && baseShort.endsWith(`-${practiceSlug}`)) {
    const prefix = baseShort.slice(0, -(practiceSlug.length + 1));
    if (!nameSlug || prefix === nameSlug) return practiceSlug;
  }

  if (/^heritage-md-/i.test(String(row.slug || '')) && practiceSlug) {
    return practiceSlug;
  }

  const addr = String(row.addressLine || row.addressStreet || '');
  const cityMatch = addr.match(/,\s*([^,]+),\s*CA\b/i);
  if (cityMatch) {
    const citySlug = practiceNameToClinicKey(cityMatch[1]);
    if (citySlug && (!nameSlug || baseShort.endsWith(citySlug))) return citySlug;
  }

  return '';
}

/** @param {ReferralOffice} row @param {string} canonSlug */
function buildMdBookingVanitySlug(row, canonSlug) {
  const baseShort = stripMdBookingVanityPrefix(canonSlug);
  if (!baseShort || baseShort === canonSlug) return '';
  const credential = inferMdDoSuffix(row);
  if (!credential) return baseShort;

  const nameSlug = slugifyDoctorName(row.doctorName || '');
  const citySlug = extractMdCitySlug(row, baseShort, nameSlug);
  if (nameSlug && citySlug) {
    return `${nameSlug}-${credential}-${citySlug}`;
  }

  if (nameSlug && baseShort.startsWith(`${nameSlug}-`)) {
    const locationPart = baseShort.slice(nameSlug.length + 1);
    if (locationPart) return `${nameSlug}-${credential}-${locationPart}`;
  }

  if (baseShort.endsWith(`-${credential}`)) return baseShort;
  return `${baseShort}-${credential}`;
}

/**
 * Marketing “hub” landing pages listing all referral partners (distinct from worksheet vanity keys).
 * Shape in manifest: `"directoryPages": { "HeritageFamily": { "title": "...", "subtitle": "..." } }`
 */
function parseDirectoryPages(root, logger) {
  /** @type {Map<string, { title: string, subtitle: string, displaySlug: string }>} */
  const byNorm = new Map();
  if (!root || typeof root !== 'object' || Array.isArray(root)) return byNorm;
  /** @type {unknown} */
  const raw = /** @type {Record<string, unknown>} */ (root).directoryPages;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return byNorm;

  for (const [displayKey, meta] of Object.entries(/** @type {Record<string, unknown>} */ (raw))) {
    const nk = normalizeSlugKey(displayKey);
    if (!nk || !officeKeyLooksLikeOurs(nk)) {
      logger.warn('[referral-offices] Ignored invalid directoryPages key:', displayKey);
      continue;
    }
    const title = meta && typeof meta === 'object' && typeof meta.title === 'string' ? meta.title.trim() : '';
    const subtitle =
      meta && typeof meta === 'object' && typeof meta.subtitle === 'string' ? meta.subtitle.trim() : '';
    byNorm.set(nk, {
      title: title || displayKey,
      subtitle: subtitle || '',
      displaySlug: String(displayKey).trim() || nk,
    });
  }

  return byNorm;
}

/**
 * @param {*} data
 * @returns {{ aliases: Record<string,string>, offices: ReferralOffice[] }}
 */
function parseManifestPayload(data, sourcePathForLog, log) {
  const logger = typeof log?.warn === 'function' ? log : console;

  /** @type {Record<string,string>} */
  const aliasesFlat = {};

  /** @type {ReferralOffice[]} */
  let offices = [];

  if (Array.isArray(data)) {
    offices = /** @type {ReferralOffice[]} */ (data);
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data.offices)) offices = data.offices;
    const aliases = data.aliases;
    if (aliases && typeof aliases === 'object' && !Array.isArray(aliases)) {
      for (const [k, v] of Object.entries(aliases)) {
        const nk = normalizeSlugKey(k);
        const target = normalizeSlugKey(v);
        if (nk && target) aliasesFlat[nk] = target;
      }
    }
    if (Array.isArray(data.aliasList)) {
      for (const row of data.aliasList) {
        if (!row || typeof row !== 'object') continue;
        const from = normalizeSlugKey(row.from || row.marketingSlug || row.alias);
        const to = normalizeSlugKey(row.to || row.slug || row.canonicalSlug);
        if (from && to) aliasesFlat[from] = to;
      }
    }
  } else {
    logger.warn('[referral-offices] Unexpected manifest shape (ignored):', sourcePathForLog);
    return { aliases: aliasesFlat, offices: [] };
  }

  /** @type {ReferralOffice[]} */
  const cleaned = [];

  for (const row of offices) {
    if (!row || typeof row !== 'object') continue;
    const slug =
      normalizeSlugKey(row.slug) ||
      normalizeSlugKey(row.canonicalSlug) ||
      normalizeSlugKey(row.slugKey);
    if (!slug) continue;
    const practiceName =
      typeof row.practiceName === 'string'
        ? row.practiceName
        : typeof row.practice_name === 'string'
          ? row.practice_name
          : '';
    const doctorName =
      typeof row.doctorName === 'string'
        ? row.doctorName
        : typeof row.doctor_name === 'string'
          ? row.doctor_name
          : '';
    const addressLine =
      typeof row.addressLine === 'string'
        ? row.addressLine
        : typeof row.address_line === 'string'
          ? row.address_line
          : '';
    const rawBlock =
      typeof row.rawBlock === 'string' ? row.rawBlock : typeof row.raw_block === 'string' ? row.raw_block : '';
    /** @param {string} camel @param {string} snake */
    const pickStr = (camel, snake) => {
      if (typeof row[camel] === 'string') return row[camel].trim();
      if (typeof row[snake] === 'string') return row[snake].trim();
      return '';
    };

    /** @type {string[] | null} */
    let directoryHubsNorm = null;
    const dhRaw = row.directory_hubs ?? row.directoryHubs;
    if (dhRaw !== undefined && dhRaw !== null) {
      if (!Array.isArray(dhRaw)) {
        logger.warn('[referral-offices] Ignored invalid `directory_hubs` (expected array):', {
          slug,
          manifestAbsolute: sourcePathForLog,
        });
      } else {
        const nkList = dhRaw
          .map((k) => normalizeSlugKey(/** @type {unknown} */ (k)))
          .filter(Boolean);
        directoryHubsNorm = nkList.length ? nkList : [];
      }
    }

    cleaned.push({
      slug,
      practiceName,
      doctorName,
      addressLine,
      phone: typeof row.phone === 'string' ? row.phone : '',
      rawBlock,
      npi: pickStr('npi', 'doctor_npi'),
      email: pickStr('email', 'email'),
      fax: pickStr('fax', 'fax'),
      credentials: pickStr('credentials', 'credentials'),
      addressStreet: pickStr('addressStreet', 'address_street'),
      city: pickStr('city', 'city'),
      stateOrZip: pickStr('stateOrZip', 'state_or_zip'),
      directoryHubsNorm,
      providerType: inferProviderType(row)
    });
  }

  return { aliases: aliasesFlat, offices: cleaned };
}

/**
 * @param {{ logger?: Pick<Console, 'warn' | 'info'> }} opts
 */
function loadReferralOfficesRegistry(opts = {}) {
  const logger = opts.logger || console;

  /** @type {Map<string, ReferralOffice>} */
  const officesByCanon = new Map();

  /** @type {Set<string>} all keys known (aliases + canon) — normalized lowercase */
  const knownKeys = new Set();

  const manifestPathRaw = (
    process.env.KVI_REFERRAL_OFFICES_JSON ||
    path.join(__dirname, '..', 'data', 'referral-offices.json')
  ).trim();

  let manifestAbsolute = manifestPathRaw;
  if (!path.isAbsolute(manifestAbsolute)) {
    manifestAbsolute = path.resolve(__dirname, '..', manifestPathRaw);
  }

  /** @type {Record<string, string>} */
  let aliasNorm = {};

  /** Directory hub pages (/HeritageFamily, /Doctorportal/network/...) populated when manifest parses. */
  let directoriesByNorm = /** @type {Map<string, { title: string, subtitle: string, displaySlug: string }>} */ (
    new Map()
  );

  /** @type {Map<string, { clinicKey: string, practiceName: string, physicians: { slug: string } & ReferralOffice[] }>} */
  let clinicsByKey = new Map();

  function hasOfficeKey(rawKey) {
    const nk = normalizeSlugKey(rawKey);
    if (!nk || !officeKeyLooksLikeOurs(nk)) return false;
    // Hub pages “win” on apex paths (/HeritageFamily) vs worksheet vanities.
    if (directoriesByNorm.has(nk)) return false;
    return knownKeys.has(nk);
  }

  /** @param {string} rawKey */
  function getOffice(rawKey) {
    const nk = normalizeSlugKey(rawKey);
    if (!nk || !officeKeyLooksLikeOurs(nk)) return null;

    let canon = nk;
    if (!officesByCanon.has(canon)) {
      const via = aliasNorm[nk];
      if (!via) return null;
      canon = via;
    }
    const office = officesByCanon.get(canon);
    if (!office) return null;

    return {
      slug: canon,
      resolvedFromKey: nk,
      practiceName: office.practiceName,
      doctorName: office.doctorName,
      phone: office.phone,
      addressLine: office.addressLine,
      rawBlock: office.rawBlock,
      npi: office.npi,
      email: office.email,
      fax: office.fax,
      credentials: office.credentials,
      addressStreet: office.addressStreet,
      city: office.city,
      stateOrZip: office.stateOrZip,
    };
  }

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestAbsolute, 'utf8'));
  } catch (err) {
    logger.warn('[referral-offices] Failed to parse manifest:', manifestAbsolute, err && err.message ? err.message : err);
    return baseRegistry();
  }

  directoriesByNorm = parseDirectoryPages(parsed, logger);

  const parsedManifest = parseManifestPayload(parsed, manifestAbsolute, logger);
  aliasNorm = parsedManifest.aliases;

  for (const row of parsedManifest.offices) {
    officesByCanon.set(normalizeSlugKey(row.slug), row);
  }

  for (const k of officesByCanon.keys()) {
    knownKeys.add(k);
  }

  for (const [from, toCanon] of Object.entries(aliasNorm)) {
    knownKeys.add(from);
    if (directoriesByNorm.has(from)) {
      logger.warn(
        '[referral-offices] `aliases` key conflicts with `directoryPages` key (aliases win ignored for overlaps):',
        { from: from, hub: from }
      );
    }
    if (!officesByCanon.has(toCanon)) {
      logger.warn('[referral-offices] Alias points at unknown canonical slug:', { from, toCanon, manifestAbsolute });
    }
  }

  /** Bucket worksheet rows by normalized practice name so partners share one vanity URL. */
  const clinicBuckets = /** @type {Map<string, ({ slug: string } & ReferralOffice)[]>} */ (new Map());
  for (const [slug, row] of officesByCanon.entries()) {
    const ck = practiceNameToClinicKey(row.practiceName || '');
    if (!ck || !officeKeyLooksLikeOurs(ck)) continue;
    const prev = clinicBuckets.get(ck);
    if (prev) prev.push({ slug, ...row });
    else clinicBuckets.set(ck, [{ slug, ...row }]);
  }

  clinicsByKey = new Map();
  for (const [ck, items] of clinicBuckets.entries()) {
    if (!items.length) continue;
    if (directoriesByNorm.has(ck)) {
      logger.warn('[referral-offices] Skipped clinic vanity key — conflicts with directoryPages hub:', ck);
      continue;
    }
    if (officesByCanon.has(ck)) {
      const inGroup = items.some((it) => it.slug === ck);
      if (!inGroup) {
        logger.warn(
          '[referral-offices] Skipped clinic vanity key — slug collision with unrelated office row:',
          ck
        );
        continue;
      }
    }

    const practiceLabels = new Set(
      items.map((it) => String(it.practiceName || '').trim()).filter(Boolean)
    );
    if (practiceLabels.size > 1) {
      logger.warn('[referral-offices] Clinic key groups multiple distinct practice_name strings — verify manifest:', {
        clinicKey: ck,
        practiceLabels: [...practiceLabels],
      });
    }

    const practiceName =
      [...practiceLabels].sort((a, b) => b.length - a.length)[0] ||
      String(items[0].practiceName || '').trim() ||
      '';

    clinicsByKey.set(ck, {
      clinicKey: ck,
      practiceName,
      physicians: items,
    });
  }

  /** @type {Map<string, string>} short vanity → canonical MD slug */
  const bookingVanityByShort = new Map();
  /** @type {Map<string, string>} canonical MD slug → short vanity */
  const bookingVanityByCanon = new Map();

  /** @param {string} short @param {string} slug @param {boolean} [primary=false] */
  function registerBookingVanity(short, slug, primary = false) {
    if (!short || !officeKeyLooksLikeOurs(short) || short === slug) return false;
    if (directoriesByNorm.has(short)) {
      logger.warn('[referral-offices] Skipped MD booking vanity — conflicts with directoryPages hub:', short);
      return false;
    }
    if (clinicsByKey.has(short)) {
      logger.warn('[referral-offices] Skipped MD booking vanity — conflicts with OD clinic vanity:', short);
      return false;
    }
    if (officesByCanon.has(short)) {
      const existing = officesByCanon.get(short);
      const existingType = existing ? existing.providerType || inferProviderType(existing) : 'od';
      if (existingType !== 'md') {
        logger.warn('[referral-offices] Skipped MD booking vanity — collides with non-MD office slug:', short);
        return false;
      }
    }
    if (aliasNorm[short] && aliasNorm[short] !== slug) {
      logger.warn('[referral-offices] Skipped MD booking vanity — alias already mapped elsewhere:', {
        short,
        existing: aliasNorm[short],
        slug,
      });
      return false;
    }
    if (bookingVanityByShort.has(short) && bookingVanityByShort.get(short) !== slug) {
      logger.warn('[referral-offices] Duplicate MD booking vanity (skipped):', short);
      return false;
    }

    bookingVanityByShort.set(short, slug);
    if (primary) bookingVanityByCanon.set(slug, short);
    aliasNorm[short] = slug;
    knownKeys.add(short);
    return true;
  }

  for (const [slug, row] of officesByCanon.entries()) {
    if ((row.providerType || inferProviderType(row)) !== 'md') continue;

    const baseShort = stripMdBookingVanityPrefix(slug);
    const short = buildMdBookingVanitySlug(row, slug);
    if (!short) continue;

    const credential = inferMdDoSuffix(row);
    const endSuffixed = credential && baseShort ? `${baseShort}-${credential}` : '';

    if (registerBookingVanity(short, slug, true)) {
      if (baseShort !== short) registerBookingVanity(baseShort, slug, false);
      if (endSuffixed && endSuffixed !== short && endSuffixed !== baseShort) {
        registerBookingVanity(endSuffixed, slug, false);
      }
    }
  }

  function hasBookingVanityKey(rawKey) {
    const nk = normalizeSlugKey(rawKey);
    if (!nk || !officeKeyLooksLikeOurs(nk)) return false;
    if (directoriesByNorm.has(nk)) return false;
    return bookingVanityByShort.has(nk);
  }

  /** @param {string} rawKey */
  function resolveBookingVanityCanon(rawKey) {
    const nk = normalizeSlugKey(rawKey);
    return bookingVanityByShort.get(nk) || null;
  }

  /** @param {string} canonSlug */
  function getBookingVanitySlug(canonSlug) {
    const nk = normalizeSlugKey(canonSlug);
    return bookingVanityByCanon.get(nk) || null;
  }

  function hasClinicKey(rawKey) {
    const nk = normalizeSlugKey(rawKey);
    if (!nk || !officeKeyLooksLikeOurs(nk)) return false;
    if (directoriesByNorm.has(nk)) return false;
    return clinicsByKey.has(nk);
  }

  /** @param {string} rawKey */
  function getClinic(rawKey) {
    const nk = normalizeSlugKey(rawKey);
    if (!nk || !officeKeyLooksLikeOurs(nk)) return null;
    const hit = clinicsByKey.get(nk);
    if (!hit) return null;
    return {
      clinicKey: hit.clinicKey,
      resolvedFromKey: nk,
      practiceName: hit.practiceName || '',
      physicians: hit.physicians.map((p) => ({
        slug: p.slug,
        doctorName: p.doctorName || '',
        practiceName: p.practiceName || '',
        phone: p.phone || '',
        addressLine: p.addressLine || '',
        rawBlock: p.rawBlock || '',
        npi: p.npi || '',
        email: p.email || '',
        fax: p.fax || '',
        credentials: p.credentials || '',
        addressStreet: p.addressStreet || '',
        city: p.city || '',
        stateOrZip: p.stateOrZip || '',
      })),
    };
  }

  /** Alphabetical worksheet vanity segments derived from grouped `practice_name` rows. */
  function listClinicVanityKeys() {
    return [...clinicsByKey.keys()].sort();
  }

  function hasDirectoryKey(rawKey) {
    const nk = normalizeSlugKey(rawKey);
    if (!nk || !officeKeyLooksLikeOurs(nk)) return false;
    return directoriesByNorm.has(nk);
  }

  /** @returns {null | { title: string, subtitle: string, displaySlug: string, hubNorm: string }} */
  function getDirectoryMeta(rawKey) {
    const nk = normalizeSlugKey(rawKey);
    if (!directoriesByNorm.has(nk)) return null;
    const row = directoriesByNorm.get(nk);
    return row ? { ...row, hubNorm: nk } : null;
  }

  /**
   * @returns {{
   *   slug: string,
   *   doctorName: string,
   *   practiceName: string,
   *   credentials: string,
   *   phone: string,
   *   addressLine: string,
   *   referralRelativeUrl: string
   * }[]}
   */
  function listDirectorySummaries({ hubNorm: hubNormRaw, q = '', offset = 0, limit = 500 } = {}) {
    let lim = Number(limit);
    let off = Number(offset);
    if (!Number.isFinite(lim)) lim = 500;
    if (!Number.isFinite(off)) off = 0;
    lim = Math.max(1, Math.min(2500, Math.floor(lim)));
    off = Math.max(0, Math.floor(off));

    const needle = String(q || '').trim().toLowerCase();
    const hubNorm = normalizeSlugKey(hubNormRaw);
    if (!hubNorm) {
      return [];
    }

    /** @type {{ slug: string, doctorName: string, practiceName: string, credentials: string, phone: string, addressLine: string, referralRelativeUrl: string }[]} */
    const rows = [];
    for (const [slug, row] of officesByCanon.entries()) {
      const hubsTagged = row.directoryHubsNorm;
      if (hubsTagged !== undefined && hubsTagged !== null) {
        if (!Array.isArray(hubsTagged) || hubsTagged.length === 0) continue;
        if (!hubsTagged.includes(hubNorm)) continue;
      }

      const providerType = row.providerType || inferProviderType(row);
      const ck = practiceNameToClinicKey(row.practiceName || '');
      const clinicVanity = ck && clinicsByKey.has(ck) ? `/${ck}` : '';
      const mdBookingVanity = providerType === 'md' ? getBookingVanitySlug(slug) : null;
      const referralRelativeUrl =
        providerType === 'md'
          ? mdBookingVanity
            ? `/${mdBookingVanity}`
            : `/Doctorportal/book-consultation?ref=${encodeURIComponent(slug)}&fp_for=office`
          : clinicVanity || `/Doctorportal/refer-a-patient?ref=${encodeURIComponent(slug)}`;
      const bookingRelativeUrl =
        providerType === 'md'
          ? referralRelativeUrl
          : `/Doctorportal/book-consultation?ref=${encodeURIComponent(slug)}&fp_for=office`;

      rows.push({
        slug,
        doctorName: row.doctorName || '',
        practiceName: row.practiceName || '',
        credentials: row.credentials || '',
        phone: row.phone || '',
        addressLine: row.addressLine || '',
        providerType,
        referralRelativeUrl,
        bookingRelativeUrl
      });
    }

    rows.sort((a, b) => {
      const p = String(a.practiceName || '').localeCompare(String(b.practiceName || ''), undefined, {
        sensitivity: 'base',
      });
      if (p !== 0) return p;
      return String(a.doctorName || '').localeCompare(String(b.doctorName || ''), undefined, { sensitivity: 'base' });
    });

    let filtered = rows;
    if (needle) {
      filtered = rows.filter((row) => {
        const hay = `${row.slug} ${row.practiceName} ${row.doctorName} ${row.credentials} ${row.phone} ${row.addressLine}`.toLowerCase();
        return hay.includes(needle);
      });
    }

    return filtered.slice(off, off + lim);
  }

  logger.info('[referral-offices] Loaded manifest:', {
    manifestAbsolute,
    officeCount: officesByCanon.size,
    clinicVanityCount: clinicsByKey.size,
    aliasCount: Object.keys(aliasNorm).length,
    bookingVanityCount: bookingVanityByShort.size,
    hubPageCount: directoriesByNorm.size,
  });

  return {
    manifestPath: manifestAbsolute,
    hasOfficeKey,
    getOffice,
    hasClinicKey,
    getClinic,
    listClinicVanityKeys,
    hasDirectoryKey,
    getDirectoryMeta,
    hasBookingVanityKey,
    resolveBookingVanityCanon,
    getBookingVanitySlug,
    listDirectorySummaries,
    directoryCount: directoriesByNorm.size,
  };

  function baseRegistry() {
    return {
      manifestPath: manifestAbsolute,
      hasOfficeKey,
      getOffice,
      hasClinicKey() {
        return false;
      },
      getClinic() {
        return null;
      },
      listClinicVanityKeys() {
        return [];
      },
      hasDirectoryKey() {
        return false;
      },
      getDirectoryMeta() {
        return null;
      },
      listDirectorySummaries() {
        return [];
      },
      hasBookingVanityKey() {
        return false;
      },
      resolveBookingVanityCanon() {
        return null;
      },
      getBookingVanitySlug() {
        return null;
      },
      directoryCount: 0,
    };
  }
}

/** Block obvious infra paths if someone misconfigures route order (belt + suspenders). */
function officeKeyLooksLikeOurs(keyNorm) {
  if (!keyNorm) return false;
  if (keyNorm.includes('..')) return false;
  if (keyNorm.includes('\\')) return false;
  if (keyNorm.includes('//')) return false;
  if (keyNorm.includes('.')) return false; // .html, .xml, etc.
  if (keyNorm === 'api' || keyNorm.startsWith('api/')) return false;
  if (keyNorm === 'public' || keyNorm.startsWith('public/')) return false;
  if (keyNorm === 'assets' || keyNorm.startsWith('assets/')) return false;
  if (keyNorm === 'media' || keyNorm.startsWith('media/')) return false;
  // multi-segment keys not used for this route
  if (keyNorm.includes('/')) return false;
  return true;
}

module.exports = {
  loadReferralOfficesRegistry,
  normalizeSlugKey,
  practiceNameToClinicKey,
  stripMdBookingVanityPrefix,
  slugifyDoctorName,
  inferMdDoSuffix,
  buildMdBookingVanitySlug,
  officeKeyLooksLikeOurs,
};
