#!/bin/bash
# Deploy homepage RSVP banners + /seminar-rsvp/ page + seminar confirmation emails
#
# Uploads:
#   index.html, partials/header.ejs, partials/seminar-banner.ejs,
#   seminar-rsvp.html, services/emailService.js
#
# Usage:
#   cd "/Users/nisha/Downloads/kvi home"
#   KEY=~/Desktop/khannainstitute.pem \
#   HOST=ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com \
#   ./deploy-seminar-rsvp-bundle.sh
#
# Run the file (do not paste the shebang line into zsh — history expansion on "!")
set -euo pipefail

KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
HOST="${HOST:-ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com}"
REMOTE_BASE="/home/ec2-user/kvi-home/kvi home"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Back-compat with older KVI_SSH_KEY / separate user@host
if [[ -n "${KVI_SSH_KEY:-}" && -r "${KVI_SSH_KEY}" ]]; then
  KEY="${KVI_SSH_KEY}"
fi
if [[ ! -r "$KEY" ]]; then
  for c in \
    "${HOME}/Desktop/khannainstitute_backup/khannainstitute.pem" \
    "${HOME}/Downloads/khannainstitute_backup/khannainstitute.pem" \
    "${HOME}/.ssh/khannainstitute.pem" \
    "${HOME}/.ssh/kvi-ec2.pem"
  do
    if [[ -r "$c" ]]; then
      KEY="$c"
      break
    fi
  done
fi
if [[ ! -r "$KEY" ]]; then
  echo "ERROR: No readable EC2 private key found." >&2
  echo "  KEY=~/Desktop/khannainstitute.pem HOST=ec2-user@host $0" >&2
  exit 1
fi
chmod 400 "$KEY" 2>/dev/null || true

# Allow HOST=user@host or SSH_USER + SSH_HOST
if [[ "$HOST" == *"@"* ]]; then
  SSH_USER="${HOST%%@*}"
  SSH_HOST="${HOST#*@}"
else
  SSH_USER="${SSH_USER:-ec2-user}"
  SSH_HOST="$HOST"
fi

for f in index.html seminar-rsvp.html partials/header.ejs partials/seminar-banner.ejs services/emailService.js; do
  if ! grep -q "August 25" "${SCRIPT_DIR}/${f}"; then
    echo "ERROR: ${f} missing August 25 seminar date" >&2
    exit 1
  fi
done
echo "==> Local August 25 seminar date OK"

echo "Using SSH key: ${KEY}"
echo "Deploying seminar RSVP bundle to ${SSH_USER}@${SSH_HOST}..."

scp -i "${KEY}" \
  "${SCRIPT_DIR}/index.html" \
  "${SCRIPT_DIR}/seminar-rsvp.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

scp -i "${KEY}" \
  "${SCRIPT_DIR}/partials/header.ejs" \
  "${SCRIPT_DIR}/partials/seminar-banner.ejs" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/partials/"

scp -i "${KEY}" \
  "${SCRIPT_DIR}/services/emailService.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/services/"

echo "Restarting kvi-home..."
ssh -i "${KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. Deployed: index.html, seminar-rsvp.html, header.ejs, seminar-banner.ejs, emailService.js"
echo "Hard-refresh https://khannainstitute.com/ and https://khannainstitute.com/seminar-rsvp/"
