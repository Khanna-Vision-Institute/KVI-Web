#!/usr/bin/env bash
# Full deploy: Heritage directory UI + PIE/SMILE/Pterygium nurture autoresponders + internal enroll API.
#
# Usage (from Mac):
#   cd "/Users/nisha/Downloads/kvi home"
#   chmod +x scripts/deploy-kvi-nurture-full.sh
#   ./scripts/deploy-kvi-nurture-full.sh
#
# After deploy, set server .env (once) then enroll test recipients:
#   NURTURE_AUTORESPONDER_ENROLL_SECRET=your-secret ./scripts/enroll-nurture-test-kapil-khanna.sh

set -euo pipefail

KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
HOST="${HOST:-ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com}"
BASE="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "$KEY" ]]; then
  echo "ERROR: SSH key not found: $KEY"
  exit 1
fi
chmod 400 "$KEY"

REMOTE_DIRS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && REMOTE_DIRS+=("$line")
done < <(
  ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=25 "$HOST" bash -s <<'DISCOVER'
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
  echo ""
  echo "---- ~/$REMOTE_DIR ----"

  ssh -i "$KEY" "$HOST" "mkdir -p \
    ~/'$REMOTE_DIR'/routes \
    ~/'$REMOTE_DIR'/services/nurtureAutoresponder \
    ~/'$REMOTE_DIR'/services/smileAutoresponder \
    ~/'$REMOTE_DIR'/services/pterygiumAutoresponder \
    ~/'$REMOTE_DIR'/services/pieAutoresponder \
    ~/'$REMOTE_DIR'/public/physician-portal \
    ~/'$REMOTE_DIR'/data \
    ~/'$REMOTE_DIR'/scripts"

  scp -i "$KEY" "$BASE/server.js" "$HOST:~/$REMOTE_DIR/server.js"

  scp -i "$KEY" \
    "$BASE/routes/internalNurtureAutoresponder.js" \
    "$HOST:~/$REMOTE_DIR/routes/internalNurtureAutoresponder.js"

  scp -i "$KEY" "$BASE/services/nurtureAutoresponder/"*.js \
    "$HOST:~/$REMOTE_DIR/services/nurtureAutoresponder/"

  scp -i "$KEY" "$BASE/services/smileAutoresponder/"*.js \
    "$HOST:~/$REMOTE_DIR/services/smileAutoresponder/"

  scp -i "$KEY" "$BASE/services/pterygiumAutoresponder/"*.js \
    "$HOST:~/$REMOTE_DIR/services/pterygiumAutoresponder/"

  scp -i "$KEY" "$BASE/services/pieAutoresponder/"*.js \
    "$HOST:~/$REMOTE_DIR/services/pieAutoresponder/"

  scp -i "$KEY" \
    "$BASE/public/physician-portal/referral-directory.html" \
    "$HOST:~/$REMOTE_DIR/public/physician-portal/referral-directory.html"

  scp -i "$KEY" \
    "$BASE/data/referral-offices.json" \
    "$BASE/data/smile-autoresponder-queue.json" \
    "$BASE/data/pterygium-autoresponder-queue.json" \
    "$HOST:~/$REMOTE_DIR/data/"

  scp -i "$KEY" \
    "$BASE/scripts/enroll-kapil-on-server.js" \
    "$BASE/scripts/enroll-team-on-server.js" \
    "$BASE/scripts/enroll-nurture-test-kapil-khanna.sh" \
    "$BASE/scripts/enroll-nurture-test-team.sh" \
    "$BASE/scripts/reschedule-pie-autoresponder-pending.js" \
    "$HOST:~/$REMOTE_DIR/scripts/" 2>/dev/null || true
done

PRIMARY="${REMOTE_DIRS[0]}"
ssh -i "$KEY" "$HOST" bash -s "$PRIMARY" <<'REMOTE'
set -euo pipefail
PRIMARY="$1"
cd ~/"$PRIMARY"
pm2 restart kvi-home --update-env
sleep 2
echo ""
echo "=== PM2 nurture log lines ==="
pm2 logs kvi-home --lines 30 --nostream 2>/dev/null | grep -E 'nurture-autoresponder|pie-autoresponder' | tail -10 || true
REMOTE

cat <<'EOF'

==> Deploy finished.

==> On the server .env (add or confirm):
  PIE_AUTORESPONDER_ENABLED=true
  SMILE_AUTORESPONDER_ENABLED=true
  PTERYGIUM_AUTORESPONDER_ENABLED=true
  NURTURE_AUTORESPONDER_CRON=*/5 * * * *
  NURTURE_AUTORESPONDER_ENROLL_SECRET=<pick-a-long-random-secret>

  pm2 restart kvi-home --update-env

==> Enroll Kapil (SMILE → Pterygium → PIE, 5 min apart from 11:00 AM LA today):
  NURTURE_AUTORESPONDER_ENROLL_SECRET=your-secret ./scripts/enroll-nurture-test-kapil-khanna.sh

EOF
