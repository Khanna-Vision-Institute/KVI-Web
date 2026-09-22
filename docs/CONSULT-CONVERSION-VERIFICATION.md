# VIP and SMILE conversion repair

## What was found

Read-only inspection of the public thank-you pages on 2026-09-22 matched these repository files: VIP queued a conditional GA4 `generate_lead` but also an unconditional Google Ads conversion; SMILE queued an unconditional Google Ads conversion with no GA4 `generate_lead`. The LACS setup runbook separately records GA4 property `280092671`, web stream `2710321930`, and a nonexistent `consult_intent` event. LACS deliberately leaves its event binding unset.

This explains inconsistent instrumentation, but does not prove whether GA4 receives any current event, whether `generate_lead` is a key event, or whether the existing Ads conversion actions are enabled. Those require authenticated live verification.

## Proposed repair

- Both form handlers require an HTTP success response and explicit JSON `success: true` before marking a successful request.
- A shared same-origin helper writes a five-minute session receipt after that response. Each thank-you page consumes only its own receipt once, then queues GA4 `generate_lead` to the existing `G-Q0TGBPVS92` destination and the existing form-specific Ads conversion action.
- Direct thank-you visits, refreshes, expired/malformed receipts and failed submissions do not count. A random, non-patient receipt is sent only as Ads `transaction_id` for deduplication. It is not a CRM identity or proof of an attended consultation.
- The payload contains fixed form identifiers only; names, email, phone and vision concerns are never copied into analytics events. No invented lead value or surgery revenue is supplied.
- Storage/tag blocking may prevent measurement; it must not prevent booking. Existing consent and Google tag configuration still apply.

This patch covers the VIP and SMILE forms only. The general booking/online-consult forms, phone calls, VAPI conversations and confirmed Bitrix24 bookings need separate tracking verification. Do not present those as measured by this patch.

## Rollout and acceptance

1. Confirm that these repository form files are still the deployment source; this repository's base predates the current site. Preserve any newer production edits. Deploy the helper at `/public/js/consult-conversion.js` and all four HTML files together, first in a nonproduction preview with mocked booking and tags. Keep the previous five-file set for rollback.
2. Run `node --test scripts/consult-conversion.test.cjs`. It tests success-once, direct visit/reload, stale/malformed receipts, storage/tag failures, explicit-success wiring and inline-script syntax, without submitting a request or contacting Google.
3. With authorized access to GA4 property `280092671`, confirm the web stream measurement ID is `G-Q0TGBPVS92`. Inspect recent events and key events. Use Tag Assistant/DebugView for one controlled, owner-authorized test per form; verify exactly one `generate_lead`, the fixed `form_id`, the correct destination and no form values in parameters. An accepted request is not a confirmed appointment.
4. Confirm no lead/conversion is sent on validation or server failure, direct thank-you navigation, refresh, or a second rendering of the thank-you script. Test consent accepted and declined, and verify ordinary requests still work when storage or analytics is blocked.
5. Mark verified `generate_lead` as a GA4 key event if that definition is appropriate. Verify both existing Google Ads actions against the correct Ads account. Choose one primary bidding route per lead: the existing native Ads conversion **or** an imported GA4 key event. Do not count both as primary for the same request. No account settings are changed by this patch.
6. Only after observed event receipt, key-event validation and duplicate checks, bind LACS `GA4_CONSULT_EVENT=generate_lead` through its protected deployment process. The dashboard diagnostic table can show event counts even while that binding stays unset. Normal reports may lag DebugView; document the test time and compare the same reporting window.

Do not use real patient details in test artifacts or logs. A controlled live form test can create CRM records and staff/patient emails; obtain explicit authorization for the test recipient and destination before submitting it. Source inspection and unit tests are not live conversion acceptance.

Official references:
- https://support.google.com/analytics/answer/9267735
- https://support.google.com/analytics/answer/7201382
- https://support.google.com/analytics/answer/12966437
- https://support.google.com/analytics/answer/9356034

## Authenticated GA4 findings (2026-09-22)

Read-only inspection after Raj completed sign-in confirmed:

