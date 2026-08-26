#!/usr/bin/env bash
# Deploy HeritageFamily page title rename → "Doctor outreach" (#rd-title).
# Files:
#   - public/physician-portal/referral-directory.html
#   - data/referral-offices.json
#
# Usage:
#   chmod +x scripts/deploy-heritage-doctor-outreach-title.sh
#   ./scripts/deploy-heritage-doctor-outreach-title.sh
#
# Override:
#   KEY=~/path/to.pem HOST=ec2-user@host ./scripts/deploy-heritage-doctor-outreach-title.sh

set -euo pipefail

KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
HOST="${HOST:-ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

LOCAL_HTML="$ROOT/public/physician-portal/referral-directory.html"
LOCAL_JSON="$ROOT/data/referral-offices.json"

if [[ ! -f "$KEY" ]]; then
  echo "ERROR: Key not found: $KEY"
  exit 1
fi
chmod 400 "$KEY"

if ! grep -q "title.textContent = 'Doctor outreach'" "$LOCAL_HTML"; then
  echo "ERROR: Local HTML missing Doctor outreach title in initHeritagePage()"
  exit 1
fi
if ! grep -q '"title": "Doctor outreach"' "$LOCAL_JSON"; then
  echo "ERROR: Local referral-offices.json missing Doctor outreach hub title"
  exit 1
fi

echo "==> Local title markers OK"

REMOTE_DIRS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && REMOTE_DIRS+=("$line")
done < <(
  ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$HOST" bash -s <<'DISCOVER'
for d in "$HOME/kvi-home/kvi home" "$HOME/kvi-home"; do
  [[ -f "$d/server.js" ]] && echo "${d/#$HOME\//}"
done
DISCOVER
)

if [[ ${#REMOTE_DIRS[@]} -eq 0 ]]; then
  echo "ERROR: No server.js under ~/kvi-home on $HOST"
  exit 1
fi

echo "==> Deploying to: ${REMOTE_DIRS[*]}"

for REMOTE_DIR in "${REMOTE_DIRS[@]}"; do
  echo "    -> ~/$REMOTE_DIR"
  scp -i "$KEY" "$LOCAL_HTML" "$HOST:~/$REMOTE_DIR/public/physician-portal/referral-directory.html"
  scp -i "$KEY" "$LOCAL_JSON" "$HOST:~/$REMOTE_DIR/data/referral-offices.json"
done

PRIMARY="${REMOTE_DIRS[0]}"
ssh -i "$KEY" "$HOST" bash -s "$PRIMARY" <<'REMOTE'
set -euo pipefail
PRIMARY="$1"
cd ~/"$PRIMARY"
pm2 restart kvi-home --update-env

PORT=3000
if [[ -f .env ]]; then
  p=$(grep -E '^PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  [[ -n "$p" ]] && PORT="$p"
fi

echo ""
echo "=== Verify localhost HTML (#rd-title) ==="
for path in /HeritageFamily /Doctorportal/network/HeritageFamily; do
  title=$(curl -sS --max-time 8 "http://127.0.0.1:${PORT}${path}" \
    | grep -o 'id="rd-title"[^>]*>[^<]*' | head -1 || true)
  echo "${path}: ${title:-NO rd-title FOUND}"
done

echo ""
echo "=== Verify API hub title ==="
curl -sS --max-time 8 "http://127.0.0.1:${PORT}/api/referral-directory/HeritageFamily?limit=1" \
  | grep -o '"title":"[^"]*"' | head -1 || echo "NO hub title in API"
REMOTE

echo ""
echo "Done."
echo "1) Hard-refresh https://khannainstitute.com/HeritageFamily — #rd-title should read Doctor outreach"
echo "2) If public URL is stale, purge Cloudflare cache for /HeritageFamily and /api/referral-directory/HeritageFamily"
