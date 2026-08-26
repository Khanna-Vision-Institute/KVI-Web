#!/usr/bin/env bash
# Download Guru “local database” files (JSON + backups) to your Mac.
# Vector/embeddings usually live in AWS OpenSearch—that is separate (see footer).
#
# Usage:
#   GURU_SSH_KEY=/Users/nisha/Desktop/gururag.pem \
#   GURU_SSH_USER=ubuntu \
#   bash "/Users/nisha/Downloads/kvi home/scripts/guru-download-local-data.sh"
#
set -euo pipefail

if [[ -z "${GURU_SSH_KEY:-}" ]] || [[ ! -f "$GURU_SSH_KEY" ]]; then
  echo "Set GURU_SSH_KEY to your gururag.pem path." >&2
  exit 1
fi

GURU_HOST="${GURU_HOST:-ec2-100-28-122-42.compute-1.amazonaws.com}"
GURU_SSH_USER="${GURU_SSH_USER:-ubuntu}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/guru_rag}"

STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
OUT="${HOME}/Backups/guru-local-files/${STAMP}"
mkdir -p "$OUT"

SCP_BASE=(scp -i "$GURU_SSH_KEY" -o StrictHostKeyChecking=accept-new)
REMOTE="${GURU_SSH_USER}@${GURU_HOST}:${REMOTE_DIR}"

echo "Copying Guru data files → $OUT"

for name in guru_faqs.json knn.json guru_logs.json; do
  if "${SCP_BASE[@]}" "${REMOTE}/${name}" "${OUT}/" 2>/dev/null; then
    echo "  ok ${name}"
  else
    echo "  skip ${name} (missing or unreadable)"
  fi
done

"${SCP_BASE[@]}" -r "${REMOTE}/backups" "${OUT}/" 2>/dev/null && echo "  ok backups/" || echo "  skip backups/ (missing)"

echo ""
echo "Done. Local folder: $OUT"
echo ""
echo "If you already have guru-rag-app_*.tar.gz from guru-db-pull.sh, extract it for the full repo+copy:"
echo "  mkdir -p ~/Backups/guru-extracted && tar -xzf /path/to/guru-rag-app_*.tar.gz -C ~/Backups/guru-extracted"
echo ""
echo "OpenSearch/AOSS indexes are NOT JSON files—their data is in AWS. Export via AWS Console/OpenSearch snapshots"
echo "or your app’s opensearch APIs (see guru_rag/opensearch_client.py on the server or in your tarball)."
exit 0
