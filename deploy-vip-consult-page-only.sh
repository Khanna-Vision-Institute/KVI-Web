#!/bin/bash
# Deploy only vip-consult.html (no server.js, no MP4). Restarts app so Express picks up the file.
# From project root:  bash deploy-vip-consult-page-only.sh
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
  echo "No SSH key found. Set SSH_KEY to your .pem path, e.g.:" >&2
  echo "  export SSH_KEY=\"\$HOME/Desktop/your-key.pem\"" >&2
  exit 1
fi
SSH_USER="ec2-user"
SSH_HOST="ec2-3-84-141-231.compute-1.amazonaws.com"
REMOTE_BASE="/home/ec2-user/kvi-home/kvi home"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCP=(scp -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new)
SSH=(ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}")
LOCAL_PAGE="${SCRIPT_DIR}/vip-consult.html"

if [[ ! -f "$LOCAL_PAGE" ]]; then
  echo "Missing: $LOCAL_PAGE" >&2
  exit 1
fi

echo "Uploading only vip-consult.html..."
"${SCP[@]}" "$LOCAL_PAGE" "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

echo "Restarting kvi-home..."
"${SSH[@]}" "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo ""
echo "Done. https://khannainstitute.com/VIP-Consult"
