# Award badges (Phase 4 "awards and gallery")

Served at `/public/images/awards/<file>` by `express.static(PUBLIC_DIR)` in `server.js`.
Each badge is a WebP (used first, via `<picture>`) plus a 256-colour PNG fallback, max 300 px tall (never upscaled).
Used by `partials/trust-band.ejs` (site-wide, included from `partials/footer.ejs`, just above the footer)
and by `STRAPI_CONTENT_17_CREDENTIALS_BADGES_WITH_CSS.html`.
`partials/awards-strip.ejs` is no longer included (it would duplicate this band).

| File | Staging alt text (awards page) | Size | Source used |
|---|---|---|---|
| `readers-choice-award.webp/.png` | Readers choice award for Dr.Khanna | 300x300 | Original upload `readers-best-color-300x300-1.jpeg` (300x300), Wayback Machine copy of the old live WP page (Dec 3, 2024) |
| `newsweek-top-15-showcase.webp/.png` | SMILE laser eye surgeon Top 15 Newsweek Showcase | 300x250 | Largest copy found: `Newsweek-Showcase-.webp` (300x250), the public image the live media page already uses |
| `southern-california-top-lasik-surgeon.webp/.png` | Southern California Top Lasik Surgeon | 322x300 | Original upload `TopDoctors2022.jpg` (1102x1028), Wayback copy (Dec 3, 2024) |
| `super-doctors-rajesh-khanna.webp/.png` | Superdoctor and Amazing SMILE laser vision correction specialist Dr.Khanna | 383x300 | Original upload `SuperDoctors_Rajesh_Khanna.jpg` (863x676), Wayback copy (Dec 3, 2024) |

Why not staging: the staging page (khannainstitutecom.stage.site) still references these files, but every
`/wp-content/uploads/2023/02/*` file on staging returns 404 (the media was not copied to staging), and the
Jetpack CDN copies return 403.

## Open questions for KVI (please confirm before publishing)
1. **Rising Star Award**: removed on purpose. Do not add it back, even though a plaque photo exists.
2. **Southern California Top LASIK Surgeon**: the badge artwork reads "2020 Southern California Top Doctors & Rising
   Stars", but the file name is `TopDoctors2022`. Which year is correct, and who issued it? Is it the same program as
   the Rising Star Award?
3. **Readers' Choice**: the badge reads "Daily News Readers' Best 2009 Readers' Choice"; the live Credentials page says
   "Best LASIK Surgeon, voted by readers of Los Angeles Daily News". OK to show the year 2009?
4. **Super Doctors**: the staging page says "awarded by Los Angeles Times, 4 years in a row, from 2021 onward"; the badge
   reads "Southern California 2023"; the live Credentials page says "Super Doctor 2023"; the live Biography says
   "6 consecutive Super Doctor years (2019-2024)". Which count and years are right?
5. **Newsweek Showcase (15 Leaders in Laser Eye Surgery)**: which year? A higher-resolution original would help (we
   only have 300x250).
6. **WHO Recognition, Man of the Year, Celebrity Choice**: removed on purpose. Do not show them, including as text cards.

## Magazine covers (site-wide trust band)

Served from `/public/images/press/`. Only covers with a real image. Display size is resized down from the source (not upscaled).

| File | Served size | Source |
|---|---|---|
| `yhc-magazine-june-2009.webp/.jpg` | 420x508 | Westlake upload `JUNE09-YHC-MAGAZINE_DR.-KHANNA-pdf-846x1024-1.jpg` (846x1024), https://kvi.westlakevillagelasik.com/wp-content/uploads/2023/02/JUNE09-YHC-MAGAZINE_DR.-KHANNA-pdf-846x1024-1.jpg |
| `life-after-50-january-2009.webp/.jpg` | 420x529 | Westlake upload `LifeAfter50_2937-1-scaled.webp` (2032x2560), https://kvi.westlakevillagelasik.com/wp-content/uploads/2023/02/LifeAfter50_2937-1-scaled.webp |
| `beverly-hills-times-september-2007.webp/.jpg` | 420x489 | S3 `khannainstitute/Rajesh-Khanna-MD-on-cover-of-Beverly-Hills-Times.png` (496x578), September 2007 signed cover. Resized down to 420px wide (JPEG q=82, WebP q=92). |

Not included: Los Angeles Magazine 2025 `Untitled-2-01.png` is a Top Doctors ad page, not a cover on the staging scroll, and was not added. Rising Star was not added.
