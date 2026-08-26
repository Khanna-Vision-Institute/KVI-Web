#!/bin/bash
# Backup files touched for homepage performance (before deploy).
# Creates: backups/performance-YYYY-MM-DD-HHMM/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y-%m-%d-%H%M)"
DEST="${ROOT}/backups/performance-${STAMP}"
mkdir -p "${DEST}/partials"

cp -a "${ROOT}/server.js" "${DEST}/"
cp -a "${ROOT}/index.html" "${DEST}/"
cp -a "${ROOT}/partials/header.ejs" "${DEST}/partials/"
cp -a "${ROOT}/partials/footer.ejs" "${DEST}/partials/"

echo "Backup written to: ${DEST}"
echo "Restore example:"
echo "  cp \"${DEST}/server.js\" \"${ROOT}/\""
echo "  cp \"${DEST}/index.html\" \"${ROOT}/\""
echo "  cp \"${DEST}/partials/header.ejs\" \"${ROOT}/partials/\""
echo "  cp \"${DEST}/partials/footer.ejs\" \"${ROOT}/partials/\""
