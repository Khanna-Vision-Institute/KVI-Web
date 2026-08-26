#!/bin/bash
# Deploy VIP consult thank-you (emailService + booking) and restart PM2 on EC2.
# PM2 runs on the server only — run logs via SSH, not on your Mac.
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

echo "Uploading services/emailService.js + routes/booking.js..."
"${SCP[@]}" \
  "${SCRIPT_DIR}/services/emailService.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/services/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/routes/booking.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/routes/"

echo "Restarting kvi-home on server..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. View logs ON THE SERVER:"
echo "  ssh -i \"${SSH_KEY}\" ${SSH_USER}@${SSH_HOST} 'pm2 logs kvi-home --lines 50'"
echo "After restart, look for CRITICAL lines if emailService was not updated before."
