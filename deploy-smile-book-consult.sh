#!/bin/bash
# Deploy SMILE cost page updates + smile-book-consultation pages + API + email helpers
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

echo "Deploying SMILE book consult bundle to ${SSH_HOST}..."

"${SCP[@]}" \
  "${SCRIPT_DIR}/smile-cost.html" \
  "${SCRIPT_DIR}/smile-book-consultation.html" \
  "${SCRIPT_DIR}/smile-book-consultation-thank-you.html" \
  "${SCRIPT_DIR}/server.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/routes/smileBookConsult.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/routes/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/services/emailService.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/services/"

echo "Restarting kvi-home..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. Static pages + server.js + routes/smileBookConsult.js + services/emailService.js deployed."
