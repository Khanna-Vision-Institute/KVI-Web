'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'heritage_family_page.md');
const OUT = path.join(ROOT, 'heritage_family_referral_partners.csv');

function slugify(displayName) {
  return displayName
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/\+/g, '')
    .replace(/\//g, '-')
    .replace(/\s*&\s*/g, ' ')
    .replace(/\s*\|\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeCsvCell(s) {
  const t = String(s ?? '');
  if (/[",\r\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

const raw = fs.readFileSync(SRC, 'utf8');
const lines = raw.split(/\r?\n/);

let i = lines.findIndex((l) => l.trim() === 'Search');
if (i === -1) throw new Error('Could not find Search marker');
i += 1;

const rows = [];
for (; i < lines.length; i += 1) {
  const name = lines[i]?.trim();
  if (!name || name === '▼') continue;
  const countLine = lines[i + 1]?.trim();
  const wedge = lines[i + 2]?.trim();
  if (!countLine || wedge !== '▼') continue;
  const m = countLine.match(/^(\d+)\s+physicians?$/i);
  if (!m) continue;
  const n = parseInt(m[1], 10);
  const link = `https://khannainstitute.com/${slugify(name)}`;
  rows.push({
    doctor_name: n === 1 ? name : '',
    clinic: name,
    physician_count: n,
    unique_link: link,
  });
  i += 2;
}

const header = ['doctor_name', 'clinic', 'physician_count', 'unique_link'];
const csv =
  header.join(',') +
  '\n' +
  rows.map((r) =>
    [r.doctor_name, r.clinic, r.physician_count, r.unique_link].map(escapeCsvCell).join(',')
  ).join('\n') +
  '\n';

fs.writeFileSync(OUT, csv, 'utf8');
console.log(`Wrote ${rows.length} rows to ${OUT}`);
