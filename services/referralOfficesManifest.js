/**
 * Build / write `referral-offices.json` from OD master rows (JSON export or Zoho CRM records).
 */
const fs = require('fs');
const path = require('path');

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** @returns {boolean} */
function hasZipLike(s) {
  return /\b\d{5}(-\d{4})?\b/.test(String(s || ''));
}

/**
 * @param {Record<string, unknown>} row
 */
function formatAddressLine(row) {
  const addr = String(row.Address ?? row.address ?? row.address_line ?? row.addressLine ?? '').trim();
  const city = String(row.City ?? row.city ?? '').trim();
  const zip = String(row.ZIP ?? row.Zip ?? row.zip ?? row.state_or_zip ?? row.stateOrZip ?? '').trim();

  if (hasZipLike(addr)) return addr || [city].filter(Boolean).join(', ');
  const tail = [city, zip].filter(Boolean).join(' ').trim();
  if (!addr && !tail) return '';
  if (addr && tail) return `${addr}, ${tail}`;
  return addr || tail;
}

function buildRawBlock(doctor, practice, addressLine, phone, email, website) {
  const lines = [doctor, practice, addressLine].map((x) => String(x || '').trim()).filter(Boolean);
  const ph = String(phone || '').trim();
  if (ph) lines.push(ph);
  const em = String(email || '').trim();
  if (em) lines.push(em);
  const w = String(website || '').trim();
  if (w) lines.push(w);
  return lines.join('\n').slice(0, 4000);
}

function resolveManifestPath(outFile) {
  const manifestPathRaw = (
    outFile ||
    process.env.KVI_REFERRAL_OFFICES_JSON ||
    path.join('data', 'referral-offices.json')
  ).trim();

  if (path.isAbsolute(manifestPathRaw)) return manifestPathRaw;
  return path.resolve(__dirname, '..', manifestPathRaw);
}

/**
 * @param {string} absOut
 */
function readExistingManifest(absOut) {
  /** @type {Record<string, unknown>} */
  let prev = {};
  if (!fs.existsSync(absOut)) return prev;

  try {
    const p = JSON.parse(fs.readFileSync(absOut, 'utf8'));
    if (p && typeof p === 'object' && !Array.isArray(p)) prev = p;
  } catch (_) {
    /* ignore */
  }
  return prev;
}

function defaultDirectoryPages() {
  return {
    HeritageFamily: {
      title: 'Doctor outreach',
    },
  };
}

/** Matches referralOffices.inferProviderType — MD/DO rows must survive Zoho OD sync. */
function isMdManifestOffice(row) {
  if (!row || typeof row !== 'object') return false;
  const r = /** @type {Record<string, unknown>} */ (row);
  const explicit = String(r.providerType || r.provider_type || '')
    .trim()
    .toLowerCase();
  if (explicit === 'md' || explicit === 'physician') return true;
  if (explicit === 'od' || explicit === 'optometrist') return false;

  const cred = String(r.credentials || '').trim();
  if (/\b(MD|DO|FACC|FACP|FAAFP|FAAFM|MBBS)\b/i.test(cred) && !/\bOD\b/i.test(cred)) return true;
  if (/\bOD\b/i.test(cred)) return false;

  const slug = String(r.slug || '');
  if (/^(?:mdvip-|heritage-md-|heritage-target-)/i.test(slug)) return true;
  if (String(r.sync_source || '') === 'heritage_mdvip') return true;

  return false;
}

