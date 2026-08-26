#!/bin/bash
# Site recovery after 502 / bad npm installs.
# Uploads canonical server + packages + guru + header + email, then MUST succeed:
#   rm -rf node_modules && npm ci --omit=dev
# Separately restarts PM2 (no masking with || true on install).
#
# From project root:
#   bash deploy-site-recovery-npm-ci.sh
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
SSH=(ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}")

for f in \
  "${SCRIPT_DIR}/server.js" \
  "${SCRIPT_DIR}/package.json" \
  "${SCRIPT_DIR}/package-lock.json" \
  "${SCRIPT_DIR}/public/js/guru-chat-embed.js" \
  "${SCRIPT_DIR}/partials/header.ejs" \
  "${SCRIPT_DIR}/services/emailService.js" \
  "${SCRIPT_DIR}/legacy-wordpress-redirects.js"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing required file: $f" >&2
    exit 1
  fi
done

if [[ ! -d "${SCRIPT_DIR}/services/thankYouEmails" ]]; then
  echo "Missing required folder: ${SCRIPT_DIR}/services/thankYouEmails" >&2
  exit 1
fi

echo "Uploading server + lockfiles + guru + header + emailService + legacy-wordpress-redirects..."
"${SCP[@]}" \
  "${SCRIPT_DIR}/server.js" \
  "${SCRIPT_DIR}/package.json" \
  "${SCRIPT_DIR}/package-lock.json" \
  "${SCRIPT_DIR}/legacy-wordpress-redirects.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/services/emailService.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/services/"

echo "Uploading thank-you email helpers (required by emailService)..."
scp -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new -r \
  "${SCRIPT_DIR}/services/thankYouEmails" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/services/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/public/js/guru-chat-embed.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/public/js/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/partials/header.ejs" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/partials/"

echo "Removing stale physician route if present..."
"${SSH[@]}" "rm -f \"${REMOTE_BASE}/routes/physicianReferral.js\""

echo "Remote: node/npm versions + syntax check..."
"${SSH[@]}" "cd \"${REMOTE_BASE}\" && node -v && npm -v && node --check server.js"

echo "Remote: clean install from package-lock (production only)..."
"${SSH[@]}" "cd \"${REMOTE_BASE}\" && rm -rf node_modules && npm ci --omit=dev"

echo "Remote: PM2 restart..."
"${SSH[@]}" "cd \"${REMOTE_BASE}\" && { pm2 restart kvi-home || pm2 restart all; } && pm2 ls"

echo ""
echo "Done. Test: curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:3000/  (on the server, if PORT=3000)"
echo "If still 502, on the server run:  pm2 logs kvi-home --lines 150"
