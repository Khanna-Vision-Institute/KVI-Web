#!/bin/bash
# Deploy booking-widget (reCAPTCHA) + SMILE laser page (testimonials without videos)
set -e
SSH_KEY="${SSH_KEY:-${HOME}/Desktop/khannainstitute.pem}"
if [[ ! -f "$SSH_KEY" ]]; then
  SSH_KEY="${HOME}/Desktop/khannainstitute_backup/khannainstitute.pem"
fi
SSH_USER="ec2-user"
SSH_HOST="ec2-3-84-141-231.compute-1.amazonaws.com"
REMOTE_BASE="/home/ec2-user/kvi-home/kvi home"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Deploying to ${SSH_HOST}..."

scp -i "${SSH_KEY}" \
  "${SCRIPT_DIR}/partials/booking-widget.ejs" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/partials/"

scp -i "${SSH_KEY}" \
  "${SCRIPT_DIR}/procedures/laser-vision/smile-page-complete.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/procedures/laser-vision/"

echo "Restarting kvi-home (reloads EJS partials)..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. booking-widget.ejs + smile-page-complete.html deployed."