function normalizeMatchKey(practice, doctor) {
  return `${String(practice || '').trim()}|${String(doctor || '').trim()}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {unknown[]} existingOffices
 */
function indexExistingOffices(existingOffices) {
  /** @type {Map<string, Record<string, unknown>>} */
  const byZohoId = new Map();
  /** @type {Map<string, Record<string, unknown>>} */
  const byMatchKey = new Map();

  if (!Array.isArray(existingOffices)) return { byZohoId, byMatchKey };

  for (const row of existingOffices) {
    if (!row || typeof row !== 'object') continue;
    const o = /** @type {Record<string, unknown>} */ (row);
    const zohoId = String(o.zoho_id ?? o.zohoId ?? '').trim();
    if (zohoId) byZohoId.set(zohoId, o);

    const practice = String(o.practice_name ?? o.practiceName ?? '').trim();
    const doctor = String(o.doctor_name ?? o.doctorName ?? '').trim();
    const key = normalizeMatchKey(practice, doctor);
    if (key && key !== '|') byMatchKey.set(key, o);
  }

  return { byZohoId, byMatchKey };
}

/**
 * @param {Record<string, unknown>} row
 * @param {string[]} keys
 */
function pickField(row, keys) {
  for (const k of keys) {
    if (!k) continue;
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

/**
 * @param {{
 *   rows: Record<string, unknown>[],
 *   leadStatusFilter?: string,
 *   existingOffices?: unknown[],
 *   directoryHubs?: string[] | null,
 *   markAsOd?: boolean,
 *   syncSource?: string,
 * }} opts
 */
function buildOfficesFromMasterRows(opts) {
  const rows = Array.isArray(opts.rows) ? opts.rows : [];
  const leadFilter = String(opts.leadStatusFilter || '').trim();
  const { byZohoId, byMatchKey } = indexExistingOffices(opts.existingOffices);

  /** @type {Set<string>} */
  const usedSlugs = new Set();
  for (const row of opts.existingOffices || []) {
    if (!row || typeof row !== 'object') continue;
    const slug = String(/** @type {Record<string, unknown>} */ (row).slug || '').trim();
    if (slug) usedSlugs.add(slug);
  }

  /**
   * @param {string} practice
   * @param {string} doctor
   * @param {string} [preferredSlug]
   */
  function allocSlug(practice, doctor, preferredSlug) {
    const preferred = String(preferredSlug || '').trim();
    if (preferred && !usedSlugs.has(preferred)) {
      usedSlugs.add(preferred);
      return preferred;
    }

    const base = slugify(`${practice}-${doctor}`);
    if (!base) return null;
    let candidate = base;
    let i = 2;
    while (usedSlugs.has(candidate)) {
      candidate = `${base}-${i}`;
      i += 1;
      if (i > 500) throw new Error('[referral-offices-manifest] Slug collision exhaustion');
    }
    usedSlugs.add(candidate);
    return candidate;
  }

  /** @type {Record<string, unknown>[]} */
  const offices = [];
  let skipped = 0;
  let leadSkipped = 0;
  let slugPreserved = 0;

  for (const rowRaw of rows) {
    if (!rowRaw || typeof rowRaw !== 'object') continue;
    const rr = /** @type {Record<string, unknown>} */ (rowRaw);

    if (leadFilter) {
      const ls = pickField(rr, ['Lead Status', 'Lead_Status', 'lead_status', 'LeadStatus']);
      if (ls !== leadFilter) {
        leadSkipped += 1;
        continue;
      }
    }

    const practice = pickField(rr, [
      'Practice Name',
      'Practice_Name',
      'practice_name',
      'practiceName',
      'Company',
      'Account_Name',
    ]);
    const doctor = pickField(rr, [
      'Doctor Name',
      'Doctor_Name',
      'doctor_name',
      'doctorName',
      'Name',
      'Full_Name',
    ]);

    if (!practice || !doctor) {
      skipped += 1;
      continue;
    }

    const cred = pickField(rr, ['Cred', 'Credentials', 'credentials']);
    const phone = pickField(rr, ['Phone', 'phone', 'Mobile', 'mobile']);
    const email = pickField(rr, ['Email', 'email']);
    const website = pickField(rr, ['Website', 'website', 'Web', 'web']);
    const addressLine = formatAddressLine(rr);
    const zohoId = pickField(rr, ['id', 'zoho_id', 'zohoId', 'Id', 'record_id']);

    const matchKey = normalizeMatchKey(practice, doctor);
    const existing =
      (zohoId && byZohoId.get(zohoId)) || (matchKey && byMatchKey.get(matchKey)) || null;
    const preferredSlug = existing ? String(existing.slug || '').trim() : '';

    const slug = allocSlug(practice, doctor, preferredSlug);
    if (!slug) {
      skipped += 1;
      continue;
    }
    if (preferredSlug && slug === preferredSlug) slugPreserved += 1;

    /** @type {Record<string, unknown>} */
    const o = {
      slug,
      doctor_name: doctor,
      practice_name: practice,
      address_line: addressLine,
      phone,
      raw_block: buildRawBlock(doctor, practice, addressLine, phone, email, website),
    };

    if (cred) o.credentials = cred;
    if (email) o.email = email;
    if (zohoId) o.zoho_id = zohoId;
    if (opts.markAsOd) o.provider_type = 'od';
    if (opts.syncSource) o.sync_source = opts.syncSource;

    if (opts.directoryHubs !== undefined) {
      if (Array.isArray(opts.directoryHubs) && opts.directoryHubs.length) {
        o.directory_hubs = opts.directoryHubs;
      }
    }

    offices.push(o);
  }

  return { offices, skipped, leadSkipped, slugPreserved };
}

/**
 * @param {string} absOut
 * @param {{ directoryPages?: unknown, aliases?: unknown, offices: unknown[] }} payload
 */
function writeManifest(absOut, payload) {
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(payload, null, 2));
}

/**
 * @param {{
 *   rows: Record<string, unknown>[],
 *   outFile?: string,
 *   leadStatusFilter?: string,
 *   directoryHubs?: string[] | null,
 *   preserveMdOffices?: boolean,
 *   markZohoRowsAsOd?: boolean,
 *   zohoSyncSource?: string,
 * }} opts
 */
function rebuildManifestFromRows(opts) {
  const absOut = resolveManifestPath(opts.outFile);
  const prev = readExistingManifest(absOut);

  const aliases =
    prev.aliases && typeof prev.aliases === 'object' && !Array.isArray(prev.aliases)
      ? { .../** @type {Record<string, string>} */ (prev.aliases) }
      : {};

  const directoryPages =
    prev.directoryPages &&
    typeof prev.directoryPages === 'object' &&
    !Array.isArray(prev.directoryPages)
      ? prev.directoryPages
      : defaultDirectoryPages();

  const existingOffices = Array.isArray(prev.offices) ? prev.offices : [];
  const built = buildOfficesFromMasterRows({
    rows: opts.rows,
    leadStatusFilter: opts.leadStatusFilter,
    existingOffices,
    directoryHubs: opts.directoryHubs,
    markAsOd: Boolean(opts.markZohoRowsAsOd),
    syncSource: opts.zohoSyncSource || undefined,
  });

  let offices = built.offices;
  let mdPreserved = 0;
  if (opts.preserveMdOffices) {
    const zohoSlugs = new Set(offices.map((o) => String(o.slug || '').toLowerCase()).filter(Boolean));
    const kept = existingOffices.filter((row) => {
      if (!isMdManifestOffice(row)) return false;
      const sk = String(/** @type {Record<string, unknown>} */ (row).slug || '').toLowerCase();
      return sk && !zohoSlugs.has(sk);
    });
    mdPreserved = kept.length;
    offices = [...offices, ...kept];
  }

  const payload = {
    directoryPages,
    aliases,
    offices,
  };

  writeManifest(absOut, payload);

  return {
    manifestPath: absOut,
    officeCount: offices.length,
    odOfficeCount: built.offices.length,
    mdPreserved,
    skipped: built.skipped,
    leadSkipped: built.leadSkipped,
    slugPreserved: built.slugPreserved,
  };
}

module.exports = {
  slugify,
  formatAddressLine,
  buildRawBlock,
  resolveManifestPath,
  readExistingManifest,
  defaultDirectoryPages,
  isMdManifestOffice,
  buildOfficesFromMasterRows,
  writeManifest,
  rebuildManifestFromRows,
  pickField,
};
