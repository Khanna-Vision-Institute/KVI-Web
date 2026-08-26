#!/usr/bin/env bash
# Full-stack backup (Mac → EC2): local repo + remote kvi-home app + PM2/nginx + Mongo + Strapi dirs + Guru host.
#
# Defaults match this project (see server.js: GURU proxy, localhost Strapi hint).
#
# Prerequisites on web host:
#   - mongodb-database-tools (mongodump) installed if you want DB backup
#
# Usage:
#   bash scripts/full-stack-backup.sh
#
# Common overrides:
#   SSH_KEY=/path.pem
#   REPO_ROOT="/path/to/kvi home"
#   BACKUP_PARENT=~/Desktop/kvi-stack-backups
#   SKIP_GURU_BACKUP=1
#   SKIP_STRAPI_ON_WEBHOST=1
#   STRAPI_BACKUP_HOST=ec2-xx.compute-1.amazonaws.com STRAPI_BACKUP_PATHS='/home/ec2-user/strapi'
#   GURU_BACKUP_HOST=... GURU_BACKUP_PATHS='/home/ec2-user/guru-app'
#   GURU_SSH_KEY=/path/to/guru-instance.pem GURU_SSH_USER=ec2-user   # Guru is often another keypair
#
set -euo pipefail

stamp_log() {
  printf '[%s] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"
}

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
  echo "Set SSH_KEY to your .pem (key not auto-found)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="${REPO_ROOT:-$DEFAULT_REPO}"

SSH_USER="${SSH_USER:-ec2-user}"
WEB_HOST="${WEB_HOST:-ec2-3-84-141-231.compute-1.amazonaws.com}"
REMOTE_APP_PARENT="${REMOTE_APP_PARENT:-/home/ec2-user/kvi-home}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-kvi home}"
REMOTE_APP_FULL="${REMOTE_APP_PARENT}/${REMOTE_APP_DIR}"

BACKUP_PARENT="${BACKUP_PARENT:-${HOME}/Backups/kvi-stack}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
OUT="${BACKUP_PARENT}/${STAMP}_full"
mkdir -p "$OUT/logs"

SSH_WEB=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${WEB_HOST}")

manifest="${OUT}/MANIFEST.txt"
exec >> >(tee -a "${OUT}/logs/run.log") 2>&1

stamp_log "Backup root: $OUT"
echo "SSH_KEY basename: $(basename "$SSH_KEY")"
echo "Repo: $REPO_ROOT"

{
  echo "Timestamp: ${STAMP}"
  echo "WEB_HOST=${WEB_HOST} REMOTE_APP=${REMOTE_APP_FULL}"
  echo "Local repo=${REPO_ROOT}"
  echo "GURU_BACKUP_HOST=${GURU_BACKUP_HOST:-auto default}"
  echo ""
} >> "$manifest"

gzip_magic_ok() {
  [[ -s "$1" ]] && [[ $(head -c2 "$1" | wc -c) -eq 2 ]] && LC_ALL=C head -c2 "$1" | cmp -s - <(printf '\037\213')
}

# --- Local repository archive ---
stamp_log "[local] archiving repository (excludes node_modules, backups)"
LOCAL_EX=(
  '--exclude=.DS_Store'
  '--exclude=node_modules'
  '--exclude=backups'
)

if [[ -n "${INCLUDE_NODE_MODULES_LOCAL:-}" ]]; then
  LOCAL_EX=('--exclude=.DS_Store')
fi

if [[ -d "$REPO_ROOT" ]]; then
  tar -czf "${OUT}/local-kvi-repo_${STAMP}.tar.gz" \
    -C "$(dirname "$REPO_ROOT")" \
    "${LOCAL_EX[@]}" \
    "$(basename "$REPO_ROOT")"
  echo "local-kvi-repo_${STAMP}.tar.gz" >> "$manifest"
else
  echo "WARN: REPO_ROOT not a directory: $REPO_ROOT" | tee -a "$manifest"
fi

# --- Remote: full app tree (.env, services/thankYouEmails, public, etc.) ---
stamp_log "[remote web] tarring application directory (excludes node_modules)"
if "${SSH_WEB[@]}" "test -d '${REMOTE_APP_FULL}'"; then
  "${SSH_WEB[@]}" "tar -czf - \
    --exclude='${REMOTE_APP_DIR}/node_modules' \
    --exclude='${REMOTE_APP_DIR}/.git' \
    -C '${REMOTE_APP_PARENT}' '${REMOTE_APP_DIR}'" \
    > "${OUT}/remote-kvi-app_${STAMP}.tar.gz"
  echo "remote-kvi-app_${STAMP}.tar.gz" >> "$manifest"
else
  echo "WARN: remote app path missing: ${REMOTE_APP_FULL}" | tee -a "$manifest"
fi

