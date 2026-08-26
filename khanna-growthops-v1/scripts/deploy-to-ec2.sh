#!/usr/bin/env bash
# Deploy GrowthOps dashboard to EC2 (separate PM2 process, low impact).
set -euo pipefail

KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
HOST="${HOST:-ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com}"
REMOTE_DIR="${REMOTE_DIR:-khanna-growthops-v1}"
BASE="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${GROWTHOPS_PORT:-8080}"

echo "==> Sync GrowthOps to $HOST:~/$REMOTE_DIR"
ssh -i "$KEY" "$HOST" "mkdir -p ~/$REMOTE_DIR/data"
rsync -avz --delete \
  --exclude node_modules \
  --exclude .env \
  --exclude .git \
  --exclude data/store.json \
  -e "ssh -i $KEY" \
  "$BASE/" "$HOST:~/$REMOTE_DIR/"

echo "==> Install deps + (re)start PM2"
ssh -i "$KEY" "$HOST" bash -s <<EOF
set -euo pipefail
cd ~/$REMOTE_DIR
if [ ! -f .env ]; then
  cp .env.example .env
  echo "[deploy] Created .env from .env.example — edit secrets before production use."
fi
npm install --omit=dev
if pm2 describe growthops >/dev/null 2>&1; then
  pm2 restart growthops --update-env
else
  pm2 start src/server.js --name growthops --max-memory-restart 350M --time
fi
pm2 save
EOF

echo ""
echo "Done."
echo "Dashboard (after nginx): https://growthops.khannainstitute.com/"
echo "Local on server: http://127.0.0.1:$PORT"
echo ""
echo "Required .env on server (~/$REMOTE_DIR/.env):"
echo "  GROWTHOPS_ADMIN_USER=seo-team"
echo "  GROWTHOPS_ADMIN_PASSWORD=..."
echo "  BLOG_PUBLISH_ENABLED=true"
echo "  BLOG_PUBLISH_ENDPOINT=http://127.0.0.1:3000/api/internal/growthops/publish-blog"
echo "  BLOG_PUBLISH_TOKEN=<same as GROWTHOPS_BLOG_PUBLISH_SECRET on kvi-home>"
