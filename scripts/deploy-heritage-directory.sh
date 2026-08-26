#!/usr/bin/env bash
# Deploy Heritage directory (OD + MD split layout) to EC2.
# Usage:
#   chmod +x scripts/deploy-heritage-directory.sh
#   ./scripts/deploy-heritage-directory.sh

set -euo pipefail

KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
HOST="${HOST:-ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${HOST:-}" ]] || [[ "$HOST" != *"@"* ]]; then
  echo "ERROR: Set HOST=ec2-user@your-ec2-host.amazonaws.com"
  exit 1
fi

if [[ ! -f "$KEY" ]]; then
  echo "ERROR: Key not found: $KEY"
  exit 1
fi

chmod 400 "$KEY"

LOCAL_HTML="$ROOT/public/physician-portal/referral-directory.html"
if ! grep -q 'HERITAGE_TABS_v5' "$LOCAL_HTML"; then
  echo "ERROR: Local file missing HERITAGE_TABS_v5"
  exit 1
fi

echo "==> Local build marker OK (HERITAGE_TABS_v5)"

# Discover every repo root on the server (pm2 may use nested "kvi home" folder).
REMOTE_DIRS=("kvi-home/kvi home" "kvi-home")
# Prefer nested path (pm2 cwd); still sync flat kvi-home if present.
while IFS= read -r line; do
  [[ -n "$line" ]] && REMOTE_DIRS+=("$line")
done < <(
  ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$HOST" bash -s <<'DISCOVER'
for d in "$HOME/kvi-home/kvi home" "$HOME/kvi-home"; do
  [[ -f "$d/server.js" ]] && echo "${d/#$HOME\//}"
done
DISCOVER
)
# Dedupe while preserving order
uniq_dirs=()
for d in "${REMOTE_DIRS[@]}"; do
  seen=0
  for u in "${uniq_dirs[@]:-}"; do [[ "$u" == "$d" ]] && seen=1; done
  [[ $seen -eq 0 ]] && uniq_dirs+=("$d")
done
REMOTE_DIRS=("${uniq_dirs[@]}")

if [[ ${#REMOTE_DIRS[@]} -eq 0 ]]; then
  echo "ERROR: No server.js under ~/kvi-home on $HOST"
  exit 1
fi

echo "==> Deploying to: ${REMOTE_DIRS[*]}"

for REMOTE_DIR in "${REMOTE_DIRS[@]}"; do
  echo "    -> ~/$REMOTE_DIR"
  scp -i "$KEY" "$LOCAL_HTML" "$HOST:~/$REMOTE_DIR/public/physician-portal/referral-directory.html"
  scp -i "$KEY" "$ROOT/server.js" "$HOST:~/$REMOTE_DIR/server.js"
  scp -i "$KEY" "$ROOT/services/referralOffices.js" "$HOST:~/$REMOTE_DIR/services/referralOffices.js"
  scp -i "$KEY" "$ROOT/data/referral-offices.json" "$HOST:~/$REMOTE_DIR/data/referral-offices.json"
done

# Restart pm2 from first dir; then verify what Node actually returns.
PRIMARY="${REMOTE_DIRS[0]}"
ssh -i "$KEY" "$HOST" bash -s "$PRIMARY" <<'REMOTE'
set -euo pipefail
PRIMARY="$1"
cd ~/"$PRIMARY"
pm2 restart kvi-home --update-env

echo ""
echo "=== PM2 working directory ==="
pm2 describe kvi-home 2>/dev/null | grep -E 'exec cwd|script path' || pm2 show kvi-home | grep -E 'exec cwd|script path' || true

echo ""
echo "=== referral-directory.html on disk ==="
find "$HOME" -path '*/physician-portal/referral-directory.html' 2>/dev/null | while read -r f; do
  tag=$(head -3 "$f" | grep -o 'HERITAGE_[A-Z0-9_]*' | head -1 || echo "unknown")
  echo "$tag  $f"
done

PORT=3000
if [[ -f .env ]]; then
  p=$(grep -E '^PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  [[ -n "$p" ]] && PORT="$p"
fi

echo ""
echo "=== What Node serves (localhost:$PORT) ==="
for path in /HeritageFamily /Doctorportal/network/HeritageFamily; do
  tag=$(curl -sS --max-time 5 "http://127.0.0.1:${PORT}${path}" | head -5 | grep -o 'HERITAGE_[A-Z0-9_]*' | head -1 || echo "NO_MATCH")
  echo "$tag  http://127.0.0.1:${PORT}${path}"
done
REMOTE

echo ""
echo "Done."
echo "1) View Source on https://khannainstitute.com/HeritageFamily — must find HERITAGE_TABS_v5"
echo "2) If localhost shows SPLIT_v4 but the public URL still shows GATE_v2, purge Cloudflare"
echo "   and confirm nginx proxies /HeritageFamily to Node (see docs/nginx-referral-apex-404.md)"
echo "3) Try https://khannainstitute.com/Doctorportal/network/HeritageFamily"
