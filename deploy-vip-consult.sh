#!/bin/bash
# Deploy VIP-Consult page: vip-consult.html, optional hero MP4, server.js, PM2 restart.
# Run from the "kvi home" project root:  bash deploy-vip-consult.sh
set -e
if [[ -z "${SSH_KEY:-}" ]]; then
  for candidate in \
    "${HOME}/Desktop/khannainstitute.pem" \
    "/Users/nisha/Desktop/khannainstitute.pem" \
    "${HOME}/Desktop/khannainstitute_backup/khannainstitute.pem"; do
    if [[ -f "$candidate" ]]; then
      SSH_KEY="$candidate"
      break
    fi
  done
fi
if [[ -z "${SSH_KEY:-}" ]] || [[ ! -f "$SSH_KEY" ]]; then
  echo "No SSH key found. Set SSH_KEY to your .pem path." >&2
  exit 1
fi
SSH_USER="ec2-user"
SSH_HOST="ec2-3-84-141-231.compute-1.amazonaws.com"
REMOTE_BASE="/home/ec2-user/kvi-home/kvi home"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCP=(scp -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new)
SSH=(ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}")
LOCAL_PAGE="${SCRIPT_DIR}/vip-consult.html"
LOCAL_SERVER="${SCRIPT_DIR}/server.js"
LOCAL_MP4="${SCRIPT_DIR}/public/media/vip-consult-hero.mp4"

if [[ ! -f "$LOCAL_PAGE" ]]; then
  echo "Missing: $LOCAL_PAGE" >&2
  exit 1
fi
if [[ ! -f "$LOCAL_SERVER" ]]; then
  echo "Missing: $LOCAL_SERVER" >&2
  exit 1
fi

echo "Uploading vip-consult.html + server.js..."
"${SCP[@]}" "$LOCAL_PAGE" "$LOCAL_SERVER" "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

if [[ -f "$LOCAL_MP4" ]]; then
  echo "Ensuring remote public/media and uploading hero video (may take a while)..."
  "${SSH[@]}" "mkdir -p \"${REMOTE_BASE}/public/media\""
  "${SCP[@]}" "$LOCAL_MP4" "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/public/media/"
else
  echo "No local $LOCAL_MP4 — skipping MP4 (hero will 404 until you add the file and re-run)."
fi

echo "Restarting kvi-home..."
"${SSH[@]}" "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo ""
echo "Done."
echo "  https://khannainstitute.com/VIP-Consult"
echo "  Video (if uploaded): https://khannainstitute.com/public/media/vip-consult-hero.mp4"
echo "Logs: ssh -i \"\$SSH_KEY\" ${SSH_USER}@${SSH_HOST} 'pm2 logs kvi-home --lines 40'"
