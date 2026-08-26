#!/bin/bash
# Upload Epioxa HTML + header assets + server routes + restart PM2.
#
# Why server.js is required: URLs under /procedures/ are excluded from the app's
# extension-less HTML fallback. If routeMap does not register these paths on the
# server, Express falls through to the 404 handler ("Page not found").
set -euo pipefail

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

echo "Uploading Epioxa pages + header + server routes to ${SSH_HOST}..."

"${SCP[@]}" \
  "${SCRIPT_DIR}/procedures/specialty-treatments/epioxa-westlake-village.html" \
  "${SCRIPT_DIR}/procedures/specialty-treatments/epioxa-beverly-hills.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/procedures/specialty-treatments/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/partials/header.ejs" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/partials/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/public/css/header.css" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/public/css/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/server.js" \
  "${SCRIPT_DIR}/legacy-wordpress-redirects.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

echo "Restarting kvi-home (loads new routeMap entries)..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. Uploaded:"
echo "  procedures/specialty-treatments/epioxa-westlake-village.html"
echo "  procedures/specialty-treatments/epioxa-beverly-hills.html"
echo "  partials/header.ejs"
echo "  public/css/header.css"
echo "  server.js"
echo "  legacy-wordpress-redirects.js"
echo ""
echo "Verify:"
echo "  https://khannainstitute.com/procedures/specialty-treatments/epioxa-westlake-village/"
echo "  https://khannainstitute.com/procedures/specialty-treatments/epioxa-beverly-hills/"
