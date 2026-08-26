#!/bin/bash
# Deploy Guru AI chat widget script (public/js/guru-chat-embed.js). No PM2 restart required.
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

echo "Uploading guru-chat-embed.js to ${SSH_HOST}..."
scp -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new \
  "${SCRIPT_DIR}/public/js/guru-chat-embed.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/public/js/"

echo "Done. Hard-refresh the site to load the new script (or wait for CDN/browser cache to expire)."
