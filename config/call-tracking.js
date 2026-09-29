/**
 * In-house call tracking: website dynamic number swap.
 *
 * STATUS: STAGED, SWAP OFF. KVI_CALLTRACKER_ENABLED must stay false until:
 *   1. every pool number below reaches the tracker (Twilio) - forwarded or ported from Weave
 *      (confirm with Sam/Weave), and (310) 677-0760 is re-routed from 131 Inglewood (Trish)
 *      to the call center;
 *   2. the tracker is hosted over HTTPS (KVI_CALLTRACKER_ORIGIN is a placeholder host);
 *   3. Khanna approves go-live.
 *
 * Pool: the 10 website swap numbers settled Sep 28, 2026
 * (/workspace/reports/call-tracking/number-allocation-2026-09-28.md). No numbers were bought.
 *
 * Rules (enforced by test/tracking.test.js):
 *   - exactly 10 pool numbers, all unique, E.164;
 *   - the office mains (310) 482-1240 and (805) 230-2126 are swap TARGETS, never pool numbers;
 *   - (818) 857-1735 is never in the pool and is never swapped;
 *   - pool numbers are never displayed as static numbers anywhere on the site. They only appear
 *     in a visitor's page after public/js/kvi-swap.js leases one, and only for tracked visitors.
 *     This includes (310) 677-0760 (the old header number): it comes back ONLY as pool slot 1.
 *
 * Mode 'href' keeps the visible text (office main) and swaps only the tel: link.
 */
const KVI_CALLTRACKER_ENABLED = false;
const KVI_CALLTRACKER_ORIGIN = 'https://calls.khannainstitute.com'; // placeholder host (decision D8)
const KVI_CALLTRACKER_MODE = 'href'; // 'href' | 'text' (decision D3b)

/** Only visitors who arrive with one of these URL params get a pool number (SPEC.md). */
const TRACKED_PARAMS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

const SWAP_TARGETS = ['+13104821240', '+18052302126']; // office mains: swapped, never pooled
const NEVER_SWAP = ['+18188571735']; // hidden after-hours line: never pooled, never swapped

const WEBSITE_SWAP_POOL = Object.freeze([
  '+13106770760', // 1  (310) 677-0760  old website number; re-route from Inglewood before go-live
  '+13232049995', // 2  (323) 204-9995
  '+13237593722', // 3  (323) 759-3722  (next to iAyez 759-3721 - don't mix up)
  '+18182931955', // 4  (818) 293-1955
  '+18184659340', // 5  (818) 465-9340
  '+18185799866', // 6  (818) 579-9866
  '+18186471190', // 7  (818) 647-1190
  '+18057023111', // 8  (805) 702-3111
  '+18182305325', // 9  (818) 230-5325
  '+18182397069', // 10 (818) 239-7069
]);
const WEBSITE_SWAP_POOL_SIZE = 10;

const POOL_HOLD_MINUTES = 30;

module.exports = {
  KVI_CALLTRACKER_ENABLED,
  KVI_CALLTRACKER_ORIGIN,
  KVI_CALLTRACKER_SRC: '/public/js/kvi-swap.js',
  KVI_CALLTRACKER_MODE,
  TRACKED_PARAMS,
  SWAP_TARGETS,
  NEVER_SWAP,
  WEBSITE_SWAP_POOL,
  WEBSITE_SWAP_POOL_SIZE,
  POOL_HOLD_MINUTES,
};