# --- PM2 snapshot ---
stamp_log "[remote web] PM2 + node snapshot"
"${SSH_WEB[@]}" bash -s <<'REMOTE' > "${OUT}/remote-pm2-snapshot.txt" 2>&1 || true
set +e
command -v node >/dev/null && node -v
command -v npm >/dev/null && npm -v
pm2 ls
pm2 describe kvi-home 2>/dev/null | head -80
pm2 save 2>/dev/null || true
REMOTE
echo "remote-pm2-snapshot.txt" >> "$manifest"

# --- MongoDB dump on web host (sources .env in app dir) ---
stamp_log "[remote web] mongodump (stdout = gzip only on success)"
set +e
"${SSH_WEB[@]}" bash -s "$REMOTE_APP_FULL" <<'EOS' > "${OUT}/logs/mongodump.stream" 2> "${OUT}/logs/mongodump.stderr"
set +euo pipefail
APP="$1"
cd "$APP" || { echo "cannot cd to $APP" >&2; exit 1; }
if [[ ! -f .env ]]; then
  echo "No .env — skip mongodump" >&2
  exit 0
fi
set -a
# shellcheck disable=SC1090
source .env
set +a
DB="${MONGODB_DB:-blog}"
U="${MONGODB_USER:-}"
P="${MONGODB_PASS:-}"
if ! command -v mongodump >/dev/null 2>&1; then
  echo "mongodump not installed (install mongodb-database-tools)" >&2
  exit 0
fi
TMP="$(mktemp -d /tmp/kvi-mongo.XXXXXX)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT
if [[ -n "$U" ]] && [[ -n "$P" ]]; then
  mongodump --host 127.0.0.1 --port 27017 -u "$U" -p "$P" --authenticationDatabase "$DB" -d "$DB" -o "$TMP" >&2
else
  mongodump --host 127.0.0.1 --port 27017 -d "$DB" -o "$TMP" >&2
fi
RC=$?
if [[ $RC -ne 0 ]]; then
  echo "mongodump failed with $RC" >&2
  exit "$RC"
fi
OUTDIR="$TMP"/"$DB"
if [[ ! -d "$OUTDIR" ]]; then
  echo "mongodump output dir missing: $OUTDIR" >&2
  exit 1
fi
tar -czf - -C "$OUTDIR" .
EOS
set -e
if gzip_magic_ok "${OUT}/logs/mongodump.stream"; then
  mv "${OUT}/logs/mongodump.stream" "${OUT}/mongo-dump_${STAMP}.tar.gz"
  echo "mongo-dump_${STAMP}.tar.gz" >> "$manifest"
else
  rm -f "${OUT}/logs/mongodump.stream"
  echo "mongo-dump: skipped or failed — see logs/mongodump.stderr" >> "$manifest"
fi

# --- Strapi on same host as website (common: localhost:1337 in strapi.js) ---
if [[ -z "${SKIP_STRAPI_ON_WEBHOST:-}" ]]; then
  stamp_log "[remote web] Strapi / CMS folders (auto-detect common paths)"
  "${SSH_WEB[@]}" bash -s <<'REMOTE' > "${OUT}/remote-strapi-on-webhost_${STAMP}.tar.gz" 2>>"${OUT}/logs/strapi-cohost.stderr" || true
set +euo pipefail
paths=()
for d in "$HOME/strapi" "$HOME/cms" "$HOME/strapi-cms" "$HOME/khanna-strapi" "$HOME/cms.khannainstitute.com" "/opt/strapi" "/var/www/strapi" "/var/www/cms" "/srv/strapi"; do
  if [[ -d "$d" ]]; then
    paths+=("$d")
  fi
