#!/usr/bin/env node
/**
 * Builds data/referral-offices.json from a doctors export array (same shape as doctors.json).
 *
 * Usage:
 *   node scripts/build-referral-offices-manifest.js \
 *     --input="/path/to/doctors.json" \
 *     [--out="data/referral-offices.json"] \
 *     [--aliases="/path/to/aliases.json"]
 *
 * Optional aliases.json may be `{ "aliases": { "marketing_slug": "canonical-slug-or-target" }, "aliasList": [...] }`
 * or `{ "marketing_slug": "canonical-slug" }` plain object merges.
 *
 * The output file merges with an existing **`--out`** when present so you do **not**
 * accidentally drop **`directoryPages`** (!) or **`aliases`** (aliases are only overwritten when **`--aliases=...`**).
 */
const fs = require('fs');
const path = require('path');

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => typeof a === 'string' && a.startsWith(prefix));
  if (!hit) return fallback;
  return hit.slice(prefix.length).replace(/^[\"']|[\"']$/g, '').trim();
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** @param {unknown} row */
/** @returns {string} */
function deriveAddressLine(row) {
  const lineFromExport = typeof row.address_line === 'string' ? row.address_line.trim() : '';
  const rb = typeof row.raw_block === 'string' ? row.raw_block.trim() : '';
  const lines = rb.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 3 && lineFromExport) {
    const street = lines[2];
    if (street && !/^https?:\/\//i.test(street)) return `${street}, ${lineFromExport}`;
  }
  return lineFromExport;
}

/** @returns {Record<string,string>} normalized keys */
function normalizeAliasMap(record) {
  /** @type {Record<string,string>} */
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (!k || typeof v !== 'string') continue;
    const nk = k.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    const target = v.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    if (nk && target) out[nk] = target;
  }
  return out;
}

/** @param {string|null|undefined} filePathMaybe */
function loadAliasesMerged(filePathMaybe, logger) {
  /** @type {Record<string,string>} */
  const out = {};
  if (!filePathMaybe || typeof filePathMaybe !== 'string') return out;
  let p = filePathMaybe;
  if (!path.isAbsolute(p)) {
    p = path.resolve(process.cwd(), p);
  }
  if (!fs.existsSync(p)) {
    logger.warn('[build-referral-offices] Aliases file missing (skip):', p);
    return out;
  }

  /** @type {unknown} */
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    logger.warn('[build-referral-offices] Bad JSON aliases file:', p, String(e && e.message ? e.message : e));
    return out;
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  /** @type {Record<string, unknown>} */
  const root = /** @type {Record<string, unknown>} */ (raw);

  if (root.aliases && typeof root.aliases === 'object' && !Array.isArray(root.aliases)) {
    Object.assign(out, normalizeAliasMap(/** @type {Record<string,string>} */ (root.aliases)));
  }

  /** @type {unknown[]} */
  const list =
    typeof root.aliasList === 'object' && Array.isArray(root.aliasList) ? root.aliasList : [];

  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    /** @type {Record<string, unknown>} */
    const rr = /** @type {Record<string, unknown>} */ (row);

    /** Prefer explicit CamelCase-like marketing slugs from `marketingSlug` */
    let fromKey = '';
    if (typeof rr.marketingSlug === 'string') {
      fromKey = rr.marketingSlug.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    }
    if (!fromKey && typeof rr.from === 'string') {
      const rawFrom = rr.from.trim();
      fromKey = /\s/.test(rawFrom) ? slugify(rawFrom) : rawFrom.toLowerCase().replace(/^\/+|\/+$/g, '');
    }

    /** @type {string} */
    let toCanon = '';
    if (typeof rr.slug === 'string') toCanon = rr.slug.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    if (!toCanon && typeof rr.to === 'string') {
      const t = rr.to.trim();
      if (/\s/.test(t)) toCanon = slugify(t);
      else toCanon = t.toLowerCase().replace(/^\/+|\/+$/g, '');
    }
    if (!toCanon && typeof rr.canonicalSlug === 'string') {
      toCanon = rr.canonicalSlug.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    }

    if (fromKey && toCanon) out[fromKey] = toCanon;
  }

  console.log('[build-referral-offices] Aliases merged:', Object.keys(out).length, 'from', p);
  return out;
}

