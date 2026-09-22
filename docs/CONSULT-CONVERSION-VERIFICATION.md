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
