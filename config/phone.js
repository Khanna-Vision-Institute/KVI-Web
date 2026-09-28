/**
 * Site phone configuration (single source of truth for phone links rendered by EJS).
 * Exposed to templates as `sitePhone` via app.locals in server.js.
 *
 * Header/footer call link.
 * HEADER_FOOTER_TEL is the office number, (310) 482-1240. The previous header/footer
 * number (the 677 exchange) was NOT a CallRail tracking number, per the CallRail
 * account check on Sep 26, 2026, so it is no longer used or masked.
 * Keep this constant so the href can be changed in one place if a tracking number is adopted later.
 */
const HEADER_FOOTER_TEL = '+13104821240';
const HEADER_FOOTER_DISPLAY = '(310) 482-1240';

/**
 * Black Friday landing pages (black-friday/*.html).
 * BLACK_FRIDAY_TEL is a CallRail tracking number (source: Hootsuite / Google My Business;
 * CallRail swap target 805-230-2126), intentionally MASKED: visitors see
 * BLACK_FRIDAY_DISPLAY, (805) 230-2126, while the tel: link dials the tracking number
 * so CallRail keeps attributing these calls.
 * Never put the tracking number in JSON-LD/schema; schema telephone stays +1-805-230-2126.
 */
const BLACK_FRIDAY_TEL = '+18052227974';
const BLACK_FRIDAY_DISPLAY = '(805) 230-2126';

/**
 * CallRail dynamic number insertion (swap.js), DRAFTED BUT DISABLED.
 * partials/footer.ejs renders the script only when CALLRAIL_SWAP_ENABLED is true.
 * BEFORE ENABLING: the CallRail swap targets for the website pools (currently 310-997-4490,
 * a number no longer on the site) must be changed to (310) 482-1240 in the CallRail account,
 * and Khanna must approve. Otherwise swap.js finds nothing to swap for the 310 pools.
 * Note: the 805 pools target 805-230-2126, so swap.js would also rewrite visible
 * (805) 230-2126 numbers (including the masked Black Friday links) with pool numbers.
 * URL verified from backups/callrail-phone-20260824-141221/partials/footer.ejs (company 338313285).
 */
const CALLRAIL_SWAP_ENABLED = false;
const CALLRAIL_SWAP_SRC = '//cdn.callrail.com/companies/338313285/6c91af4b028c9b9ab984/12/swap.js';

module.exports = {
  HEADER_FOOTER_TEL,
  HEADER_FOOTER_DISPLAY,
  HEADER_FOOTER_TEL_HREF: `tel:${HEADER_FOOTER_TEL}`,
  BLACK_FRIDAY_TEL,
  BLACK_FRIDAY_DISPLAY,
  BLACK_FRIDAY_TEL_HREF: `tel:${BLACK_FRIDAY_TEL}`,
  CALLRAIL_SWAP_ENABLED,
  CALLRAIL_SWAP_SRC,
};
