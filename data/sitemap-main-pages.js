/**
 * Main-pages sitemap data (served at /main-pages-sitemap.xml by server.js).
 * Reconstructed from the live https://khannainstitute.com/main-pages-sitemap.xml (fetched Sep 26, 2026):
 * 54 URLs, every <lastmod> 2026-09-23 and <changefreq> weekly. Order and priorities match live.
 * Live generates this with res.send() (content-hash ETag, no Last-Modified), so it is generated here too.
 *
 * To publish a page: add [path, priority] below and bump MAIN_PAGES_LASTMOD.
 * NOTE: live lists some URLs that 301 or canonicalize elsewhere (insurance-info, insurance-coverage,
 * /contact/forms/, /khanna-booking, /privacy + /privacy/). Kept for parity; see the rebuild report.
 */
const MAIN_PAGES_LASTMOD = '2026-09-23';
const MAIN_PAGES_CHANGEFREQ = 'weekly';

// [path, priority]
const MAIN_PAGES = [
  ['/', '1.0'],
  ['/procedures/laser-vision/smile-pro-eye-surgery/', '0.9'],
  ['/procedures/laser-vision/smile/', '0.9'],
  ['/procedures/laser-vision/lasik/', '0.9'],
  ['/procedures/laser-vision/superlasik/', '0.9'],
  ['/procedures/laser-vision/asa/', '0.9'],
  ['/procedures/laser-vision/compare/', '0.9'],
  ['/procedures/lens-solutions/evo-icl/', '0.9'],
  ['/procedures/lens-solutions/pie/', '0.9'],
  ['/procedures/lens-solutions/robotic-cataract-surgery/', '0.9'],
  ['/procedures/lens-solutions/which-lens-is-right/', '0.9'],
  ['/procedures/specialty-treatments/cxl-keratoconus/', '0.9'],
  ['/procedures/specialty-treatments/ctak-keratoconus/', '0.9'],
  ['/procedures/specialty-treatments/epioxa-westlake-village/', '0.9'],
  ['/procedures/specialty-treatments/epioxa-beverly-hills/', '0.9'],
  ['/procedures/specialty-treatments/pterygium-surgery/', '0.9'],
  ['/procedures/specialty-treatments/dry-eye-solutions/', '0.9'],
  ['/procedures/specialty-treatments/chalazion-treatment/', '0.9'],
  ['/tools/am-i-a-candidate/', '0.7'],
  ['/tools/procedure-comparison/', '0.7'],
  ['/contact/schedule-consultation/', '0.7'],
  ['/about/dr-khanna/biography/', '0.8'],
  ['/about/dr-khanna/credentials-awards/', '0.8'],
  ['/about/dr-khanna/books/', '0.8'],
  ['/about/dr-khanna/media/', '0.8'],
  ['/about/why-choose-us/technology/', '0.6'],
  ['/about/why-choose-us/success-stories/', '0.6'],
  ['/about/why-choose-us/celebrity-patients/', '0.6'],
  ['/about/why-choose-us/gallery/', '0.6'],
  ['/about/locations/beverly-hills/', '0.9'],
  ['/about/locations/westlake-village/', '0.9'],
  ['/patients/your-journey/first-visit-guide/', '0.8'],
  ['/patients/your-journey/what-to-expect/', '0.8'],
  ['/patients/your-journey/recovery-timeline/', '0.8'],
  ['/patients/your-journey/post-op-care/', '0.8'],
  ['/patients/resources/faqs/', '0.8'],
  ['/patients/resources/insurance-info/', '0.8'],
  ['/patients/results/reviews/', '0.8'],
  ['/pricing-financing/procedure-costs/', '0.8'],
  ['/pricing-financing/insurance-coverage/', '0.8'],
  ['/patients/resources/financing-options/', '0.8'],
  ['/pricing-financing/calculator/', '0.8'],
  ['/pricing-financing/special-offers/', '0.8'],
  ['/blog/latest/', '0.7'],
  ['/blog/procedure-guides/', '0.7'],
  ['/contact/virtual-consultation/', '0.7'],
  ['/contact/forms/', '0.7'],
  ['/contact/emergency-care/', '0.7'],
  ['/khanna-gamified-forms', '0.6'],
  ['/khanna-booking', '0.6'],
  ['/privacy/', '0.3'],
  ['/privacy', '0.3'],
  ['/terms/', '0.3'],
  ['/data-deletion/', '0.3'],
];

module.exports = { MAIN_PAGES, MAIN_PAGES_LASTMOD, MAIN_PAGES_CHANGEFREQ };
