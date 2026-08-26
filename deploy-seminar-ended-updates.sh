#!/bin/bash
# Upload homepage, seminar RSVP (ended page + backup), and mobile header partial.
# No server.js change — PM2 restart omitted (same as other static-only deploys).
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

echo "Uploading seminar-ended updates to ${SSH_HOST}..."
"${SCP[@]}" \
  "${SCRIPT_DIR}/index.html" \
  "${SCRIPT_DIR}/seminar-rsvp.html" \
  "${SCRIPT_DIR}/seminar-rsvp-backup-2026-04-21.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/partials/header.ejs" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/partials/"

echo "Done. Deployed: index.html, seminar-rsvp.html, seminar-rsvp-backup-2026-04-21.html, partials/header.ejs"
echo "  https://khannainstitute.com/"
echo "  https://khannainstitute.com/seminar-rsvp/"
echo ""
echo "If header changes do not appear, restart once on the server:"
echo "  ssh -i \"\$SSH_KEY\" ${SSH_USER}@${SSH_HOST} 'pm2 restart kvi-home'"
