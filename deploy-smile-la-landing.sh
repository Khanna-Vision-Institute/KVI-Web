#!/bin/bash
# Deploy SMILE LA landing page + smile-landing-lead API route
#
# Usage:
#   ./deploy-smile-la-landing.sh
#   KVI_SSH_KEY="$HOME/path/to/your-key.pem" ./deploy-smile-la-landing.sh
#
# Do not paste this file into zsh/bash interactively — the line #!/bin/bash
# triggers zsh history expansion on "!". Run the file: ./deploy-smile-la-landing.sh
set -euo pipefail

SSH_USER="ec2-user"
SSH_HOST="ec2-3-84-141-231.compute-1.amazonaws.com"
REMOTE_BASE="/home/ec2-user/kvi-home/kvi home"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

resolve_ssh_key() {
  if [[ -n "${KVI_SSH_KEY:-}" && -r "${KVI_SSH_KEY}" ]]; then
    printf '%s' "${KVI_SSH_KEY}"
    return 0
  fi
  local c
  for c in \
    "${HOME}/Desktop/khannainstitute_backup/khannainstitute.pem" \
    "${HOME}/Downloads/khannainstitute_backup/khannainstitute.pem" \
    "${HOME}/.ssh/khannainstitute.pem" \
    "${HOME}/.ssh/kvi-ec2.pem"
  do
    if [[ -r "$c" ]]; then
      printf '%s' "$c"
      return 0
    fi
  done
  return 1
}

SSH_KEY="$(resolve_ssh_key)" || {
  echo "ERROR: No readable EC2 private key found." >&2
  echo "Set the path explicitly, then run this script again:" >&2
  echo "  export KVI_SSH_KEY=\"/full/path/to/your-key.pem\"" >&2
  echo "  \"$0\"" >&2
  echo "If the key exists but OpenSSH refuses it, try: chmod 400 \"\$KVI_SSH_KEY\"" >&2
  exit 1
}

echo "Using SSH key: ${SSH_KEY}"
echo "Deploying SMILE LA landing + routes to ${SSH_HOST}..."

scp -i "${SSH_KEY}" \
  "${SCRIPT_DIR}/smile-la-landing-page-2026.html" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

scp -i "${SSH_KEY}" \
  "${SCRIPT_DIR}/routes/smileLandingLead.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/routes/"

scp -i "${SSH_KEY}" \
  "${SCRIPT_DIR}/services/emailService.js" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/services/"

echo "Restarting kvi-home..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. Landing page + routes/smileLandingLead.js + services/emailService.js deployed."
