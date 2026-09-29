# Review build: updated Khanna Vision Institute website

**Status: NOT DEPLOYED. For review only.** This branch is not connected to khannainstitute.com, staging, AWS or CloudFront.

## What this build is
The rebuilt site that merges the files from the live production server with the fixes from this GitHub repo:
- Live-server templates and pages brought in (header/footer/seminar banner, CXL, gamified forms, sitemaps, robots.txt, SEO head middleware)
- SMILE (`/procedures/laser-vision/smile/`) and **SMILE Pro** (`/procedures/laser-vision/smile-pro-eye-surgery/`) pages, Celebrity Patients, Terms, Data deletion
- NAP cleanup: only (310) 482-1240 and (805) 230-2126 are shown, with two addresses (9100 Wilshire Blvd Suite 265E, Beverly Hills; 31824 Village Center Rd Suite F, Westlake Village). The LASIK page's old addresses are corrected.
- Locked procedure count (25,000) on every served page
- Redirect fixes (query strings kept on 301s, legacy WordPress/SMILE short URLs, Black Friday URLs)
- Consult conversion tracking that fires only on success (PR #1 branch `codex/consult-conversion-success-only`)
- Hard-coded fallback passwords removed (the app now requires env vars)
- reCAPTCHA v2 secret removed from `routes/booking.js`, `bookConsultPortal.js`, `smileLandingLead.js`, `smileBookConsult.js`, `physicianReferral.js`; it is now read only from `RECAPTCHA_SECRET_KEY` (or `RECAPTCHA_V2_SECRET_KEY`). The old key is still in `main`'s history and should be rotated.

## Source
Working tree of local branch `content/locked-facts-drafts` at commit `484ae75` (built on `rebuild/best-of-both`), local repo `/workspace/kvi/rebuild`. Copied in as one snapshot commit on top of `main`.

## Excluded from this commit (and why)
- `backups/` (old dated copies of files), `server.js.backup`, `routes/booking-server-backup.js`, `*.backup-*.html`, `khanna-booking.backup*.html`, `procedures/laser-vision/smile-page-complete-backup.html`: backups. One of them contains a hard-coded secret.
- `server-reports/`: server monitoring logs
- `data/{pie,pterygium,smile}-autoresponder-queue.json`: runtime server data containing staff contact details
- `scripts/install-strapi.sh`, `scripts/install-strapi-v5.sh`, `scripts/install-strapi-manual.sh`, `scripts/backup-mongodb.sh`: server-only scripts with a hard-coded database password
- `infra/physician-portal-auth/.aws-sam/`: generated build output

Because this branch replaces the whole working tree, those paths show up as deleted relative to `main`.

## Known limits
Forms, booking, the Guru chat (`/api/guru`), CMS-driven blog and MongoDB features need production env vars and back-end services. They are not active in the review copy.

## Sep 28, 2026 additions (review branch only)
- **Award badges (Phase 4):** 5-badge strip (`partials/awards-strip.ejs`, images in `public/images/awards/`) on the home page (top of the hero, just under the header) and at the top of `/about/dr-khanna/credentials-awards/` (in the template, so it shows even without Strapi). Updated CMS content with badge cards: `STRAPI_CONTENT_17_CREDENTIALS_BADGES_WITH_CSS.html` (not pasted into Strapi). The Rising Star badge is a text placeholder until KVI sends the original image. Open questions on award years and issuers: `public/images/awards/README.md`.
- **Why Trust Khanna Institute (G10):** new static page `/about/why-trust-khanna/` (`about/why-trust-khanna.html`), linked from the About > Meet Dr. Khanna menu and added to `/main-pages-sitemap.xml`. Uses only figures already on the live site (25,000+, 30+ years, 4.9★, 99%, 2 books).
- **Call tracking + tagging (staged, OFF):** see `docs/TRACKING-CHANGE-NOTE-2026-09-28.md`.
  - One Ads switch, `ADS_TAGS_ENABLED` (`config/tracking.js`). The default is `legacy`: only the live VIP/SMILE `AW-16512183014` conversions fire. The new phone_click/sms_click/generate_lead/phone_call conversions for 811-555-5501 are off, with empty labels.
  - GA4 `G-Q0TGBPVS92` is on every page, checked by `npm run check:ga4`.
  - 10-slot website swap pool in `config/call-tracking.js`, swap off. The office mains and (818) 857-1735 are never pooled, and (310) 677-0760 is used only as a pool number.
  - Tests: `npm run test:tracking`.
