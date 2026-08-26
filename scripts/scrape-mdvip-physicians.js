#!/usr/bin/env node
/**
 * Scrape MDVIP CA directory listing pages → data/heritage-mdvip-physicians.json
 *
 * Phones are read from each doctor card on the listing page (###.###.#### or tel: links).
 * Anonymous "Internal Medicine only" cards (no doctor name) are skipped.
 *
 *   node scripts/scrape-mdvip-physicians.js
 *   node scripts/scrape-mdvip-physicians.js --merge   # runs rebuild-heritage-physicians.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const axios = require('axios');
const cheerio = require('cheerio');

const PAGES = [
  { area: 'Agoura Hills', url: 'https://www.mdvip.com/physicians-directory/ca/agoura-hills' },
  { area: 'Beverly Hills', url: 'https://www.mdvip.com/physicians-directory/ca/beverly-hills' },
  { area: 'Los Angeles', url: 'https://www.mdvip.com/physicians-directory/ca/los-angeles' },
  { area: 'Pasadena', url: 'https://www.mdvip.com/physicians-directory/ca/pasadena' },
  { area: 'Rancho Cucamonga', url: 'https://www.mdvip.com/physicians-directory/ca/rancho-cucamonga' },
  { area: 'Sherman Oaks', url: 'https://www.mdvip.com/physicians-directory/ca/sherman-oaks' },
  { area: 'Tarzana', url: 'https://www.mdvip.com/physicians-directory/ca/tarzana' },
  { area: 'Thousand Oaks', url: 'https://www.mdvip.com/physicians-directory/ca/thousand-oaks' },
  { area: 'West Hills', url: 'https://www.mdvip.com/physicians-directory/ca/west-hills' }
];

const OUT = path.join(__dirname, '..', 'data', 'heritage-mdvip-physicians.json');

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110);
}

function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  let ten = d;
  if (ten.length === 11 && ten.charAt(0) === '1') ten = ten.slice(1);
  if (ten.length === 10) {
    return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  }
  return '';
}

function cityFromAddress(addressLine) {
  const m = String(addressLine || '').match(/,\s*([^,]+),\s*CA\s*$/i);
  return m ? m[1].trim() : '';
}

/** Must include comma before MD/DO and look like a person name */
function looksLikeDoctorName(line) {
  const s = String(line || '').trim();
  if (!/\b(MD|DO)\b/.test(s)) return false;
  if (/^Internal Medicine$/i.test(s)) return false;
  if (/View Profile|Join Now|Offers Wellness/i.test(s)) return false;
  if (s.length < 8 || s.length > 90) return false;
  return /^[A-Z]/.test(s) && /,\s*(MD|DO)/.test(s);
}

function extractPhoneFromText(text) {
  const tel = text.match(/href=["']tel:([^"']+)["']/i);
  if (tel) {
    const n = normalizePhone(tel[1]);
    if (n) return n;
  }
  const dotted = text.match(/\b(\d{3})\.(\d{3})\.(\d{4})\b/);
  if (dotted) return normalizePhone(dotted[0]);
  const paren = text.match(/\(\d{3}\)\s*\d{3}[-–]\d{4}/);
  if (paren) return normalizePhone(paren[0]);
  return '';
}

