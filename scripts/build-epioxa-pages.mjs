import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const wSrc = '/Users/nisha/Downloads/Westlake village _ Epioxa CXL Keratoconsu.html';
const bSrc = '/Users/nisha/Downloads/epioxa-beverly-hills.html';
const wDst = path.join(repoRoot, 'procedures/specialty-treatments/epioxa-westlake-village.html');
const bDst = path.join(repoRoot, 'procedures/specialty-treatments/epioxa-beverly-hills.html');

function stripWww(s) {
  return s.split('https://www.khannainstitute.com').join('https://khannainstitute.com');
}

let w = fs.readFileSync(wSrc, 'utf8');
w = w
  .split('https://www.khannainstitute.com/epioxa-epi-on-cross-linking-westlake-village')
  .join('https://khannainstitute.com/procedures/specialty-treatments/epioxa-westlake-village');
w = stripWww(w);
fs.writeFileSync(wDst, w);

let b = fs.readFileSync(bSrc, 'utf8');
b = b
  .split('https://www.khannainstitute.com/epioxa-epi-on-cross-linking-beverly-hills')
  .join('https://khannainstitute.com/procedures/specialty-treatments/epioxa-beverly-hills');
b = b
  .split('https://www.khannainstitute.com/epioxa-epi-on-cross-linking-westlake-village')
  .join('https://khannainstitute.com/procedures/specialty-treatments/epioxa-westlake-village');
b = stripWww(b);
fs.writeFileSync(bDst, b);

console.log('Wrote', wDst, fs.statSync(wDst).size, 'bytes');
console.log('Wrote', bDst, fs.statSync(bDst).size, 'bytes');
