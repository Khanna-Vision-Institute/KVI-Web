/**
 * Serve-time robots-meta + canonical injector (reconstructed from live output, Sep 26, 2026).
 *
 * The live server adds these tags at serve time; no code for it was in GitHub. The rules below
 * were inferred by comparing live HTML with repo renders on ~110 URLs plus ~40 probe URLs
 * (details and uncertain cases: /workspace/reports/seo/rebuild-best-of-both.md, section 4e).
 *
 * Inferred live rules, reproduced as-is:
 *  1. Only HTML strings sent through res.send()/res.render() are touched. Files sent with
 *     express.static / res.sendFile (e.g. /public/*, /Doctorportal/*.html) are not.
 *  2. Existing canonical tags are re-serialized: <link rel="canonical" href="X" /> becomes
 *     <link rel="canonical" href="X">. Existing robots metas are left untouched.
 *  3. If the WHOLE document contains no name="robots", insert
 *       <meta name="robots" content="index, follow">
 *     or "noindex, follow" when the request path contains (case-insensitive) one of
 *     NOINDEX_PATH_PATTERNS.
 *  4. If the WHOLE document contains no rel="canonical", insert a self-canonical:
 *       <link rel="canonical" href="https://khannainstitute.com<request path>">
 *     using the raw request path: original case, trailing slash as requested, no query string.
 *  5. Inserted tags go right after the opening <head> tag, robots first, each on its own line
 *     indented by two spaces. Applies to every status code (including 404 pages).
 *
 *  6. Every <img> without a decoding attribute gets decoding="async" (inserted right after
 *     "<img"); if it also has no loading attribute it gets loading="lazy", except the first
 *     <img> in the document (likely LCP), which only gets decoding. Existing attributes are
 *     never changed. (Inferred: live shows this on repo templates AND on Strapi-sourced body
 *     content, so it is a serve-time transform, not a template edit.)
 *
 * Known live quirks kept for parity (fix only with owner sign-off):
 *  - Detection is document-wide, so a page whose inline JS merely contains the string
 *    rel="canonical" (many blog posts: $('link[rel="canonical"]')) gets NO canonical.
 *  - /index, /index.html, /coming-soon.html, uppercase variants and 404 pages get a
 *    self-canonical and "index, follow".
 */
const SITE_ORIGIN = 'https://khannainstitute.com';

const NOINDEX_PATH_PATTERNS = [
  'thank-you',
  'booking-success',
  'cron-dashboard',
  'master-report',
  'doctorportal',
  'physician-portal',
];

const HAS_ROBOTS_RE = /name=["']robots["']/i;
const HAS_CANONICAL_RE = /rel=["']canonical["']/i;
const CANONICAL_SELF_CLOSING_RE = /<link rel="canonical" href="([^"]*)"\s*\/>/gi;
const HEAD_OPEN_RE = /<head(\s[^>]*)?>/i;

function robotsValueForPath(pathname) {
  const p = String(pathname || '').toLowerCase();
  return NOINDEX_PATH_PATTERNS.some((frag) => p.includes(frag)) ? 'noindex, follow' : 'index, follow';
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function applySeoHead(html, pathname) {
  let out = html.replace(CANONICAL_SELF_CLOSING_RE, '<link rel="canonical" href="$1">');
  const inject = [];
  if (!HAS_ROBOTS_RE.test(out)) {
    inject.push(`  <meta name="robots" content="${robotsValueForPath(pathname)}">`);
  }
  if (!HAS_CANONICAL_RE.test(out)) {
    inject.push(`  <link rel="canonical" href="${escapeAttr(SITE_ORIGIN + pathname)}">`);
  }
  if (!inject.length) return out;
  const m = HEAD_OPEN_RE.exec(out);
  if (!m) return out;
  const at = m.index + m[0].length;
  return `${out.slice(0, at)}\n${inject.join('\n')}${out.slice(at)}`;
}

const IMG_TAG_RE = /<img\b([^>]*)>/gi;

function applyImageHints(html) {
  let index = -1;
  return html.replace(IMG_TAG_RE, (tag, attrs) => {
    index += 1;
    if (/\sdecoding\s*=/i.test(attrs)) return tag;
    const lazy = index > 0 && !/\sloading\s*=/i.test(attrs) ? ' loading="lazy"' : '';
    return `<img decoding="async"${lazy}${attrs}>`;
  });
}

function isHtmlResponse(res, body) {
  if (typeof body !== 'string') return false;
  const ctype = String(res.get('Content-Type') || '');
  if (ctype && !/text\/html/i.test(ctype)) return false;
  return HEAD_OPEN_RE.test(body);
}

function seoHeadMiddleware(req, res, next) {
  // Capture the full request path now; routers mounted at a prefix (e.g. /blog) rewrite req.path.
  const pathname = String(req.originalUrl || req.url || '/').split('?')[0].split('#')[0] || '/';
  const originalSend = res.send;
  res.send = function sendWithSeoHead(body) {
    if (isHtmlResponse(res, body)) {
      body = applyImageHints(applySeoHead(body, pathname));
    }
    return originalSend.call(this, body);
  };
  next();
}

module.exports = { seoHeadMiddleware, applySeoHead, applyImageHints, robotsValueForPath, NOINDEX_PATH_PATTERNS, SITE_ORIGIN };