- Property `280092671` has web stream `2710321930`, measurement ID `G-Q0TGBPVS92`, and active data collection in the past 48 hours. The website destination is correct.
- `generate_lead` is already starred as a key event, but shows **No stream data detected** in the last 28 days. No additional key-event toggle is needed for that name.
- Recent events include `click`, `first_time_phone_call`, `first_visit`, `page_view`, `repeat_phone_call`, `scroll`, `session_start`, `user_engagement` and `view_search_results`. The two phone-call events are not starred as key events; their provider meaning and quality must be checked before treating them as conversions.
- Automatic enhanced-measurement form interactions are off. This explains missing automatic `form_start`/`form_submit` events but does not by itself explain or fix the explicitly sent `generate_lead` event. Do not equate turning on automatic form interactions with successful submission tracking.
- Two custom rules exist: `generate_lead` and `ads_conversion_Book_appointment_1`. **Both match `event_name equals page_view` AND `page_location contains thank-you`.** Neither has stream data in the displayed 28-day window.
- Two Google Ads links are completed: Khanna Vision `509-001-5659` and `811-555-5501`. Link presence does not verify the active advertising account or conversion action ownership.

### Additional deployment blocker: existing thank-you rules

The JavaScript patch alone does not eliminate false or duplicate GA4 conversions while those page-view-derived rules remain active. Before rollout, inventory which Ads actions import each key event and identify the current ad account. Coordinate disabling/removing/replacing the two generic thank-you-page rules with the explicit successful-submission measurement, preserving any required historical reporting. Obtain action-time confirmation before any irreversible deletion. Do not change either rule blindly or count native Ads and imported GA4 actions as primary for the same lead.

No GA4 or Ads setting was changed during inspection. Live successful-submission delivery remains unverified, and a zero reported lead count is not proof that the practice received no leads.

## Live-source and Google Ads follow-up (2026-09-22)

Fresh HTTP reads compared all four public HTML responses with repository base
`f66ab31c49d726e1ccc042a806ed1470e52d8c36`. VIP form, VIP thank-you and SMILE
thank-you matched byte for byte. The SMILE form differed only in a CSS comment
referring to `/book-consultation/`; this newer comment is preserved in this PR.
This confirms the proposed HTML changes fit the observed pages, but does not
prove which server directory or backend revision is currently serving them.

Run the read-only preflight against the actual serving directory before deployment:

```sh
node scripts/check-consult-conversion-target.cjs /absolute/live/site/root
```

It checks the four observed SHA-256 baselines and stops if the new helper already
exists. A mismatch requires a fresh comparison and preservation of newer edits,
not replacing the expected hashes blindly. The checker was verified to pass on
the downloaded baseline and reject the repaired files. The four conversion tests
also pass. These are offline checks; no live booking was submitted.

Authenticated Google Ads inspection confirmed account `811-555-5501`:

- `SMILE Google Ads Lead` is an enabled Website primary action under Submit lead
  forms, counts One, uses a 90-day click-through window, and reports Needs
  attention. Its displayed event snippet is exactly
  `AW-16512183014/d1J1CK2xzqscEObVz8E9`, matching this repair. Conversion type ID
  `7607654573` is a different identifier and must not replace the AW destination.
- `PIE Google Ads Lead` is also an enabled Website primary action, counts One,
  uses a 90-day click-through window, and reports Needs attention. Its individual
  event snippet still needs verification against the existing VIP label.
- Both displayed zero attributed conversions for Aug 23–Sep 21, 2026. That is
  not a count of all website requests. This inspection does not establish that
  all campaigns are active or that the other linked account is unused.

Existing deployment scripts use direct SSH/SCP to the website host and restart
PM2. No authenticated connection to that host is available in this task. A
deployment operator must confirm the serving directory, take a backup of the
four HTML files, run the baseline check and conversion tests, and stage the helper
plus four repaired pages together. Do not run the broad legacy deployment scripts:
they may overwrite unrelated backend/email changes from the old repository snapshot.

Coordinate the GA4 thank-you-rule changes with this release and verify both Ads
labels and any imported equivalents first. Preserve the existing primary-action
settings until duplicate measurement has been checked. Then use one expressly
approved staff-owned test contact per form and inspect DebugView/Tag Assistant.
No production files, GA4 rules, Ads settings, budgets or bidding were changed in
this follow-up.
