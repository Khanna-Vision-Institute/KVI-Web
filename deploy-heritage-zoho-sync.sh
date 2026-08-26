#!/usr/bin/env bash
# Deploy Heritage Family Zoho CRM sync (Doctor Office / Accounts → /HeritageFamily).
#
# Usage:
#   chmod +x deploy-heritage-zoho-sync.sh
#   ./deploy-heritage-zoho-sync.sh
#
# Override paths:
#   KEY=~/Desktop/khannainstitute.pem EC2=ec2-user@host ./deploy-heritage-zoho-sync.sh

set -euo pipefail

KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
EC2="${EC2:-ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com}"
REMOTE="${REMOTE:-/home/ec2-user/kvi-home/kvi home}"
BASE="${BASE:-$(cd "$(dirname "$0")" && pwd)}"

if [[ ! -f "$KEY" ]]; then
  echo "ERROR: SSH key not found: $KEY" >&2
  exit 1
fi

chmod 400 "$KEY" 2>/dev/null || true

SCP=(scp -i "$KEY" -o StrictHostKeyChecking=accept-new)
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$EC2")

echo "==> Deploying Heritage Zoho sync to $EC2"
echo "    Remote: $REMOTE"

"${SSH[@]}" "mkdir -p \
  \"$REMOTE/services/heritageZohoSync\" \
  \"$REMOTE/routes\" \
  \"$REMOTE/scripts\" \
  \"$REMOTE/docs\""

"${SCP[@]}" "$BASE/server.js" \
  "$EC2:$REMOTE/server.js"

"${SCP[@]}" \
  "$BASE/services/zohoService.js" \
  "$BASE/services/referralOfficesManifest.js" \
  "$EC2:$REMOTE/services/"

"${SCP[@]}" \
  "$BASE/services/heritageZohoSync/fieldMapping.js" \
  "$BASE/services/heritageZohoSync/sync.js" \
  "$BASE/services/heritageZohoSync/cron.js" \
  "$BASE/services/heritageZohoSync/safe.js" \
  "$BASE/services/heritageZohoSync/accountsExpand.js" \
  "$BASE/services/heritageZohoSync/mergeMdOffices.js" \
  "$EC2:$REMOTE/services/heritageZohoSync/"

"${SCP[@]}" "$BASE/data/heritage-mdvip-physicians.json" \
  "$EC2:$REMOTE/data/heritage-mdvip-physicians.json"

"${SCP[@]}" "$BASE/routes/heritageZohoSync.js" \
  "$EC2:$REMOTE/routes/heritageZohoSync.js"

"${SCP[@]}" \
  "$BASE/scripts/sync-heritage-from-zoho.js" \
  "$BASE/scripts/import-od-master-to-referral-offices.js" \
  "$EC2:$REMOTE/scripts/"

"${SCP[@]}" "$BASE/docs/heritage-zoho-sync.md" \
  "$EC2:$REMOTE/docs/heritage-zoho-sync.md"

"${SCP[@]}" "$BASE/zoho.env.template" \
  "$EC2:$REMOTE/zoho.env.template"

echo "==> Restarting PM2 (kvi-home)..."
"${SSH[@]}" "pm2 restart kvi-home --update-env 2>/dev/null || pm2 restart all --update-env 2>/dev/null || true"

echo ""
echo "Done. Heritage Zoho sync deployed + PM2 restarted."
echo ""
echo "On the server .env (once), add:"
echo "  HERITAGE_ZOHO_SYNC_ENABLED=true"
echo "  ZOHO_HERITAGE_CRM_MODULE=Accounts"
echo "  ZOHO_HERITAGE_CRM_VIEW_ID=732354300000087515"
echo "  ZOHO_HERITAGE_EXPAND_CONTACTS=true"
echo "  ZOHO_HERITAGE_SYNC_CRON=0 */6 * * *"
echo "  ZOHO_HERITAGE_SYNC_SECRET=<long-random-secret>"
echo ""
echo "Then: ssh ... 'cd \"$REMOTE\" && pm2 restart kvi-home --update-env'"
echo ""
echo "Test:"
echo "  curl -sS -X POST -H \"Authorization: Bearer YOUR_SECRET\" \\"
echo "    https://khannainstitute.com/api/internal/heritage-zoho-sync/run"
