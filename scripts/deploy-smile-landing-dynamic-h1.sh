#!/usr/bin/env bash
# Deploy SMILE landing pages (dynamic Ads H1) to production EC2.
# Files:
#   - smile-la-landing-page-2026.html  → /smile-la-landing-page-2026/
#   - smile-cost.html                  → /smile-cost/
#
# Override defaults:
#   SSH_KEY=/path/to/key.pem SSH_HOST=user@host REMOTE_DIR='/home/ec2-user/kvi-home/kvi home' \
#     bash scripts/deploy-smile-landing-dynamic-h1.sh
set -euo pipefail

SSH_KEY="${SSH_KEY:-${HOME}/Desktop/khannainstitute.pem}"
if [[ ! -f "$SSH_KEY" ]]; then
  ALT="${HOME}/Desktop/khannainstitute_backup/khannainstitute.pem"
  if [[ -f "$ALT" ]]; then
    SSH_KEY="$ALT"
  fi
fi
HOST="${SSH_HOST:-ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com}"
REMOTE_DIR="${REMOTE_DIR:-/home/ec2-user/kvi-home/kvi home}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

FILES=(
  "smile-la-landing-page-2026.html"
  "smile-cost.html"
)

if [[ ! -f "$SSH_KEY" ]]; then
  echo "Missing SSH key: $SSH_KEY" >&2
  echo "Set SSH_KEY=/path/to/your.pem or place key at default path." >&2
  exit 1
fi

for f in "${FILES[@]}"; do
  src="${REPO_ROOT}/${f}"
  if [[ ! -f "$src" ]]; then
    echo "Missing source file: $src" >&2
    exit 1
  fi
done

for f in "${FILES[@]}"; do
  src="${REPO_ROOT}/${f}"
  remote="${REMOTE_DIR}/${f}"
  echo "Uploading ${f} -> ${HOST}:${remote}"
  scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new \
    "$src" "${HOST}:${remote}"
done

echo "Verifying dynamic-ad markers on server..."
ssh -i "$SSH_KEY" -o BatchMode=yes "$HOST" \
  "set -e
   for f in smile-la-landing-page-2026.html smile-cost.html; do
     p='${REMOTE_DIR}'/\"\$f\"
     grep -q 'id=\"dynamic-ad-h1\"' \"\$p\" || { echo \"FAIL: id=dynamic-ad-h1 missing in \$p\"; exit 1; }
     grep -q 'getElementById(\"dynamic-ad-h1\")' \"\$p\" || { echo \"FAIL: dynamic H1 script missing in \$p\"; exit 1; }
   done
   echo 'Remote files OK.'"

echo "Restarting kvi-home..."
ssh -i "$SSH_KEY" -o BatchMode=yes "$HOST" \
  "cd '${REMOTE_DIR}' && pm2 restart kvi-home"

echo "Done. Quick check (optional):"
echo "  curl -sS 'https://khannainstitute.com/smile-la-landing-page-2026/' | grep -o 'dynamic-ad-h1' | head -1"
echo "  curl -sS 'https://khannainstitute.com/smile-cost/'           | grep -o 'dynamic-ad-h1' | head -1"
echo "Hard-refresh in the browser if a CDN caches HTML."
