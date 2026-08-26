#!/bin/bash
# Read-only diagnostics on EC2 (no file changes). Run from project root.
#   bash diagnose-502-on-server.sh
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

ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" bash -s <<'REMOTE'
set -e
BASE="/home/ec2-user/kvi-home/kvi home"
cd "$BASE" || { echo "Cannot cd to $BASE"; exit 1; }
echo "=== pwd ==="
pwd
echo "=== node / npm ==="
command -v node && node -v || echo "node missing"
command -v npm && npm -v || echo "npm missing"
echo "=== server.js head (require lines) ==="
head -n 25 server.js
echo "=== syntax check ==="
node --check server.js && echo "server.js: OK" || echo "server.js: SYNTAX ERROR"
echo "=== services/thankYouEmails (required by emailService.js top-level require) ==="
ls -la services/thankYouEmails 2>&1 || echo "MISSING — from your Mac repo root run: bash fix-thankyou-email-modules-on-server.sh"
echo "=== physician referral route (only needed if server.js mounts it) ==="
ls -la routes/physicianReferral.js 2>&1 || true
echo "=== pm2 ==="
pm2 ls 2>&1 || true
echo "=== pm2 describe kvi-home ==="
pm2 describe kvi-home 2>&1 | head -40 || true
echo "=== last log lines kvi-home ==="
pm2 logs kvi-home --lines 80 --nostream 2>&1 || true
echo "=== listen :3000? ==="
(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':3000|:3001' || echo "(no match for 3000/3001 — check PORT in .env / nginx upstream)"
REMOTE
