#!/bin/bash
# Upload services/emailService.js + PM2 restart (SMILE landing / book-consult recipients, etc.).
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

echo "Uploading services/emailService.js + services/thankYouEmails/ to ${SSH_HOST}..."
"${SCP[@]}" \
  "${SCRIPT_DIR}/services/emailService.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/services/"

if [[ ! -d "${SCRIPT_DIR}/services/thankYouEmails" ]]; then
  echo "Missing required folder: ${SCRIPT_DIR}/services/thankYouEmails" >&2
  exit 1
fi

scp -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new -r \
  "${SCRIPT_DIR}/services/thankYouEmails" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/services/"

echo "Restarting kvi-home..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. emailService.js + thankYouEmails deployed + PM2 restart."
