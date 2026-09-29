/**
 * Site phone configuration (single source of truth for phone links rendered by EJS).
 * Exposed to templates as `sitePhone` via app.locals in server.js.
 *
 * Header/footer call link: the Beverly Hills office main, (310) 482-1240.
 * Only the two office mains are displayed on the site: (310) 482-1240 and (805) 230-2126.
 * Website tracking numbers live in config/call-tracking.js (swap pool, OFF) and are never
 * displayed as static numbers.
 */
const HEADER_FOOTER_TEL = '+13104821240';
const HEADER_FOOTER_DISPLAY = '(310) 482-1240';

module.exports = {
  HEADER_FOOTER_TEL,
  HEADER_FOOTER_DISPLAY,
  HEADER_FOOTER_TEL_HREF: `tel:${HEADER_FOOTER_TEL}`,
};
