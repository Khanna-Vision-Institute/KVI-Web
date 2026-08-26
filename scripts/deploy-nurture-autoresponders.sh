#!/usr/bin/env bash
# Deploy SMILE + Pterygium nurture autoresponders + shared cron (5 min default).
# Usage:
#   cd "/Users/nisha/Downloads/kvi home"
#   bash scripts/deploy-nurture-autoresponders.sh

set -euo pipefail

EC2="${EC2:-ec2-3-84-141-231.compute-1.amazonaws.com}"
KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
BASE="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${REMOTE:-/home/ec2-user/kvi-home/kvi home}"

echo "Deploying nurture autoresponders from $BASE"

ssh -i "$KEY" "ec2-user@${EC2}" "mkdir -p '${REMOTE}/services/nurtureAutoresponder' '${REMOTE}/services/smileAutoresponder' '${REMOTE}/services/pterygiumAutoresponder' '${REMOTE}/routes' '${REMOTE}/data'"

scp -i "$KEY" \
  "$BASE/server.js" \
  "ec2-user@${EC2}:${REMOTE}/server.js"

scp -i "$KEY" \
  "$BASE/routes/internalNurtureAutoresponder.js" \
  "ec2-user@${EC2}:${REMOTE}/routes/internalNurtureAutoresponder.js"

scp -i "$KEY" -r \
  "$BASE/services/nurtureAutoresponder/"*.js \
  "ec2-user@${EC2}:${REMOTE}/services/nurtureAutoresponder/"

scp -i "$KEY" -r \
  "$BASE/services/smileAutoresponder/"*.js \
  "ec2-user@${EC2}:${REMOTE}/services/smileAutoresponder/"

scp -i "$KEY" -r \
  "$BASE/services/pterygiumAutoresponder/"*.js \
  "ec2-user@${EC2}:${REMOTE}/services/pterygiumAutoresponder/"

scp -i "$KEY" -r \
  "$BASE/services/pieAutoresponder/"*.js \
  "ec2-user@${EC2}:${REMOTE}/services/pieAutoresponder/"

scp -i "$KEY" \
  "$BASE/data/smile-autoresponder-queue.json" \
  "$BASE/data/pterygium-autoresponder-queue.json" \
  "ec2-user@${EC2}:${REMOTE}/data/"

ssh -i "$KEY" "ec2-user@${EC2}" "cd '${REMOTE}' && pm2 restart kvi-home --update-env && sleep 2 && pm2 logs kvi-home --lines 12 --nostream | grep -E 'nurture-autoresponder|pie-autoresponder' || true"

echo ""
echo "Done. On server .env add:"
echo "  SMILE_AUTORESPONDER_ENABLED=true"
echo "  PTERYGIUM_AUTORESPONDER_ENABLED=true"
echo "  NURTURE_AUTORESPONDER_CRON=*/5 * * * *"
echo "  NURTURE_AUTORESPONDER_ENROLL_SECRET=<long-random-secret>"
echo ""
echo "Enroll test recipients (internal only):"
echo "  curl -sS -X POST -H 'Authorization: Bearer YOUR_SECRET' -H 'Content-Type: application/json' \\"
echo "    https://khannainstitute.com/api/internal/nurture-autoresponder/enroll \\"
echo "    -d '{\"recipients\":[{\"fullName\":\"Test\",\"email\":\"you@example.com\",\"phone\":\"+1...\",\"smileVariant\":\"a\"}],\"campaigns\":[\"smile\",\"pterygium\"]}'"
