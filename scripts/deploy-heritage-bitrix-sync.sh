#!/usr/bin/env bash
# Deploy Bitrix → HeritageFamily Doctor Office sync (no website UI changes).
#
# Usage:
#   cd "/Users/nisha/Downloads/kvi home"
#   KEY=~/Desktop/khannainstitute.pem \
#   HOST=ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com \
#   ./scripts/deploy-heritage-bitrix-sync.sh
#
# After deploy, set on the server .env:
#   BITRIX_WEBHOOK_URL=...
#   HERITAGE_BITRIX_SYNC_ENABLED=true
#   HERITAGE_BITRIX_ENTITY_TYPE_ID=1038
#   HERITAGE_BITRIX_SYNC_CRON=0 */6 * * *
#   HERITAGE_BITRIX_SYNC_SECRET=...
#   HERITAGE_ZOHO_SYNC_ENABLED=false
# then: pm2 restart kvi-home --update-env

set -euo pipefail

KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
HOST="${HOST:-ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_BASE="/home/ec2-user/kvi-home/kvi home"

if [[ ! -f "$KEY" ]]; then
  echo "ERROR: Key not found: $KEY"
  exit 1
fi
chmod 400 "$KEY"

test -f "$ROOT/services/heritageBitrixSync/sync.js"
test -f "$ROOT/routes/heritageBitrixSync.js"
grep -q 'heritage-bitrix-sync' "$ROOT/server.js"

echo "==> Uploading Bitrix heritage sync files"

ssh -i "$KEY" -o ConnectTimeout=20 "$HOST" \
  "mkdir -p '$REMOTE_BASE/services/heritageBitrixSync' '$REMOTE_BASE/routes' '$REMOTE_BASE/scripts' '$REMOTE_BASE/docs'"

scp -i "$KEY" \
  "$ROOT/services/heritageBitrixSync/"*.js \
  "$HOST:$REMOTE_BASE/services/heritageBitrixSync/"

scp -i "$KEY" \
  "$ROOT/routes/heritageBitrixSync.js" \
  "$HOST:$REMOTE_BASE/routes/"

scp -i "$KEY" \
  "$ROOT/scripts/sync-heritage-from-bitrix.js" \
  "$ROOT/scripts/deploy-heritage-bitrix-sync.sh" \
  "$HOST:$REMOTE_BASE/scripts/"

scp -i "$KEY" \
  "$ROOT/server.js" \
  "$ROOT/package.json" \
  "$HOST:$REMOTE_BASE/"

scp -i "$KEY" \
  "$ROOT/docs/heritage-bitrix-sync.md" \
  "$HOST:$REMOTE_BASE/docs/" 2>/dev/null || true

scp -i "$KEY" \
  "$ROOT/zoho.env.template" \
  "$HOST:$REMOTE_BASE/" 2>/dev/null || true

echo "==> Restarting kvi-home (env must already include BITRIX_* )"
ssh -i "$KEY" "$HOST" bash -s <<REMOTE
set -euo pipefail
cd "$REMOTE_BASE"
pm2 restart kvi-home --update-env
sleep 2
pm2 logs kvi-home --lines 30 --nostream | grep -i 'heritage-bitrix' || echo "(no heritage-bitrix log line yet — check HERITAGE_BITRIX_SYNC_ENABLED)"
REMOTE

echo ""
echo "Done. Next on server .env (if not set):"
echo "  BITRIX_WEBHOOK_URL=..."
echo "  HERITAGE_BITRIX_SYNC_ENABLED=true"
echo "  HERITAGE_BITRIX_ENTITY_TYPE_ID=1038"
echo "  HERITAGE_BITRIX_SYNC_CRON=0 */6 * * *"
echo "  HERITAGE_BITRIX_SYNC_SECRET=..."
echo "  HERITAGE_ZOHO_SYNC_ENABLED=false"
echo "Then: pm2 restart kvi-home --update-env"
echo "Manual sync: npm run sync:heritage-bitrix"
echo "Docs: docs/heritage-bitrix-sync.md"
