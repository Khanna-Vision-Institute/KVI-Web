#!/usr/bin/env bash
# Enroll Dr. Khanna, Ted, and Jill — SMILE → Pterygium → PIE test sequence.
# Default: today at 12:00 PM (noon) Los Angeles, 5 minutes apart per touchpoint.
#
# Usage:
#   NURTURE_AUTORESPONDER_ENROLL_SECRET=your-secret ./scripts/enroll-nurture-test-team.sh
#
# Optional overrides:
#   TEST_START_HOUR=14 TEST_START_MINUTE=30 ./scripts/enroll-nurture-test-team.sh
#   GAP_MINUTES=5 ENROLL_URL=https://khannainstitute.com/api/internal/nurture-autoresponder/enroll

set -euo pipefail

SECRET="${NURTURE_AUTORESPONDER_ENROLL_SECRET:-${PIE_AUTORESPONDER_ENROLL_SECRET:-}}"
URL="${ENROLL_URL:-https://khannainstitute.com/api/internal/nurture-autoresponder/enroll}"
GAP="${GAP_MINUTES:-5}"
HOUR="${TEST_START_HOUR:-12}"
MINUTE="${TEST_START_MINUTE:-0}"

if [[ -z "$SECRET" ]]; then
  echo "ERROR: Set NURTURE_AUTORESPONDER_ENROLL_SECRET (or PIE_AUTORESPONDER_ENROLL_SECRET)"
  exit 1
fi

BODY="$(cat <<JSON
{
  "testMode": true,
  "gapMinutes": ${GAP},
  "testStartHour": ${HOUR},
  "testStartMinute": ${MINUTE},
  "campaigns": ["smile", "pterygium", "pie"],
  "recipients": [
    {
      "fullName": "Dr. Khanna",
      "email": "superlasik@gmail.com",
      "phone": "+13104037497",
      "smileVariant": "a"
    },
    {
      "fullName": "Ted",
      "email": "Ted@khannavision.com",
      "phone": "+18058328062",
      "smileVariant": "a"
    },
    {
      "fullName": "Jill",
      "email": "info@khannavision.com",
      "phone": "+18059081132",
      "smileVariant": "a"
    }
  ]
}
JSON
)"

echo "POST $URL"
echo "Recipients: Dr. Khanna, Ted, Jill"
echo "Schedule: today ${HOUR}:$(printf '%02d' "$MINUTE") AM/PM Los Angeles, ${GAP} min gaps, SMILE → Pterygium → PIE"
echo ""

curl -sS -X POST \
  -H "Authorization: Bearer ${SECRET}" \
  -H "Content-Type: application/json" \
  -d "$BODY" | python3 -m json.tool 2>/dev/null || curl -sS -X POST \
  -H "Authorization: Bearer ${SECRET}" \
  -H "Content-Type: application/json" \
  -d "$BODY"

echo ""
