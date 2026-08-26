#!/bin/bash
# Deploy homepage performance changes: server.js, index.html, partials/header.ejs, partials/footer.ejs
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

echo "Uploading server.js + index.html + partials (header/footer) to ${SSH_HOST}..."
"${SCP[@]}" \
  "${SCRIPT_DIR}/server.js" \
  "${SCRIPT_DIR}/index.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

"${SCP[@]}" \
  "${SCRIPT_DIR}/partials/header.ejs" \
  "${SCRIPT_DIR}/partials/footer.ejs" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/partials/"

echo "Restarting kvi-home (needed for server.js + static cache headers)..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. Test: https://khannainstitute.com/ (hard-refresh or incognito for CSS/JS cache)"
