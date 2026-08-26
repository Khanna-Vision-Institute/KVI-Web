#!/bin/bash
# Deploy VIP Consult landing page only (vip-consult.html). Restarts PM2 so routes pick up if needed.
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

echo "Uploading vip-consult.html to ${SSH_HOST}..."
scp -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new \
  "${SCRIPT_DIR}/vip-consult.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

echo "Restarting kvi-home..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. https://khannainstitute.com/VIP-Consult"
