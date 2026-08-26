#!/bin/bash
# Upload VIP Consult page only (no server.js / legacy-wordpress-redirects.js).
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

echo "Uploading vip-consult.html only to ${SSH_HOST}..."
"${SCP[@]}" \
  "${SCRIPT_DIR}/vip-consult.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

echo "Done. Deployed: vip-consult.html only (no server, no redirects, no PM2 restart)."
echo "  https://khannainstitute.com/VIP-Consult"