function main() {
  const logger = console;
  const input = readArg('input', '');
  const outFile = readArg('out', path.join('data', 'referral-offices.json'));
  const aliasesPath = readArg('aliases', '').trim();

  if (!input) {
    logger.error('Missing --input="/path/to/doctors.json"');
    process.exitCode = 1;
    return;
  }

  const absIn = path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
  const absOut = path.isAbsolute(outFile) ? outFile : path.resolve(process.cwd(), outFile);

  /** @type {unknown} */
  let doctors;
  try {
    doctors = JSON.parse(fs.readFileSync(absIn, 'utf8'));
  } catch (e) {
    logger.error('[build-referral-offices] Failed to read:', absIn, String(e && e.message ? e.message : e));
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(doctors)) {
    logger.error('[build-referral-offices] Input must be a JSON array:', absIn);
    process.exitCode = 1;
    return;
  }

  /** @type {Set<string>} */
  const usedSlugs = new Set();

  /**
   * @param {string} practice
   * @param {string} doctor
   */
  function allocSlug(practice, doctor) {
    const base = slugify(`${practice}-${doctor}`);
    if (!base) return null;
    let candidate = base;
    let i = 2;
    while (usedSlugs.has(candidate)) {
      candidate = `${base}-${i}`;
      i += 1;
      if (i > 200) throw new Error('Slug collision exhaustion');
    }
    usedSlugs.add(candidate);
    return candidate;
  }

  /** @type {unknown[]} */
  const officesOut = [];

  for (const rowRaw of doctors) {
    if (!rowRaw || typeof rowRaw !== 'object') continue;
    /** @type {Record<string, unknown>} */
    const row = /** @type {Record<string, unknown>} */ (rowRaw);

    const practice = typeof row.practice_name === 'string' ? row.practice_name : '';
    const doctor = typeof row.doctor_name === 'string' ? row.doctor_name : '';
    const canonical = allocSlug(practice, doctor);
    if (!canonical) continue;

    /** @type {Record<string, unknown>} */
    const o = {
      slug: canonical,
      doctor_name: doctor,
      practice_name: practice,
      address_line: deriveAddressLine(row),
      phone: typeof row.phone === 'string' ? row.phone : '',
      raw_block: typeof row.raw_block === 'string' ? row.raw_block.slice(0, 4000) : '',
    };

    if (typeof row.credentials === 'string' && row.credentials.trim()) {
      o.credentials = row.credentials.trim();
    }

    if (Array.isArray(row.directory_hubs)) {
      /** @type {string[]} */
      const dh = row.directory_hubs
        .filter((x) => typeof x === 'string')
        .map((/** @type {unknown} */ s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 50);
      if (dh.length) {
        o.directory_hubs = dh;
      }
    }

    officesOut.push(o);
  }

  /** @type {Record<string, unknown> | null} */
  let prevManifest = null;
  if (fs.existsSync(absOut)) {
    try {
      const p = JSON.parse(fs.readFileSync(absOut, 'utf8'));
      if (p && typeof p === 'object' && !Array.isArray(p)) prevManifest = p;
    } catch (_) {
      logger.warn('[build-referral-offices] Existing `--out` file not valid JSON; skipping merge metadata:', absOut);
    }
  }

  /** @type {Record<string, string>} */
  let mergedAliases = {};
  if (aliasesPath && aliasesPath.trim()) {
    mergedAliases = loadAliasesMerged(aliasesPath, logger);
  } else if (
    prevManifest &&
    prevManifest.aliases &&
    typeof prevManifest.aliases === 'object' &&
    !Array.isArray(prevManifest.aliases)
  ) {
    mergedAliases = /** @type {Record<string, string>} */ ({ ...prevManifest.aliases });
  }

  /** @type {Record<string, unknown>} */
  const payload = {};

  if (
    prevManifest &&
    prevManifest.directoryPages &&
    typeof prevManifest.directoryPages === 'object' &&
    !Array.isArray(prevManifest.directoryPages)
  ) {
    payload.directoryPages = prevManifest.directoryPages;
  }

  payload.aliases = mergedAliases;
  payload.offices = officesOut;

  if (!payload.directoryPages) {
    logger.warn(
      '[build-referral-offices] `directoryPages` is missing — hub URLs like `/HeritageFamily` will 404 until you define `directoryPages` in referral-offices.json.'
    );
  }

  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(payload, null, 2));

  logger.log('[build-referral-offices] Wrote:', absOut);
  logger.log('[build-referral-offices] Offices:', officesOut.length);
  logger.log('[build-referral-offices] Aliases:', Object.keys(mergedAliases).length);
}

main();