done
if ((${#paths[@]} == 0)); then
  echo "no common Strapi directories found" >&2
  exit 0
fi
tar -czf - "${paths[@]}"
REMOTE
  if gzip_magic_ok "${OUT}/remote-strapi-on-webhost_${STAMP}.tar.gz"; then
    echo "remote-strapi-on-webhost_${STAMP}.tar.gz" >> "$manifest"
  else
    rm -f "${OUT}/remote-strapi-on-webhost_${STAMP}.tar.gz"
    echo "(strapi co-host: nothing found or tar empty — see logs/strapi-cohost.stderr)" >> "$manifest"
  fi
fi

# --- Strapi on a separate host (optional) ---
if [[ -n "${STRAPI_BACKUP_HOST:-}" ]]; then
  stamp_log "[strapi remote] ${STRAPI_BACKUP_HOST} paths: ${STRAPI_BACKUP_PATHS:-/home/ec2-user}"
  STRAPI_BACKUP_PATHS="${STRAPI_BACKUP_PATHS:-/home/ec2-user}"
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${STRAPI_BACKUP_HOST}" \
    "tar -czf - --ignore-failed-read $STRAPI_BACKUP_PATHS 2>/dev/null" \
    > "${OUT}/remote-strapi-explicit-host_${STAMP}.tar.gz" || {
    echo "WARN: Strapi backup failed for $STRAPI_BACKUP_HOST" | tee -a "$manifest"
  }
  if gzip_magic_ok "${OUT}/remote-strapi-explicit-host_${STAMP}.tar.gz"; then
    echo "remote-strapi-explicit-host_${STAMP}.tar.gz" >> "$manifest"
  else
    rm -f "${OUT}/remote-strapi-explicit-host_${STAMP}.tar.gz"
  fi
fi

# --- Guru API host (default from server.js GURU_SERVER_URL) ---
GURU_BACKUP_HOST="${GURU_BACKUP_HOST:-ec2-100-28-122-42.compute-1.amazonaws.com}"
if [[ -z "${SKIP_GURU_BACKUP:-}" ]]; then
  GURU_BACKUP_PATHS="${GURU_BACKUP_PATHS:-/home/ec2-user}"
  GURU_SSH_USER="${GURU_SSH_USER:-$SSH_USER}"
  # Main site PEM rarely authorizes Guru's EC2; use GURU_SSH_KEY when different.
  if [[ -n "${GURU_SSH_KEY:-}" ]] && [[ -f "$GURU_SSH_KEY" ]]; then
    GURU_SSH_OPTS=(-i "$GURU_SSH_KEY")
  else
    GURU_SSH_OPTS=(-i "$SSH_KEY")
  fi
  stamp_log "[guru] ${GURU_SSH_USER}@${GURU_BACKUP_HOST} paths: ${GURU_BACKUP_PATHS} (key: $(basename "${GURU_SSH_OPTS[1]}"))"
  rm -f "${OUT}/remote-guru-paths_${STAMP}.tar.gz"
  set +e
  ssh "${GURU_SSH_OPTS[@]}" -o StrictHostKeyChecking=accept-new "${GURU_SSH_USER}@${GURU_BACKUP_HOST}" \
    "tar -czf - --ignore-failed-read $GURU_BACKUP_PATHS 2>/dev/null" \
    > "${OUT}/remote-guru-paths_${STAMP}.tar.gz"
  GURU_SSH_RC=$?
  set -e
  if ! gzip_magic_ok "${OUT}/remote-guru-paths_${STAMP}.tar.gz"; then
    rm -f "${OUT}/remote-guru-paths_${STAMP}.tar.gz"
    {
      echo "Guru SSH exit=$GURU_SSH_RC (often 255 = Permission denied)."
      echo "The Guru EC2 usually needs a separate PEM:"
      echo "  GURU_SSH_KEY=/path/to/guru-key.pem bash scripts/full-stack-backup.sh"
      echo "Optional: GURU_SSH_USER=ubuntu … if the instance username differs."
      echo "Or skip Guru: SKIP_GURU_BACKUP=1"
    } | tee "${OUT}/logs/guru-ssh.note" | tee -a "$manifest"
  else
    echo "remote-guru-paths_${STAMP}.tar.gz" >> "$manifest"
  fi
fi

# --- nginx config (best effort; may be partial without sudo) ---
stamp_log "[remote web] nginx config snapshot"
"${SSH_WEB[@]}" bash -s <<'REMOTE' > "${OUT}/remote-nginx-snapshot.tar.gz" 2>>"${OUT}/logs/nginx.stderr" || true
set +euo pipefail
if [[ -d /etc/nginx ]]; then
  tar -czf - /etc/nginx 2>/dev/null || sudo -n tar -czf - /etc/nginx 2>/dev/null
fi
REMOTE
if gzip_magic_ok "${OUT}/remote-nginx-snapshot.tar.gz"; then
  echo "remote-nginx-snapshot.tar.gz" >> "$manifest"
else
  rm -f "${OUT}/remote-nginx-snapshot.tar.gz"
  echo "(nginx snapshot empty or unreadable without sudo — see logs/nginx.stderr)" >> "$manifest"
fi

cat > "${OUT}/RESTORE-HINTS.txt" <<'HINT'
kvi-home (Node):
  1. pm2 stop kvi-home
  2. Extract remote-kvi-app_*.tar.gz into /home/ec2-user/kvi-home (keeps the "kvi home" directory name)
  3. cd into that app folder, rm -rf node_modules && npm ci --omit=dev
  4. pm2 restart kvi-home

Mongo (legacy blog DB):
  1. Extract mongo-dump_*.tar.gz to a folder
  2. mongorestore --drop -d <db_name> /path/to/extracted/dump

Strapi:
  - Co-host archive may include only detected paths. If Strapi lives elsewhere, re-run with STRAPI_BACKUP_HOST / STRAPI_BACKUP_PATHS.
  - Strapi’s own DB (Postgres/MySQL/SQLite) is NOT in the Mongo archive. Back up that DB separately from the Strapi server (same host as Strapi usually).

Guru:
  - Restore into the same paths on the Guru EC2; restart its process manager (pm2/systemd/docker).
  - If backup used a different PEM, that is stored only in your SSH config / notes (GURU_SSH_KEY is not saved in the tarball).

Security:
  - These archives can include .env and TLS keys. Encrypt the backup folder and limit who can read it.
HINT

stamp_log "Done. Output: $OUT"
echo "Copy this folder to another disk or encrypted S3."
ls -lah "$OUT"
