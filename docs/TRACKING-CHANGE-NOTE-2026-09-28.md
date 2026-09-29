# Change note: call tracking + Google Ads/GA4 tagging (review branch, Sep 28, 2026)

**Status: review branch `review/updated-site` only. NOT deployed. Swap OFF. New Google Ads conversions OFF.**
Nothing was changed in Google Ads, GA4, Weave, Twilio, CallRail, staging or production.

## 1. One switch for every Google Ads send: `ADS_TAGS_ENABLED` (`config/tracking.js`)
| Value | What fires | When to use |
|---|---|---|
| `legacy` **(default on this branch)** | Only the two Ads conversions that are **already live on production**: VIP consult and SMILE book consult (`AW-16512183014`, `public/js/consult-conversion.js`). | Now. Keeps today's live behavior exactly. |
| `all` | `legacy` + the new staged conversions for account **811-555-5501**: `phone_click`, `sms_click`, `generate_lead`, `phone_call`. Each also needs its label filled in; an empty label never sends. | The "flip on", after the conversion actions exist in 811-555-5501 and Khanna approves. |
| `off` | No Google Ads sends at all (VIP/SMILE Ads conversions stop too). | Kill switch. |

- Set it in `config/tracking.js` or, without a code change, with the env var `ADS_TAGS_ENABLED=legacy|all|off` (`true`/`1` = all, `false`/`0` = off, anything else = legacy).
- The browser only receives the labels the current mode allows (`window.KVI_TRACKING`, rendered by `partials/tracking-tags.ejs`), so disabled labels are not even in the page.
- **GA4 is not controlled by this flag.** GA4 page views and the GA4 events below always fire.
- New labels are **empty placeholders** in `ADS_STAGED_CONVERSIONS` until the conversion actions are created:
  - `phone_click`: click on any `tel:` link (browser)
  - `sms_click`: click on any `sms:` link (browser)
  - `generate_lead`: successful submit (server confirmed) of the booking widget, the schedule-consultation page, the virtual consult form, or the SMILE LA landing form
  - `phone_call`: tracked call of **60 s or more**, sent **server side** as an offline click conversion. `services/callConversion.js` plans the payload (dry-run only, sends nothing). It needs a gclid and `ADS_TAGS_ENABLED=all`.
- **To flip on:** (1) create the 4 conversion actions in 811-555-5501; (2) paste `AW-<id>/<label>` for phone_click, sms_click and generate_lead, and the conversion-action resource name for phone_call; (3) set `ADS_TAGS_ENABLED=all`; (4) test with Tag Assistant; (5) only then deploy.
- **Open:** confirm `AW-16512183014` belongs to 811-555-5501 (vs 509-001-5659). If it doesn't, the new labels use 811-555-5501's own `AW-` id (each send_to carries its own tag id, so that works).
- If Google Ads imports GA4 key events, the always-on GA4 `phone_click`/`generate_lead` events could be counted there too. Don't mark them as imported Ads conversions while the direct Ads labels are in use, or they'll double-count.

## 2. GA4 events added (always on)
`phone_click` and `sms_click` (params: dialed practice number, header/footer/body, whether a pool number was swapped in), plus `generate_lead` (`form_id`: `booking_widget`, `schedule_consult`, `virtual_consult`, `smile_la_landing`; `procedure` is the menu choice) on the 4 forms that sent nothing before. The VIP/SMILE `generate_lead` is unchanged. No names, emails, typed phone numbers or other form values are sent. **Privacy review point:** the `procedure` param sends the procedure-interest menu value with the GA client id. Drop it if Khanna or the privacy reviewer prefers.

## 3. G-Q0TGBPVS92 on every page
- Templated pages load it through `partials/header.ejs`. The 9 standalone pages (`vip-consult`, `vip-consult-thank-you`, `smile-book-consultation`, `smile-book-consultation-thank-you`, `smile-cost`, `smile-la-landing-page-2026`, `critical-page-quiz`, `khanna-genz`, `khanna-gamified-forms`) all load it, and all now load the tracking tags too.
- Added GA4 (and the tracking tags) to 11 served pages that had no tag: `seminar-rsvp.html`, both Epioxa pages, `khanna-pricing-calculator.html`, `khanna-hero-swiper-enhanced.html`, `Advanced Chalazion Treatment.html`, the 4 "Ultimate Guide" pages, and `contact/Montly payments Prices for Refractive Procedures.html`.
- `khanna-gamified-forms.html` loaded GA4 twice (its own head copy plus the header partial), which double-counted page views. The head copy was removed, so it now loads once, from the header.
- **Check script:** `npm run check:ga4` (`scripts/check-ga4-tag.js`). It scans every `.html`/`.ejs` file and lists any page without the tag. It also warns on double loads and exits 1 on a miss. The same check runs in `test/tracking.test.js`. Current result: **144 page templates, 144 OK, 0 missing.**
- **Excluded on purpose (listed by the script, never hidden):** internal dashboards and reports, the email template, 2 developer test pages, and the **physician referral portal** (`physicians/*`, `public/physician-portal/*`: patient-referral forms and sign-in). GA on the portal needs an owner/privacy decision first.

