#!/usr/bin/env bash
# Deploy SMS/calls consent disclaimer on booking forms.
# Files:
#   - partials/booking-consult-main.ejs  (/contact/forms/)
#   - partials/booking-widget.ejs        (sitewide floating widget)
#
# Usage:
#   chmod +x scripts/deploy-booking-consent-disclaimer.sh
#   KEY=~/Desktop/khannainstitute.pem \
#   HOST=ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com \
#   ./scripts/deploy-booking-consent-disclaimer.sh
#
# Override:
#   KEY=~/path/to.pem HOST=ec2-user@host ./scripts/deploy-booking-consent-disclaimer.sh

set -euo pipefail

KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
HOST="${HOST:-ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

LOCAL_MAIN="$ROOT/partials/booking-consult-main.ejs"
LOCAL_WIDGET="$ROOT/partials/booking-widget.ejs"

if [[ ! -f "$KEY" ]]; then
  echo "ERROR: Key not found: $KEY"
  exit 1
fi
chmod 400 "$KEY"

MARKER="By submitting this form, you agree to receive calls and text messages from Khanna Vision Institute"
if ! grep -q "$MARKER" "$LOCAL_MAIN"; then
  echo "ERROR: Local booking-consult-main.ejs missing new consent disclaimer"
  exit 1
fi
if ! grep -q "$MARKER" "$LOCAL_WIDGET"; then
  echo "ERROR: Local booking-widget.ejs missing new consent disclaimer"
  exit 1
fi

echo "==> Local consent disclaimer OK (main form + widget)"

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
  scp -i "$KEY" "$LOCAL_MAIN" "$HOST:~/$REMOTE_DIR/partials/booking-consult-main.ejs"
  scp -i "$KEY" "$LOCAL_WIDGET" "$HOST:~/$REMOTE_DIR/partials/booking-widget.ejs"
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
echo "=== Verify localhost consent disclaimer ==="
for path in /contact/forms/ /contact/schedule-consultation/ /; do
  hit=$(curl -sS --max-time 8 "http://127.0.0.1:${PORT}${path}" \
    | grep -o 'agree to receive calls and text messages from Khanna Vision Institute' | head -1 || true)
  echo "${path}: ${hit:-MISSING disclaimer}"
done
REMOTE

echo ""
echo "Done."
echo "1) Hard-refresh any page — open the booking widget and confirm the SMS/calls disclosure checkbox"
echo "2) Also check https://khannainstitute.com/contact/forms/"
echo "3) If public URL is stale, purge Cloudflare cache"
