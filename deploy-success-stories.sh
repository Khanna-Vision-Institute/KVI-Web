#!/bin/bash
# Deploy success stories page (about/why-choose-us/success-stories.html) to production KVI Node server.
set -e
# Prefer SSH_KEY env; else try Desktop, then /Users/nisha/Desktop (explicit default), then backup folder.
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
  echo "No SSH key found. Set SSH_KEY to your .pem path, e.g.:" >&2
  echo "  SSH_KEY=/path/to/khannainstitute.pem bash $0" >&2
  exit 1
fi
SSH_USER="ec2-user"
SSH_HOST="ec2-3-84-141-231.compute-1.amazonaws.com"
REMOTE_BASE="/home/ec2-user/kvi-home/kvi home"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Deploying success-stories.html + server.js (route registration) to ${SSH_HOST}..."

scp -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new \
  "${SCRIPT_DIR}/about/why-choose-us/success-stories.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/about/why-choose-us/"

scp -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new \
  "${SCRIPT_DIR}/server.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

echo "Restarting kvi-home..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. https://khannainstitute.com/about/why-choose-us/success-stories/"
