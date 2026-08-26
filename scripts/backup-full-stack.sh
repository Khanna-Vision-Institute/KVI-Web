#!/usr/bin/env bash
# Full backup: KVI Node site + Strapi app tree + MongoDB dump + optional Guru host.
# Run from project root:
#   bash scripts/backup-full-stack.sh
#
# Optional:
#   INCLUDE_NODE_MODULES=1 bash scripts/backup-full-stack.sh
#   SKIP_GURU=1 bash scripts/backup-full-stack.sh
#   SKIP_MONGO=1 bash scripts/backup-full-stack.sh
#   DELETE_REMOTE_AFTER=1 bash scripts/backup-full-stack.sh   # remove bundle on main EC2 after download
#   STRAPI_ROOT_ON_SERVER=/home/ec2-user/cms      # if pm2 cwd detection fails
#   GURU_REMOTE_BASE=/home/ec2-user/guru-app      # required for Guru tar (never use bare $HOME)
#
# Copy archives to encrypted storage (Disk / S3 / etc.). Restore is manual (extract, mongorestore, npm ci, pm2).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
STAMP="$(date +%Y-%m-%d-%H%M%S)"
LOCAL_DEST="${REPO_ROOT}/backups/full-stack-${STAMP}"
mkdir -p "${LOCAL_DEST}"

if [[ -z "${SSH_KEY:-}" ]]; then
  for candidate in \
    "${HOME}/Desktop/khannainstitute.pem" \
    "${HOME}/Desktop/khannainstitute_backup/khannainstitute.pem" \
    "/Users/nisha/Desktop/khannainstitute.pem"; do
    if [[ -f "$candidate" ]]; then
      SSH_KEY="$candidate"
      break
    fi
  done
fi
if [[ -z "${SSH_KEY:-}" ]] || [[ ! -f "$SSH_KEY" ]]; then
  echo "Set SSH_KEY to the .pem path for the main EC2 instance." >&2
  exit 1
fi

MAIN_HOST="${MAIN_HOST:-ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com}"
KVI_BASE="${KVI_BASE:-/home/ec2-user/kvi-home/kvi home}"
REMOTE_TMP="${REMOTE_TMP:-/home/ec2-user/kvi-backups}"
BUNDLE_NAME="bundle-${STAMP}"

GURU_HOST="${GURU_HOST:-ec2-user@ec2-100-28-122-42.compute-1.amazonaws.com}"
# Do not default to \$HOME — tarring the whole home dir pulls .pm2 sockets and is huge. Set explicitly.
GURU_REMOTE_BASE="${GURU_REMOTE_BASE:-}"
GURU_SSH_KEY="${GURU_SSH_KEY:-$SSH_KEY}"

STRAPI_ROOT_ON_SERVER="${STRAPI_ROOT_ON_SERVER:-}"

INCLUDE_NODE_MODULES="${INCLUDE_NODE_MODULES:-0}"
SKIP_GURU="${SKIP_GURU:-0}"
SKIP_MONGO="${SKIP_MONGO:-0}"
DELETE_REMOTE_AFTER="${DELETE_REMOTE_AFTER:-0}"

