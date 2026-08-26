#!/bin/bash
# Save a dated backup of vip-consult.html next to the original.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/vip-consult.html"
STAMP="$(date +%Y-%m-%d-%H%M)"
DST="${ROOT}/vip-consult-backup-${STAMP}.html"
cp "${SRC}" "${DST}"
echo "Wrote ${DST}"
