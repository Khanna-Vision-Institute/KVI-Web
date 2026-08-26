#!/bin/bash
# Deploy Dr. Khanna media page + celebrity patients page in one upload (single PM2 restart).
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

echo "Uploading media.html + celebrity-patients.html to ${SSH_HOST}..."
"${SCP[@]}" \
  "${SCRIPT_DIR}/about/dr-khanna/media.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/about/dr-khanna/"
"${SCP[@]}" \
  "${SCRIPT_DIR}/about/why-choose-us/celebrity-patients.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/about/why-choose-us/"

echo "Restarting kvi-home..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done."
echo "  https://khannainstitute.com/about/dr-khanna/media/"
echo "  https://khannainstitute.com/about/why-choose-us/celebrity-patients/"
