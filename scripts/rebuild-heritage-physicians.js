#!/usr/bin/env node
/**
 * Replace Heritage MD/DO rows in referral-offices.json from:
 *   - data/heritage-mdvip-physicians.json
 *   - data/khanna-referral-targets.json (Khanna Vision referral targets)
 *
 *   node scripts/rebuild-heritage-physicians.js
 */
const fs = require('fs');
const path = require('path');

const MDVIP_SRC = path.join(__dirname, '..', 'data', 'heritage-mdvip-physicians.json');
const TARGETS_SRC = path.join(__dirname, '..', 'data', 'khanna-referral-targets.json');
const TARGETS_FALLBACK = path.join(
  __dirname,
  '..',
  '..',
  'Khanna_Vision_Referral_Targets.json'
);
const MANIFEST = path.join(__dirname, '..', 'data', 'referral-offices.json');

function isHeritageMdRow(o) {
  if (!o || typeof o !== 'object') return false;
  const hubs = o.directory_hubs || o.directoryHubs;
  if (!Array.isArray(hubs) || !hubs.includes('HeritageFamily')) return false;
  const pt = String(o.provider_type || o.providerType || '').toLowerCase();
  if (pt === 'md' || pt === 'physician') return true;
  const slug = String(o.slug || '').toLowerCase();
  return (
    slug.startsWith('mdvip-') ||
    slug.startsWith('heritage-md-') ||
    slug.startsWith('heritage-target-')
  );
}

function normalizePhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
  return d.length === 10 ? d : '';
}

function formatPhone(p) {
  const d = normalizePhone(p);
  if (!d) return String(p || '').trim();
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function normalizeName(n) {
  return String(n || '')
    .toLowerCase()
    .replace(/^dr\.?\s+/, '')
    .replace(/,?\s*(md|do|facc|facp|faafp|faafm|ms|facs)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function slugify(...parts) {
  return parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function parsePracticePhysician(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/\s+[—–-]\s+/);
  if (m) {
    const idx = s.search(/\s+[—–-]\s+/);
    return {
      practice: s.slice(0, idx).trim(),
      doctor: s.slice(idx).replace(/^\s+[—–-]\s+/, '').trim()
    };
  }
  if (/^dr\.?\s/i.test(s)) return { practice: '', doctor: s };
  return { practice: s, doctor: s };
}

function ensureMdSuffix(name) {
  const n = String(name || '').trim();
  if (!n) return n;
  if (/\b(MD|DO)\b/i.test(n)) return n;
  return n.includes(',') ? `${n} MD` : `${n}, MD`;
}

function zoneHub(zone, city) {
  if (zone === 'BH') return 'Beverly Hills';
  if (zone === 'WLV') return 'Westlake Village';
  return city || '';
}

function targetToPhysician(t) {
  const parsed = parsePracticePhysician(t['Practice / Physician']);
  const doctorName = ensureMdSuffix(parsed.doctor || t['Practice / Physician']);
  const practiceName = parsed.practice || t.City || 'Referral partner';
  const city = String(t.City || '').trim();
  const addressLine = String(t.Address || '').trim();
  const phone = formatPhone(t.Phone);
  const specialty = String(t.Type || '').trim();
  const hub = zoneHub(t.Zone, city);

  const slug = `heritage-target-${slugify(normalizeName(doctorName), city || hub)}`;

  return {
    slug,
    doctor_name: doctorName,
    practice_name: practiceName,
    address_line: addressLine,
    phone,
    specialty,
    directory_hub: hub
  };
}

function loadTargets() {
  const src = fs.existsSync(TARGETS_SRC)
    ? TARGETS_SRC
    : fs.existsSync(TARGETS_FALLBACK)
      ? TARGETS_FALLBACK
      : null;
  if (!src) {
    console.warn('[rebuild-heritage] No referral targets file found; skipping targets merge.');
    return [];
  }
  const raw = JSON.parse(fs.readFileSync(src, 'utf8'));
  const list = Array.isArray(raw) ? raw : [];
  console.log(`[rebuild-heritage] Loaded ${list.length} referral targets from ${src}`);
  return list.map(targetToPhysician);
}

function loadMdvip() {
  const payload = JSON.parse(fs.readFileSync(MDVIP_SRC, 'utf8'));
  return Array.isArray(payload.physicians) ? payload.physicians : [];
}

function isDuplicate(existing, candidate) {
  const cName = normalizeName(candidate.doctor_name);
  const cPhone = normalizePhone(candidate.phone);
  for (const row of existing) {
    const eName = normalizeName(row.doctor_name);
    const ePhone = normalizePhone(row.phone);
    if (cName && eName && cName === eName) return true;
    if (cPhone && ePhone && cPhone === ePhone) return true;
  }
  return false;
}

function mergePhysicians(mdvipList, targetList) {
  const merged = [...mdvipList];
  const usedSlugs = new Set(merged.map((r) => String(r.slug || '').toLowerCase()));
  let added = 0;
  let skipped = 0;

  for (const row of targetList) {
    if (isDuplicate(merged, row)) {
      skipped += 1;
      continue;
    }
    let slug = row.slug;
    let n = 2;
    while (usedSlugs.has(slug.toLowerCase())) {
      slug = `${row.slug}-${n}`;
      n += 1;
    }
    usedSlugs.add(slug.toLowerCase());
    merged.push({ ...row, slug });
    added += 1;
  }

  return { merged, added, skipped };
}

function toOffice(row) {
  const doctorName = row.doctor_name;
  const practiceName = row.practice_name;
  const addressLine = row.address_line || '';
  const specialty = row.specialty || '';
  const phone = row.phone || '';
  const rawBlock = [doctorName, practiceName, specialty, addressLine, phone].filter(Boolean).join('\n');

  return {
    slug: row.slug,
    doctor_name: doctorName,
    practice_name: practiceName,
    credentials: '',
    address_line: addressLine,
    phone,
    raw_block: rawBlock,
    provider_type: 'md',
    directory_hubs: ['HeritageFamily']
  };
}

function main() {
  const mdvip = loadMdvip();
  const targets = loadTargets();
  const { merged, added, skipped } = mergePhysicians(mdvip, targets);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  const kept = (manifest.offices || []).filter((o) => !isHeritageMdRow(o));
  const mdRows = merged.map(toOffice);

  manifest.directoryPages = manifest.directoryPages || {};
  manifest.directoryPages.HeritageFamily = {
    title: 'Doctor outreach',
  };

  manifest.offices = [...kept, ...mdRows];
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`MDVIP physicians: ${mdvip.length}`);
  console.log(`Referral targets: added ${added}, skipped duplicates ${skipped}`);
  console.log(`Total Heritage MD/DO in manifest: ${mdRows.length}`);
  console.log(`Total offices in manifest: ${manifest.offices.length}`);
}

main();
