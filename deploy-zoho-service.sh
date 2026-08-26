#!/bin/bash
# Upload server.js (trust proxy for OAuth), services/zohoService.js, routes/visionQuest.js + PM2 restart.
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

echo "Uploading Zoho OAuth stack to ${SSH_HOST}..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "mkdir -p \"${REMOTE_BASE}/scripts\""
"${SCP[@]}" \
  "${SCRIPT_DIR}/server.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"
"${SCP[@]}" \
  "${SCRIPT_DIR}/services/zohoService.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/services/"
"${SCP[@]}" \
  "${SCRIPT_DIR}/routes/visionQuest.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/routes/"
"${SCP[@]}" \
  "${SCRIPT_DIR}/scripts/zoho-exchange-self-client-code.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/scripts/"

echo "Restarting kvi-home..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. server.js + zohoService.js + visionQuest.js deployed + PM2 restart."
echo ""
echo "Production OAuth:"
echo "  - Zoho authorized redirect + authorize URL must use:"
echo "      https://khannainstitute.com/api/vision-quest/oauth/callback"
echo "  - Server .env: ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET; omit ZOHO_OAUTH_REDIRECT_URI unless it must differ from the URL in the browser bar."
echo "  - After OAuth shows refresh token: ZOHO_REFRESH_TOKEN=... on server → pm2 restart kvi-home --update-env"
echo "  - PM2: prefer fork / instances 1 for OAuth; latest visionQuest adds a cross-process lock if multiple workers exist."
echo "  - Self Client bypass: put ZOHO_* for that client in .env, then:"
echo "      node scripts/zoho-exchange-self-client-code.js \"<grant_code>\""
