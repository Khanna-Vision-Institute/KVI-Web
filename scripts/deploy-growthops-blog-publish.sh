#!/usr/bin/env bash
# Deploy GrowthOps blog publish API to kvi-home on EC2.
set -euo pipefail

KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
HOST="${HOST:-ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com}"
REMOTE_DIR='kvi-home/kvi home'
BASE="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Copy publish route + Strapi helper + server.js"
scp -i "$KEY" \
  "$BASE/routes/internalGrowthopsBlog.js" \
  "$HOST:~/$REMOTE_DIR/routes/"

scp -i "$KEY" \
  "$BASE/services/strapi.js" \
  "$HOST:~/$REMOTE_DIR/services/"

scp -i "$KEY" "$BASE/server.js" "$HOST:~/$REMOTE_DIR/"

echo "==> Restart kvi-home"
ssh -i "$KEY" "$HOST" "cd ~/'$REMOTE_DIR' && pm2 restart kvi-home"

echo ""
echo "Add to kvi-home .env on server (if not set):"
echo "  STRAPI_API_TOKEN=<strapi full-access token>"
echo "  GROWTHOPS_BLOG_PUBLISH_SECRET=<shared secret>"
echo ""
echo "GrowthOps .env must use the same secret as BLOG_PUBLISH_TOKEN."
