#!/usr/bin/env node
/**
 * Fetch office phones from physician profile pages and refresh Heritage MD rows.
 *
 *   node scripts/enrich-heritage-physician-phones.js
 *   node scripts/enrich-heritage-physician-phones.js --merge
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const DATA = path.join(__dirname, '..', 'data', 'heritage-mdvip-physicians.json');
const MANIFEST = path.join(__dirname, '..', 'data', 'referral-offices.json');

/** slug → mdvip.com/doctors/{handle} */
const PROFILE_HANDLES = {
  'mdvip-jessica-adkins-md-facp-thousand-oaks': 'jessicaadkinsmd',
  'mdvip-irina-feldman-md-faafm-thousand-oaks': 'irinafeldmanmd',
  'mdvip-hema-v-nathan-md-thousand-oaks': 'hemanathanmd',
  'mdvip-linda-m-gerrits-md-westlake-village': 'lindamgerritsmd',
  'mdvip-francoise-menteer-md-facp-thousand-oaks': 'francoisementeermd',
  'mdvip-gary-h-nudell-md-west-hills': 'garynudellmd',
  'mdvip-marc-i-lavin-md-facp-west-hills': 'marclavinmd',
  'mdvip-david-m-filsoof-md-beverly-hills': 'davidfilsoofmd',
  'mdvip-sam-setareh-md-ms-facc-beverly-hills': 'samsetarehmd',
  'mdvip-gerald-m-kovar-md-tarzana': 'geraldkovarmd',
  'mdvip-edmund-h-lew-md-faafp-los-angeles': 'edmundlewmd',
  'mdvip-steven-a-drell-md-sherman-oaks': 'stevedrellmd',
  'mdvip-john-a-fagan-md-rancho-cucamonga': 'johnfaganmd'
};

function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  let ten = d;
  if (ten.length === 11 && ten.charAt(0) === '1') ten = ten.slice(1);
  if (ten.length === 10) {
    return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  }
  return String(raw || '').trim();
}

function extractPhoneFromHtml(html) {
  const $ = cheerio.load(html);
  const tel = $('a[href^="tel:"]').first().attr('href') || '';
  if (tel) {
    const m = tel.replace(/^tel:/i, '').trim();
    const n = normalizePhone(m);
    if (n) return n;
  }

  const text = $.text();
  const officeIdx = text.indexOf('The office of');
  const slice = officeIdx >= 0 ? text.slice(officeIdx, officeIdx + 600) : text.slice(0, 8000);
  const m =
    slice.match(/\(\d{3}\)\s*\d{3}[-–]\d{4}/) ||
    slice.match(/\b\d{3}\.\d{3}\.\d{4}\b/) ||
    text.match(/\(\d{3}\)\s*\d{3}[-–]\d{4}/);
  if (m) return normalizePhone(m[0]);

  return '';
}

function areaPracticeName(area, cityHint) {
  const a = String(area || '').trim();
  if (cityHint && String(cityHint).toLowerCase().includes('westlake')) return 'Westlake Village';
  return a || 'California';
}

async function fetchPhone(handle) {
  const url = `https://www.mdvip.com/doctors/${handle}`;
  const res = await axios.get(url, {
    timeout: 45000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KVI-HeritageDirectory/1.1)' },
    validateStatus: () => true
  });
  if (res.status >= 400) return { phone: '', profileUrl: url, status: res.status };
  return { phone: extractPhoneFromHtml(res.data), profileUrl: url, status: res.status };
}

function toManifestOffice(row) {
  const doctorName = row.doctor_name;
  const practiceName = row.practice_name;
  const addressLine = row.address_line || '';
  const specialty = row.specialty || '';
  const rawBlock = [doctorName, practiceName, specialty, addressLine, row.phone || ''].filter(Boolean).join('\n');
  return {
    slug: row.slug,
    doctor_name: doctorName,
    practice_name: practiceName,
    credentials: '',
    address_line: addressLine,
    phone: row.phone || '',
    raw_block: rawBlock,
    provider_type: 'md',
    directory_hubs: ['HeritageFamily']
  };
}

function mergeManifest(physicians) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const bySlug = new Map();
  for (const o of manifest.offices || []) {
    if (o && o.slug) bySlug.set(String(o.slug).toLowerCase(), o);
  }
  for (const row of physicians) {
    const office = toManifestOffice(row);
    const key = office.slug.toLowerCase();
    bySlug.set(key, { ...(bySlug.get(key) || {}), ...office });
  }
  manifest.offices = [...bySlug.values()];
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function main() {
  const merge = process.argv.includes('--merge');
  const payload = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const physicians = Array.isArray(payload.physicians) ? payload.physicians : [];

  for (const row of physicians) {
    const handle = PROFILE_HANDLES[row.slug];
    const area = row.mdvip_area || row.practice_name?.replace(/^MDVIP\s*—\s*/i, '') || '';
    row.practice_name = areaPracticeName(area, row.address_line);
    row.credentials = '';

    if (!handle) continue;
    process.stdout.write(`${row.doctor_name}… `);
    try {
      const { phone, status } = await fetchPhone(handle);
      if (phone) row.phone = phone;
      console.log(status >= 400 ? `HTTP ${status}` : phone || '(no phone found)');
    } catch (err) {
      console.log(`error: ${err.message || err}`);
    }
  }

  payload.scraped_at = new Date().toISOString();
  payload.note = 'Heritage MD/DO roster — practice grouped by city/area; phones from public profile pages.';
  fs.writeFileSync(DATA, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`\nUpdated ${DATA}`);

  if (merge) {
    mergeManifest(physicians);
    console.log(`Merged ${physicians.length} rows → ${MANIFEST}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