## 4. Website swap pool: exactly 10 slots (`config/call-tracking.js`), swap OFF
Settled Sep 28, 2026 (`/workspace/reports/call-tracking/number-allocation-2026-09-28.md`). No numbers bought.

| # | Number | # | Number |
|---|---|---|---|
| 1 | (310) 677-0760 | 6 | (818) 579-9866 |
| 2 | (323) 204-9995 | 7 | (818) 647-1190 |
| 3 | (323) 759-3722 | 8 | (805) 702-3111 |
| 4 | (818) 293-1955 | 9 | (818) 230-5325 |
| 5 | (818) 465-9340 | 10 | (818) 239-7069 |

- `KVI_CALLTRACKER_ENABLED = false`. `public/js/kvi-swap.js` is only rendered when it is true (and never together with CallRail).
- The office mains **(310) 482-1240** and **(805) 230-2126** are swap **targets** and stay in the HTML. **(818) 857-1735** is never pooled and never swapped.
- Only tracked visitors (gclid/gbraid/wbraid/fbclid/msclkid/utm_*) get a pool number. Organic visitors keep the office mains. One number per visitor, held 30 min. Mode `href`: only the dial link changes and the visible text stays the office main.
- The swap script accepts only one of these 10 numbers from the tracker, so a main number or the 818 line can never be swapped in.
- **(310) 677-0760 appears only as pool slot 1**, and only in a tracked visitor's dial link. It is not displayed as a static number anywhere. `scripts/deploy-callrail-phone-replace.sh`, which would have put it back in the header/footer as a static number, is retired (it exits immediately).
- **Tests** (`npm run test:tracking`, 13 tests, all pass) assert:
  - exactly 10 unique E.164 pool numbers, matching the settled list;
  - neither office main nor +18188571735 is in the pool;
  - the swap is off;
  - no pool number appears in any site file outside `config/call-tracking.js`;
  - `ADS_TAGS_ENABLED` defaults to `legacy` and the new labels are off;
  - VIP/SMILE still fire in `legacy`, stop in `off`, and are unchanged with no config;
  - tel/sms clicks send GA4 only unless a label is allowed;
  - phone_call has the 60 s minimum and flag gating;
  - GA4 is on every page.

## 5. Before the swap goes on
1. All 10 numbers are Weave-hosted. Each must reach the tracker (Twilio): forward or port from Weave (confirm with Sam/Weave).
2. Re-route (310) 677-0760 from 131 Inglewood (Trish) to the call center.
3. Host the tracker on HTTPS (`KVI_CALLTRACKER_ORIGIN` is a placeholder) and align the local prototype (`/workspace/calltracker`, which still has the old CallRail numbers in a 4+2 split) to this single 10-number pool. Until then `kvi-swap.js` would reject its numbers.
4. Get Khanna's approval, then set `KVI_CALLTRACKER_ENABLED = true`.

## Files
New: `config/tracking.js`, `config/call-tracking.js`, `partials/tracking-tags.ejs`, `public/js/kvi-tracking.js`, `public/js/kvi-swap.js`, `services/callConversion.js`, `scripts/check-ga4-tag.js`, `test/tracking.test.js`, this note.
Changed:
- `server.js`: app.locals
- `partials/header.ejs`: tracking tags
- `public/js/consult-conversion.js`: honors the flag, same labels
- the 4 form handlers (`partials/booking-widget.ejs`, `partials/booking-consult-main.ejs`, `public/js/online-consult-form.js`, `smile-la-landing-page-2026.html`)
- the 9 standalone pages and the 11 newly tagged pages
- `scripts/deploy-callrail-phone-replace.sh`: retired
- `package.json`: `test:tracking`, `check:ga4`
