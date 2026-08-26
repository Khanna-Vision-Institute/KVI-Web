#!/bin/bash
# Upload PIE book PDF to public/downloads (fixes 404 on /public/downloads/...).
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
LOCAL_PDF="${SCRIPT_DIR}/public/downloads/dr-khanna-pie-rejuvenate-aging-eyes.pdf"
SCP=(scp -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new)
SSH=(ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}")

if [[ ! -f "$LOCAL_PDF" ]]; then
  echo "Missing local file: $LOCAL_PDF" >&2
  echo "Copy your book first, e.g.:" >&2
  echo "  mkdir -p public/downloads && cp \"/path/to/PIE BOOK.pdf\" \"$LOCAL_PDF\"" >&2
  exit 1
fi

echo "Ensuring remote directory exists..."
"${SSH[@]}" "mkdir -p \"${REMOTE_BASE}/public/downloads\""

echo "Uploading PDF to ${SSH_HOST}..."
"${SCP[@]}" "$LOCAL_PDF" "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/public/downloads/"

echo "Done. Verify:"
echo "  curl -sI \"https://khannainstitute.com/public/downloads/dr-khanna-pie-rejuvenate-aging-eyes.pdf\""
echo "Expect: HTTP/2 200 and content-type: application/pdf"
