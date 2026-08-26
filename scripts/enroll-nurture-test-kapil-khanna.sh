#!/usr/bin/env bash
# Enroll Kapil — SMILE → Pterygium → PIE test sequence.
# Today at 11:00 AM Los Angeles, 5 minutes apart per touchpoint.
#
# Usage:
#   NURTURE_AUTORESPONDER_ENROLL_SECRET=your-secret ./scripts/enroll-nurture-test-kapil-khanna.sh

set -euo pipefail

SECRET="${NURTURE_AUTORESPONDER_ENROLL_SECRET:-${PIE_AUTORESPONDER_ENROLL_SECRET:-}}"
URL="${ENROLL_URL:-https://khannainstitute.com/api/internal/nurture-autoresponder/enroll}"

if [[ -z "$SECRET" ]]; then
  echo "ERROR: Set NURTURE_AUTORESPONDER_ENROLL_SECRET (or PIE_AUTORESPONDER_ENROLL_SECRET)"
  exit 1
fi

BODY="$(cat <<'JSON'
{
  "testMode": true,
  "gapMinutes": 5,
  "testStartHour": 11,
  "testStartMinute": 0,
  "campaigns": ["smile", "pterygium", "pie"],
  "recipients": [
    {
      "fullName": "Kapil",
      "email": "kapil@khannavision.com",
      "phone": "+18059061634",
      "smileVariant": "a"
    }
  ]
}
JSON
)"

echo "POST $URL"
echo "Schedule: today 11:00 AM Los Angeles, 5 min gaps, SMILE → Pterygium → PIE"
echo ""

curl -sS -X POST \
  -H "Authorization: Bearer ${SECRET}" \
  -H "Content-Type: application/json" \
  -d "$BODY" | python3 -m json.tool 2>/dev/null || curl -sS -X POST \
  -H "Authorization: Bearer ${SECRET}" \
  -H "Content-Type: application/json" \
  -d "$BODY"

echo ""