function parseCardsFromHtml(html, hubArea) {
  const $ = cheerio.load(html);
  const found = [];
  const seen = new Set();

  /** Try structured cards first */
  const cardSelectors = [
    '.physician-card',
    '.doctor-card',
    '[class*="PhysicianCard"]',
    '[class*="doctor-card"]',
    'article'
  ];

  for (const sel of cardSelectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!text || text.length < 20) return;

      const nameMatch = text.match(
        /([A-Z][A-Za-z.'-]+(?:\s+[A-Z]\.?)?\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)?,\s*(?:MD|DO)(?:,\s*[A-Z][A-Za-z.,\s]+)?)/
      );
      if (!nameMatch) return;
      const doctorName = nameMatch[1].trim();
      if (!looksLikeDoctorName(doctorName)) return;

      let specialty = 'Internal Medicine';
      const specM = text.match(
        /(?:MD|DO)(?:,\s*[A-Z][A-Za-z.,\s]+)?\s+(Internal Medicine|Family Medicine|Cardiology[^,]*)/i
      );
      if (specM) specialty = specM[1].replace(/\s+/g, ' ').trim();

      const addrM = text.match(
        /(\d{1,5}\s+[\w\s.'#-]+(?:Suite|Ste|#)\s*[\w\d-]+),?\s*([A-Za-z .]+),\s*CA/i
      );
      const addressLine = addrM
        ? `${addrM[1].replace(/\s+/g, ' ').trim()}, ${addrM[2].trim()}, CA`
        : '';

      const phone = extractPhoneFromText($(el).html() || text);
      const practiceName = cityFromAddress(addressLine) || hubArea;
      const key = `${doctorName.toLowerCase()}|${addressLine.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);

      const profileHref =
        $(el).find('a[href*="/doctors/"]').attr('href') ||
        $(el).find('a[href*="/doctor/"]').attr('href') ||
        '';

      found.push({
        slug: `heritage-md-${slugify(`${doctorName}-${practiceName}`)}`,
        doctor_name: doctorName,
        practice_name: practiceName,
        address_line: addressLine,
        phone,
        specialty,
        directory_hub: hubArea,
        profile_path: profileHref
          ? profileHref.startsWith('http')
            ? profileHref
            : `https://www.mdvip.com${profileHref}`
          : ''
      });
    });
    if (found.length) return found;
  }

  /** Fallback: split HTML/text blocks before "View Profile" */
  const plain = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '\n');
  const chunks = plain.split(/View Profile/i);

  for (const chunk of chunks) {
    const lines = chunk
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      if (!looksLikeDoctorName(lines[i])) continue;
      const doctorName = lines[i];
      let specialty = 'Internal Medicine';
      let addressLine = '';
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j += 1) {
        const nxt = lines[j];
        if (/Medicine|Cardiology/i.test(nxt) && nxt.length < 80 && !/\d/.test(nxt)) {
          specialty = nxt;
        }
        const am = nxt.match(/(\d{1,5}\s+.+),\s*([A-Za-z .]+),\s*CA/i);
        if (am && !addressLine) {
          addressLine = `${am[1].replace(/\s+/g, ' ').trim()}, ${am[2].trim()}, CA`;
        }
      }
      const phone = extractPhoneFromText(chunk);
      const practiceName = cityFromAddress(addressLine) || hubArea;
      const key = `${doctorName.toLowerCase()}|${addressLine.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      found.push({
        slug: `heritage-md-${slugify(`${doctorName}-${practiceName}`)}`,
        doctor_name: doctorName,
        practice_name: practiceName,
        address_line: addressLine,
        phone,
        specialty,
        directory_hub: hubArea,
        profile_path: ''
      });
    }
  }

  return found;
}

async function scrapeAll() {
  const byKey = new Map();

  for (const page of PAGES) {
    process.stdout.write(`Fetching ${page.area}… `);
    try {
      const res = await axios.get(page.url, {
        timeout: 45000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KVI-HeritageDirectory/1.2)',
          Accept: 'text/html,application/xhtml+xml'
        },
        validateStatus: () => true
      });
      if (res.status >= 400) {
        console.log(`HTTP ${res.status}`);
        continue;
      }
      const rows = parseCardsFromHtml(res.data, page.area);
      let added = 0;
      for (const row of rows) {
        const key = `${row.doctor_name.toLowerCase()}|${row.address_line.toLowerCase()}`;
        if (!byKey.has(key)) {
          byKey.set(key, row);
          added += 1;
        } else if (row.phone && !byKey.get(key).phone) {
          byKey.set(key, { ...byKey.get(key), phone: row.phone });
        }
      }
      console.log(`${added} named (${rows.length} parsed)`);
    } catch (err) {
      console.log(`error: ${err.message || err}`);
    }
  }

  return [...byKey.values()];
}

async function main() {
  const merge = process.argv.includes('--merge');
  const physicians = await scrapeAll();

  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        scraped_at: new Date().toISOString(),
        source: 'MDVIP CA directory listing pages (card phones when present)',
        source_pages: PAGES.map((p) => p.url),
        count: physicians.length,
        physicians
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\nWrote ${physicians.length} physicians → ${OUT}`);

  if (merge) {
    execFileSync(process.execPath, [path.join(__dirname, 'rebuild-heritage-physicians.js')], {
      stdio: 'inherit'
    });
  } else {
    console.log('Run: node scripts/rebuild-heritage-physicians.js');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
