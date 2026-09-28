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