SSH_MAIN=(ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${MAIN_HOST}")
SCP_MAIN=(scp -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new)

echo "==> Local archive folder: ${LOCAL_DEST}"
echo "==> Main host: ${MAIN_HOST}"

EXCLUDE_ARGS=(--exclude=node_modules --exclude=.git --exclude=.pm2)
if [[ "${INCLUDE_NODE_MODULES}" == "1" ]]; then
  EXCLUDE_ARGS=(--exclude=.git --exclude=.pm2)
  echo "WARN: Including node_modules (very large)."
fi
EXCLUDE_STR="${EXCLUDE_ARGS[*]}"

# Remote script: all path logic runs on the server (avoid local $(dirname) bugs).
REMOTE_SCRIPT=$(cat <<EOS
set -euo pipefail
STAMP='${STAMP}'
REMOTE_TMP='${REMOTE_TMP}'
BUNDLE='${REMOTE_TMP}/${BUNDLE_NAME}'
KVI_BASE='${KVI_BASE}'
SKIP_MONGO='${SKIP_MONGO}'
EXCLUDE_STR='${EXCLUDE_STR}'
STRAPI_OVERRIDE='${STRAPI_ROOT_ON_SERVER}'

mkdir -p "\${BUNDLE}"
read -r -a _EX <<< "\${EXCLUDE_STR}"

echo "=== 1) KVI home app (tar) ==="
KVI_PARENT="\$(dirname "\${KVI_BASE}")"
KVI_LEAF="\$(basename "\${KVI_BASE}")"
tar czf "\${BUNDLE}/01-kvi-home.tar.gz" -C "\${KVI_PARENT}" "\${_EX[@]}" "\${KVI_LEAF}"

echo "=== 2) Strapi (PM2 exec cwd — avoids tarring entire \\\$HOME / .pm2) ==="
STRAPI_SCRIPT=""
STRAPI_CWD=""
if command -v pm2 >/dev/null 2>&1; then
  STRAPI_SCRIPT=\$(pm2 describe strapi-cms 2>/dev/null | awk -F'│' '/script path/ {
    gsub(/^ +| +\$/,"",\$2)
    print \$2
  }' | head -1 | tr -d ' ' || true)
  STRAPI_CWD=\$(pm2 describe strapi-cms 2>/dev/null | awk -F'│' '/exec cwd/ {
    gsub(/^ +| +\$/,"",\$2)
    print \$2
  }' | head -1 | tr -d ' ' || true)
fi
STRAPI_ROOT=""
if [[ -n "\${STRAPI_OVERRIDE}" ]]; then
  STRAPI_ROOT="\${STRAPI_OVERRIDE}"
elif [[ -n "\${STRAPI_CWD}" ]]; then
  STRAPI_ROOT="\${STRAPI_CWD}"
elif [[ -n "\${STRAPI_SCRIPT}" ]]; then
  STRAPI_ROOT="\$(dirname "\${STRAPI_SCRIPT}")"
fi

if [[ -z "\${STRAPI_ROOT}" ]]; then
  echo "strapi-cms missing from pm2 or paths empty. On your Mac: STRAPI_ROOT_ON_SERVER=/path/to/strapi bash scripts/backup-full-stack.sh" | tee "\${BUNDLE}/02-strapi-SKIPPED.txt"
elif [[ ! -d "\${STRAPI_ROOT}" ]]; then
  echo "Strapi path is not a directory: \${STRAPI_ROOT}" | tee "\${BUNDLE}/02-strapi-ERROR.txt"
elif [[ "\${STRAPI_ROOT}" == "\${HOME}" ]] || [[ "\${STRAPI_ROOT}" == "/home/ec2-user" ]]; then
  echo "Refusing to archive Strapi root = login home (includes .pm2 sockets, entire account). Set STRAPI_ROOT_ON_SERVER to the real Strapi project directory (same as PM2 exec cwd)." | tee "\${BUNDLE}/02-strapi-SKIPPED.txt"
else
  echo "\${STRAPI_ROOT}" > "\${BUNDLE}/02-strapi-root.txt"
  SPARENT="\$(dirname "\${STRAPI_ROOT}")"
  SLEAF="\$(basename "\${STRAPI_ROOT}")"
  if tar czf "\${BUNDLE}/02-strapi-app.tar.gz" -C "\${SPARENT}" "\${_EX[@]}" "\${SLEAF}"; then
    :
  else
    echo "Strapi tar failed — check permissions/path: \${STRAPI_ROOT}" | tee "\${BUNDLE}/02-strapi-ERROR.txt"
  fi
fi

echo "=== 3) MongoDB (mongodump) ==="
if [[ "\${SKIP_MONGO}" == "1" ]]; then
  echo "SKIP_MONGO=1 — skipped." > "\${BUNDLE}/03-mongo-SKIPPED.txt"
elif ! command -v mongodump >/dev/null 2>&1; then
  echo "mongodump not on PATH — install mongodb-database-tools or dump manually." | tee "\${BUNDLE}/03-mongo-SKIPPED.txt"
else
  cd "\${KVI_BASE}"
  URI=\$(node -e "
    require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
    const u = process.env.MONGODB_URI;
    if (u) { console.log(u); process.exit(0); }
    const db = process.env.MONGODB_DB || 'blog';
    const user = process.env.MONGODB_USER || 'bloguser';
    const pass = process.env.MONGODB_PASS || '';
    const host = process.env.MONGODB_HOST || '127.0.0.1';
    const port = process.env.MONGODB_PORT || '27017';
    const auth = encodeURIComponent(pass);
    console.log('mongodb://' + user + ':' + auth + '@' + host + ':' + port + '/' + db + '?authSource=' + db);
  " 2>/dev/null || true)
  if [[ -z "\${URI}" ]]; then
    echo "Could not build Mongo URI from .env (see services/mongodb.js for vars)." | tee "\${BUNDLE}/03-mongo-ERROR.txt"
  elif mongodump --uri="\${URI}" --out="\${BUNDLE}/03-mongo-dump"; then
    tar czf "\${BUNDLE}/03-mongo-dump.tar.gz" -C "\${BUNDLE}" 03-mongo-dump
    rm -rf "\${BUNDLE}/03-mongo-dump"
  else
    echo "mongodump failed (auth, network, or mongod not running)." | tee "\${BUNDLE}/03-mongo-ERROR.txt"
  fi
fi

echo "=== 4) PM2 snapshot ==="
( pm2 jlist 2>/dev/null || true ) > "\${BUNDLE}/pm2-jlist.json"
( pm2 list 2>/dev/null || true ) > "\${BUNDLE}/pm2-list.txt"

echo "=== 5) Manifest ==="
{
  echo "STAMP=\${STAMP}"
  echo "HOST=\$(hostname || true)"
  date -u
  ls -la "\${BUNDLE}"
} > "\${BUNDLE}/MANIFEST.txt"

cd "\${REMOTE_TMP}"
tar cf - "${BUNDLE_NAME}" | gzip -9 > "${BUNDLE_NAME}.tar.gz"
echo "REMOTE_BUNDLE=${REMOTE_TMP}/${BUNDLE_NAME}.tar.gz"
EOS
)

REMOTE_OUT="$("${SSH_MAIN[@]}" bash -s <<REMOTE_EOF
${REMOTE_SCRIPT}
REMOTE_EOF
)"

REMOTE_TGZ="$(printf '%s\n' "${REMOTE_OUT}" | grep '^REMOTE_BUNDLE=' | tail -1 | cut -d= -f2-)"
if [[ -z "${REMOTE_TGZ}" ]]; then
  echo "Could not determine remote bundle path. SSH output:" >&2
  printf '%s\n' "${REMOTE_OUT}" >&2
  exit 1
fi

echo "==> Downloading ${REMOTE_TGZ}"
"${SCP_MAIN[@]}" "${MAIN_HOST}:${REMOTE_TGZ}" "${LOCAL_DEST}/"

TGZ_FILE="${LOCAL_DEST}/$(basename "${REMOTE_TGZ}")"
echo "==> Extracting locally: ${TGZ_FILE}"
tar xzf "${TGZ_FILE}" -C "${LOCAL_DEST}"
rm -f "${TGZ_FILE}"

if [[ "${DELETE_REMOTE_AFTER}" == "1" ]]; then
  echo "==> Removing remote bundle (DELETE_REMOTE_AFTER=1)"
  "${SSH_MAIN[@]}" "rm -rf '${REMOTE_TMP}/${BUNDLE_NAME}' '${REMOTE_TMP}/${BUNDLE_NAME}.tar.gz'" || true
fi

# Guru: separate EC2 — set GURU_REMOTE_BASE to the app root (never bare \$HOME)
if [[ "${SKIP_GURU}" != "1" ]]; then
  GURU_OUT="${LOCAL_DEST}/guru-host"
  mkdir -p "${GURU_OUT}"
  if [[ -z "${GURU_REMOTE_BASE}" ]]; then
    echo "Guru: set GURU_REMOTE_BASE=/path/on/guru/server (skipping). Example: GURU_REMOTE_BASE=/home/ec2-user/guru-api" \
      | tee "${GURU_OUT}/README-GURU-SET-GURU_REMOTE_BASE.txt"
  else
    echo "==> Guru host: ${GURU_HOST} (GURU_REMOTE_BASE=${GURU_REMOTE_BASE})"
    GURU_REMOTE_FILE="/tmp/guru-backup-${STAMP}.tar.gz"
    if ssh -i "${GURU_SSH_KEY}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -o BatchMode=yes "${GURU_HOST}" "echo ok" &>/dev/null; then
      ssh -i "${GURU_SSH_KEY}" -o StrictHostKeyChecking=accept-new "${GURU_HOST}" bash -s <<GURU_EOF
set -euo pipefail
BASE='${GURU_REMOTE_BASE}'
OUT='${GURU_REMOTE_FILE}'
if [[ ! -d "\$BASE" ]]; then
  echo "GURU_REMOTE_BASE not a directory: \$BASE" >&2
  exit 1
fi
tar czf "\$OUT" -C "\$BASE" \\
  --exclude=node_modules --exclude=.git --exclude=.pm2 --exclude=.ssh --exclude=.cache \\
  .
echo "ok:\$OUT"
GURU_EOF
      if scp -i "${GURU_SSH_KEY}" -o StrictHostKeyChecking=accept-new \
        "${GURU_HOST}:${GURU_REMOTE_FILE}" "${GURU_OUT}/guru-app-${STAMP}.tar.gz"; then
        ssh -i "${GURU_SSH_KEY}" -o StrictHostKeyChecking=accept-new "${GURU_HOST}" "rm -f '${GURU_REMOTE_FILE}'" || true
      fi
    else
      echo "SSH to Guru host failed (key, security group, or host). Set GURU_HOST / GURU_SSH_KEY / GURU_REMOTE_BASE." \
        | tee "${GURU_OUT}/README-GURU-SSH-FAILED.txt"
    fi
  fi
else
  echo "SKIP_GURU=1 — Guru host skipped."
fi

echo ""
echo "Done. Backup at:"
echo "  ${LOCAL_DEST}/${BUNDLE_NAME}/"
echo ""
echo "Typical files:"
echo "  01-kvi-home.tar.gz"
echo "  02-strapi-app.tar.gz (or 02-strapi-SKIPPED.txt)"
echo "  03-mongo-dump.tar.gz (or skip / error notes)"
echo "  pm2-list.txt, pm2-jlist.json"
echo "  guru-host/guru-app-*.tar.gz (if Guru SSH worked)"
