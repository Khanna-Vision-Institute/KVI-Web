#!/usr/bin/env bash
set -euo pipefail

# Deploy refer-a-patient worksheet to EC2 + restart pm2.
#
# Usage (from repo root, or any cwd — paths below are absolute to this machine):
#   export EC2="ec2-3-84-141-231.compute-1.amazonaws.com"
#   export KEY="$HOME/Desktop/khannainstitute.pem"
#   export SRC="$HOME/Downloads/kvi home"
#   export REMOTE_ROOT="/home/ec2-user/kvi-home/kvi home"
#   bash scripts/deploy-refer-a-patient-ec2.sh
#
# Optional: add Heritage / manifest files in one go:
#   WITH_HERITAGE=1 bash scripts/deploy-refer-a-patient-ec2.sh

EC2="${EC2:-}"
KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
SRC="${SRC:-$HOME/Downloads/kvi home}"
REMOTE_ROOT="${REMOTE_ROOT:-/home/ec2-user/kvi-home/kvi home}"
WITH_HERITAGE="${WITH_HERITAGE:-0}"

if [[ -z "$EC2" ]]; then
  echo "Set EC2, e.g. export EC2=ec2-xxxx.compute-1.amazonaws.com" >&2
  exit 1
fi
if [[ ! -f "$KEY" ]]; then
  echo "PEM not found: $KEY" >&2
  exit 1
fi

SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new)

ssh "${SSH_OPTS[@]}" "ec2-user@${EC2}" \
  "mkdir -p \"${REMOTE_ROOT}/public/physician-portal\" \"${REMOTE_ROOT}/docs\" \"${REMOTE_ROOT}/data\" \"${REMOTE_ROOT}/scripts\""

scp "${SSH_OPTS[@]}" \
  "${SRC}/public/physician-portal/refer-a-patient.html" \
  "ec2-user@${EC2}:${REMOTE_ROOT}/public/physician-portal/refer-a-patient.html"

if [[ "$WITH_HERITAGE" == "1" ]]; then
  scp "${SSH_OPTS[@]}" \
    "${SRC}/public/physician-portal/referral-directory.html" \
    "ec2-user@${EC2}:${REMOTE_ROOT}/public/physician-portal/referral-directory.html"
  scp "${SSH_OPTS[@]}" \
    "${SRC}/data/referral-offices.json" \
    "ec2-user@${EC2}:${REMOTE_ROOT}/data/referral-offices.json"
  scp "${SSH_OPTS[@]}" \
    "${SRC}/scripts/import-od-master-to-referral-offices.js" \
    "ec2-user@${EC2}:${REMOTE_ROOT}/scripts/import-od-master-to-referral-offices.js"
  scp "${SSH_OPTS[@]}" \
    "${SRC}/docs/import-heritage-od-master.md" \
    "ec2-user@${EC2}:${REMOTE_ROOT}/docs/import-heritage-od-master.md"
  scp "${SSH_OPTS[@]}" \
    "${SRC}/package.json" \
    "ec2-user@${EC2}:${REMOTE_ROOT}/package.json"
fi

ssh "${SSH_OPTS[@]}" "ec2-user@${EC2}" "pm2 restart kvi-home"

echo "Deploy finished (WITH_HERITAGE=${WITH_HERITAGE})."
