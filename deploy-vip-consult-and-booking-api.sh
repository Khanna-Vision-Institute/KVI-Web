#!/bin/bash
# Upload VIP Consult page + booking API (vip-consult + captcha + email) + PM2 restart.
# Does NOT upload server.js or legacy-wordpress-redirects.js unless you add them.
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

echo "Uploading vip-consult.html, routes/booking.js, services/emailService.js to ${SSH_HOST}..."
"${SCP[@]}" \
  "${SCRIPT_DIR}/vip-consult.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/routes/booking.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/routes/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/services/emailService.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/services/"

echo "Restarting kvi-home (PM2)..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. Deployed: VIP page + /api/booking/vip-consult + email. Test: https://khannainstitute.com/VIP-Consult"
