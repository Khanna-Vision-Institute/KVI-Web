#!/bin/bash
# Upload local VIP hero MP4 to EC2. Page URL: /public/media/vip-consult-hero.mp4 (avoid /media/* — often mapped to S3).
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
LOCAL_MP4="${SCRIPT_DIR}/public/media/vip-consult-hero.mp4"
SCP=(scp -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new)
SSH=(ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}")

if [[ ! -f "$LOCAL_MP4" ]]; then
  echo "Missing: $LOCAL_MP4" >&2
  echo "Copy your file first, e.g.:" >&2
  echo '  mkdir -p public/media && cp "/path/to/VIDEO-....mp4" public/media/vip-consult-hero.mp4' >&2
  exit 1
fi

echo "Ensuring remote public/media exists..."
"${SSH[@]}" "mkdir -p \"${REMOTE_BASE}/public/media\""

echo "Uploading vip-consult-hero.mp4 (this may take a while)..."
"${SCP[@]}" "$LOCAL_MP4" "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/public/media/"

echo "Uploading server.js..."
"${SCP[@]}" "${SCRIPT_DIR}/server.js" "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/"

echo "Restarting PM2..."
"${SSH[@]}" "pm2 restart kvi-home 2>/dev/null || pm2 restart all 2>/dev/null || true"

echo "Done. Test: curl -sI \"https://khannainstitute.com/public/media/vip-consult-hero.mp4\" (expect 200; not /media/ — that path may hit S3)"
