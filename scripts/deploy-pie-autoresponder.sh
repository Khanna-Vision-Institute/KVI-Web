#!/bin/bash
# Deploy all PIE autoresponder files to EC2. Run from Mac:
#   cd "/Users/nisha/Downloads/kvi home" && bash scripts/deploy-pie-autoresponder.sh

set -euo pipefail

EC2="${EC2:-ec2-3-84-141-231.compute-1.amazonaws.com}"
KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
BASE="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${REMOTE:-/home/ec2-user/kvi-home/kvi home}"

echo "Deploying PIE autoresponder from $BASE"

scp -i "$KEY" \
  "$BASE/services/twilioSmsService.js" \
  "$BASE/services/twilioVoiceService.js" \
  "$BASE/services/vapiOutboundService.js" \
  "ec2-user@${EC2}:${REMOTE}/services/"

scp -i "$KEY" -r \
  "$BASE/services/pieAutoresponder/"*.js \
  "ec2-user@${EC2}:${REMOTE}/services/pieAutoresponder/"

scp -i "$KEY" \
  "$BASE/routes/booking.js" \
  "ec2-user@${EC2}:${REMOTE}/routes/booking.js"

scp -i "$KEY" \
  "$BASE/scripts/pie-queue-status.js" \
  "$BASE/scripts/pie-queue-clear-test.js" \
  "$BASE/scripts/reschedule-pie-autoresponder-pending.js" \
  "ec2-user@${EC2}:${REMOTE}/scripts/"

ssh -i "$KEY" "ec2-user@${EC2}" "cd '$REMOTE' && pm2 restart kvi-home --update-env && sleep 2 && pm2 logs kvi-home --lines 8 --nostream | grep -i pie"

echo "Done. Verify twilioVoiceService.js exists on server:"
ssh -i "$KEY" "ec2-user@${EC2}" "ls -la '$REMOTE/services/twilioVoiceService.js'"
