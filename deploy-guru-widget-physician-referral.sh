#!/bin/bash
# Guru chat widget, physician pages, referral API (no multer), emailService, package.json.
# npm install + PM2 restart on server.
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

"${SSH[@]}" "mkdir -p \"${REMOTE_BASE}/physicians\" \"${REMOTE_BASE}/public/js\" \"${REMOTE_BASE}/routes\" \"${REMOTE_BASE}/services\""

echo "Uploading guru-chat-embed.js..."
"${SCP[@]}" "${SCRIPT_DIR}/public/js/guru-chat-embed.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/public/js/"

echo "Uploading physician pages..."
"${SCP[@]}" \
  "${SCRIPT_DIR}/physicians/for-physicians.html" \
  "${SCRIPT_DIR}/physicians/refer-a-patient.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/physicians/"

echo "Uploading physician referral route..."
"${SCP[@]}" "${SCRIPT_DIR}/routes/physicianReferral.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/routes/"

echo "Uploading emailService.js + thankYouEmails/ (required at startup by emailService) + package.json..."
"${SCP[@]}" "${SCRIPT_DIR}/services/emailService.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/services/"
# emailService.js require()'s ./thankYouEmails/*.js — without this folder the app exits on boot (502).
"${SSH[@]}" "mkdir -p \"${REMOTE_BASE}/services/thankYouEmails\""
"${SCP[@]}" -r "${SCRIPT_DIR}/services/thankYouEmails" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/services/"
"${SCP[@]}" "${SCRIPT_DIR}/package.json" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

echo "npm install + PM2 restart on ${SSH_HOST}..."
"${SSH[@]}" "cd \"${REMOTE_BASE}\" && { npm install --omit=dev 2>/dev/null || npm install; }"
"${SSH[@]}" "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo ""
echo "Done."
echo "  Guru widget + dismiss: /public/js/guru-chat-embed.js"
echo "  Physician hub: https://khannainstitute.com/for-physicians/"
echo "  Referral form: https://khannainstitute.com/referrals/"
