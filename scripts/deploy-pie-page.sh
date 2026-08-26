#!/usr/bin/env bash
# Deploy PIE procedure page (pie-rle-service-page.html) to production EC2.
# Live site shows EnVista until this file on the server matches your local copy.
#
# Override defaults:
#   SSH_KEY=/path/to/key.pem REMOTE_DIR='/home/ec2-user/your-app' bash scripts/deploy-pie-page.sh
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
REMOTE_FILE="${REMOTE_DIR}/procedures/lens-solutions/pie-rle-service-page.html"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SRC="${REPO_ROOT}/procedures/lens-solutions/pie-rle-service-page.html"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "Missing SSH key: $SSH_KEY" >&2
  echo "Set SSH_KEY=/path/to/your.pem or place key at default path." >&2
  exit 1
fi
if [[ ! -f "$SRC" ]]; then
  echo "Missing source file: $SRC" >&2
  exit 1
fi

echo "Uploading $(basename "$SRC") -> ${HOST}:${REMOTE_FILE}"
scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new \
  "$SRC" "${HOST}:${REMOTE_FILE}"

echo "Verifying Envy block on server (build marker + trifocal bullets, no EnVista)..."
ssh -i "$SSH_KEY" -o BatchMode=yes "$HOST" \
  "set -e; f='${REMOTE_FILE}'; \
   grep -q 'PIE_PAGE_BUILD: envy-trifocal' \"\$f\" || { echo 'FAIL: build marker missing — wrong or stale file on server'; exit 1; }; \
   grep -q 'Excellent reading and screen clarity' \"\$f\" || { echo 'FAIL: Envy bullets missing'; exit 1; }; \
   if grep -q 'EnVista' \"\$f\"; then echo 'FAIL: EnVista still in file — deploy path or file copy is wrong'; exit 1; fi; \
   echo 'Remote file OK.'"

echo "Restarting kvi-home..."
ssh -i "$SSH_KEY" -o BatchMode=yes "$HOST" \
  "cd '${REMOTE_DIR}' && pm2 restart kvi-home"

echo "Done. Check live: curl -sS 'https://khannainstitute.com/procedures/lens-solutions/pie/' | grep -E 'PIE_PAGE_BUILD|EnVista|Envy' | head -5"
echo "If URL still shows EnVista: wrong REMOTE_DIR (pm2 cwd), CDN cache, or a second copy of this HTML elsewhere."
