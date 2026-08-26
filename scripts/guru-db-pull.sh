#!/usr/bin/env bash
# Download Guru’s database from the Guru EC2 to this Mac.
# The kvi-home repo does not ship Guru’s app — this uses SSH + common layouts (Docker Postgres, SQLite file).
#
# You need a PEM that is in authorized_keys on the Guru host (often NOT the main khannainstitute.pem).
#
# Usage:
#   GURU_SSH_KEY=~/keys/guru.pem bash "/Users/nisha/Downloads/kvi home/scripts/guru-db-pull.sh"
#
# Optional overrides:
#   GURU_HOST=ec2-100-28-122-42.compute-1.amazonaws.com
#   GURU_SSH_USER=ec2-user           # or ubuntu
#   OUT_DIR=~/Backups/guru-db
#   GURU_SQLITE_PATH=/home/ec2-user/guru/data/db.sqlite3    # exact path on Guru server
#   GURU_POSTGRES_CONTAINER=postgres_1                       # docker container name (see docker ps)
#   GURU_PG_USER=postgres
#   GURU_PG_DB=mydb                                          # omit for pg_dumpall
#   GURU_APP_DIR=/home/ubuntu/guru_rag                       # tarball this tree (default when no SQL dump)
#   SKIP_GURU_RAG_ARCHIVE=1                                  # do not download the app folder tarball
#   ALWAYS_GURU_RAG_ARCHIVE=1                                # tarball app dir even after a SQL dump
#
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"

resolve_key() {
  if [[ -n "${GURU_SSH_KEY:-}" ]] && [[ -f "${GURU_SSH_KEY}" ]]; then return 0; fi
  if [[ -n "${SSH_KEY:-}" ]] && [[ -f "$SSH_KEY" ]]; then GURU_SSH_KEY="$SSH_KEY"; return 0; fi
  for candidate in \
    "${HOME}/Desktop/khannainstitute.pem" \
    "/Users/nisha/Desktop/khannainstitute.pem" \
    "${HOME}/Desktop/khannainstitute_backup/khannainstitute.pem"; do
    if [[ -f "$candidate" ]]; then
      GURU_SSH_KEY="$candidate"
      return 0
    fi
  done
  return 1
}

resolve_key || {
  echo "Set GURU_SSH_KEY to the .pem that SSHs into the Guru EC2 (main site key often fails)." >&2
  exit 1
}

GURU_HOST="${GURU_HOST:-ec2-100-28-122-42.compute-1.amazonaws.com}"
GURU_SSH_USER="${GURU_SSH_USER:-ec2-user}"
OUT_DIR="${OUT_DIR:-${HOME}/Backups/guru-db}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$OUT_DIR"

SSH=(ssh -i "$GURU_SSH_KEY" -o StrictHostKeyChecking=accept-new -o BatchMode=yes "${GURU_SSH_USER}@${GURU_HOST}")
REPORT="${OUT_DIR}/guru-db-discovery_${STAMP}.txt"
ARCHIVE="${OUT_DIR}/guru-db-bundle_${STAMP}.tar.gz"

echo "Testing SSH to ${GURU_SSH_USER}@${GURU_HOST} with $(basename "$GURU_SSH_KEY")..."
"${SSH[@]}" "echo ok && uname -a" | tee "$REPORT"

pull_sqlite() {
  local remote_path="$1"
  echo "--- Pulling SQLite: $remote_path ---"
  "${SSH[@]}" "test -r '${remote_path}'" || {
    echo "Cannot read remote file: $remote_path" >&2
    return 1
  }
  "${SSH[@]}" "cat '${remote_path}'" | gzip -c > "${OUT_DIR}/guru-sqlite_${STAMP}.db.gz"
  echo "Wrote ${OUT_DIR}/guru-sqlite_${STAMP}.db.gz"
}

pull_guru_rag_archive() {
  local remote_dir="$1"
  echo "--- Archiving RAG app directory (code + local vector DB + .env): $remote_dir ---"
  "${SSH[@]}" "test -d '${remote_dir}'" || {
    echo "Not a directory: $remote_dir" >&2
    return 1
  }
  # Excludes keep size down; still includes Chroma / local SQLite under guru_rag.
  local parent base
  parent=$(dirname "$remote_dir")
  base=$(basename "$remote_dir")
  "${SSH[@]}" "cd '${parent}' && tar -czf - \
    --exclude='${base}/venv' \
    --exclude='${base}/.venv' \
    --exclude='${base}/.git' \
    --exclude='__pycache__' \
    '${base}'" \
    > "${OUT_DIR}/guru-rag-app_${STAMP}.tar.gz"
  echo "Wrote ${OUT_DIR}/guru-rag-app_${STAMP}.tar.gz"
}

pull_postgres_container() {
  local ctn="$1"
  local user="${GURU_PG_USER:-postgres}"
  echo "--- pg_dump from Docker: $ctn (user=$user) ---"
  if [[ -n "${GURU_PG_DB:-}" ]]; then
    "${SSH[@]}" "docker exec \"$ctn\" pg_dump -U \"$user\" \"$GURU_PG_DB\"" | gzip -c > "${OUT_DIR}/guru-pg_${STAMP}_${GURU_PG_DB}.sql.gz"
    echo "Wrote ${OUT_DIR}/guru-pg_${STAMP}_${GURU_PG_DB}.sql.gz"
  else
    "${SSH[@]}" "docker exec \"$ctn\" pg_dumpall -U \"$user\"" | gzip -c > "${OUT_DIR}/guru-pg-all_${STAMP}.sql.gz"
    echo "Wrote ${OUT_DIR}/guru-pg-all_${STAMP}.sql.gz"
  fi
}

build_bundle() {
  local -a names=("guru-db-discovery_${STAMP}.txt")
  [[ -f "${OUT_DIR}/guru-pg-all_${STAMP}.sql.gz" ]] && names+=("guru-pg-all_${STAMP}.sql.gz")
  while IFS= read -r -d '' f; do names+=("$(basename "$f")"); done < <(
    find "${OUT_DIR}" -maxdepth 1 -name "guru-pg_${STAMP}_*.sql.gz" -print0 2>/dev/null
  )
  [[ -f "${OUT_DIR}/guru-sqlite_${STAMP}.db.gz" ]] && names+=("guru-sqlite_${STAMP}.db.gz")
  [[ -f "${OUT_DIR}/guru-rag-app_${STAMP}.tar.gz" ]] && names+=("guru-rag-app_${STAMP}.tar.gz")
  if ((${#names[@]} <= 1)); then
    return 1
  fi
  tar -czf "$ARCHIVE" -C "$OUT_DIR" "${names[@]}"
  echo "Bundle: $ARCHIVE"
}

# --- Explicit modes (single target) ---
if [[ -n "${GURU_SQLITE_PATH:-}" ]]; then
  pull_sqlite "${GURU_SQLITE_PATH}"
  build_bundle || true
  exit 0
fi

if [[ -n "${GURU_POSTGRES_CONTAINER:-}" ]]; then
  pull_postgres_container "${GURU_POSTGRES_CONTAINER}"
  build_bundle || true
  exit 0
fi

# --- Discovery on Guru host ---
echo "--- Discovering databases (Docker / SQLite / .env hints) ---"
"${SSH[@]}" bash -s <<'REMOTE' | tee -a "$REPORT"
set +e
echo "=== whoami / home ==="
whoami
echo "HOME=$HOME"
echo ""
echo "=== docker ps ==="
if command -v docker >/dev/null 2>&1; then
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
else
  echo "(no docker)"
fi
echo ""
echo "=== docker compose files (common paths) ==="
for d in "$HOME" /home/ec2-user /home/ubuntu /opt/guru /var/guru /srv/guru; do
  [[ -f "$d/docker-compose.yml" ]] && echo "compose: $d/docker-compose.yml"
  [[ -f "$d/docker-compose.yaml" ]] && echo "compose: $d/docker-compose.yaml"
done
echo ""
echo "=== guru_rag top-level ==="
[[ -d "$HOME/guru_rag" ]] && ls -la "$HOME/guru_rag" || true
echo ""
echo "=== SQLite / Chroma (max 60; guru_rag + home) ==="
find "$HOME/guru_rag" -type f \( -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.db' -o -name 'chroma.sqlite3' \) 2>/dev/null | head -60
find "$HOME" /opt/guru /var/guru /srv -type f \( -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.db' \) 2>/dev/null | head -40
echo ""
echo "=== .env keys (masked) — broader RAG/DB hints ==="
find "$HOME/guru_rag" "$HOME" /opt/guru /var/guru /srv -maxdepth 6 -name .env -type f 2>/dev/null | while read -r f; do
  echo "--- $f ---"
  grep -E '^[[:space:]]*[A-Za-z0-9_]*[[:space:]]*=' "$f" 2>/dev/null \
    | grep -iE '(DATABASE|POSTGRES|MONGO|SQLITE|CHROMA|VECTOR|PINECONE|OPENAI_|QDRANT|LANCEDB|MILVUS|SUPABASE|REDIS|CACHE|SUPERBASE|GRAPH|NEO)' \
    | sed 's/=.*/=<redacted>/' | head -40
done
REMOTE

# --- Auto: first running container whose image name mentions postgres ---
echo "--- Auto: pg_dump from postgres Docker image (if any) ---"
PG_CTN=""
PG_CTN=$("${SSH[@]}" 'command -v docker >/dev/null 2>&1 || exit 1
  for n in $(docker ps --format "{{.Names}}"); do
    img=$(docker inspect --format "{{.Config.Image}}" "$n" 2>/dev/null || true)
    echo "$img" | grep -qi postgres && { echo "$n"; exit 0; }
  done
  exit 1' 2>/dev/null) || true

PG_CTN=$(echo "${PG_CTN}" | head -1 | tr -d '\r' | awk '{print $1}')
if [[ -n "${PG_CTN}" ]]; then
  pull_postgres_container "${PG_CTN}" || true
else
  echo "No running Docker container with 'postgres' in the image name (set GURU_POSTGRES_CONTAINER manually)."
fi

# --- Auto: SQLite only if pg dump missing ---
have_pg_dump=0
[[ -f "${OUT_DIR}/guru-pg-all_${STAMP}.sql.gz" ]] && [[ -s "${OUT_DIR}/guru-pg-all_${STAMP}.sql.gz" ]] && have_pg_dump=1
if [[ "$have_pg_dump" -eq 0 ]]; then
  shopt -s nullglob
  pg_one=("${OUT_DIR}"/guru-pg_${STAMP}_*.sql.gz)
  ((${#pg_one[@]} > 0)) && have_pg_dump=1
  shopt -u nullglob
fi

if [[ "$have_pg_dump" -eq 0 ]]; then
  echo "--- Auto: trying common remote SQLite paths ---"
  REMOTE_TRIES=(
    '/home/ubuntu/guru_rag/chroma.sqlite3'
    '/home/ubuntu/guru_rag/db/chroma.sqlite3'
    '/home/ubuntu/guru_rag/data/chroma.sqlite3'
    '/home/ubuntu/guru_rag/.chroma/chroma.sqlite3'
    '/home/ubuntu/guru_rag/data/db.sqlite3'
    '/home/ubuntu/guru_rag/instance/db.sqlite3'
    '/home/ec2-user/guru/db.sqlite3'
    '/home/ec2-user/guru/data/db.sqlite3'
    '/home/ec2-user/app/db.sqlite3'
    '/home/ubuntu/guru/db.sqlite3'
    '/opt/guru/db.sqlite3'
    '/var/guru/db.sqlite3'
  )
  for remote_path in "${REMOTE_TRIES[@]}"; do
    if "${SSH[@]}" "test -r '${remote_path}'" 2>/dev/null; then
      pull_sqlite "${remote_path}" && break
    fi
  done
fi

# --- Fallback / optional: tarball whole guru_rag (Python app + .env + Chroma dirs, etc.) ---
have_sqlite=0
[[ -f "${OUT_DIR}/guru-sqlite_${STAMP}.db.gz" ]] && [[ -s "${OUT_DIR}/guru-sqlite_${STAMP}.db.gz" ]] && have_sqlite=1
if [[ -z "${SKIP_GURU_RAG_ARCHIVE:-}" ]]; then
  RAG_DIR="${GURU_APP_DIR:-}"
  if [[ -z "$RAG_DIR" ]] && "${SSH[@]}" "test -d /home/ubuntu/guru_rag"; then
    RAG_DIR="/home/ubuntu/guru_rag"
  fi
  should_tar=false
  [[ -n "${ALWAYS_GURU_RAG_ARCHIVE:-}" ]] && should_tar=true
  if [[ "$should_tar" == false ]] && [[ "$have_pg_dump" -eq 0 ]] && [[ "$have_sqlite" -eq 0 ]]; then
    should_tar=true
  fi
  if [[ "$should_tar" == true ]] && [[ -n "$RAG_DIR" ]] && "${SSH[@]}" "test -d '${RAG_DIR}'"; then
    pull_guru_rag_archive "${RAG_DIR}" || true
  fi
fi

if build_bundle; then
  echo "Done. Open $REPORT for discovery; data in $OUT_DIR"
else
  echo "No dump file was produced (only the discovery report exists)." >&2
  echo "Read: $REPORT" >&2
  echo "Then run again with one of:" >&2
  echo "  GURU_POSTGRES_CONTAINER=<name_from_docker_ps> bash \"$SCRIPT_PATH\"" >&2
  echo "  GURU_SQLITE_PATH=/path/on/guru/server/file.sqlite3 bash \"$SCRIPT_PATH\"" >&2
  echo "If vectors are hosted (Pinecone / OpenAI), there may be nothing local—see masked lines in $REPORT" >&2
  echo "Or force-download the app tree: ALWAYS_GURU_RAG_ARCHIVE=1 GURU_APP_DIR=/home/ubuntu/guru_rag bash \"$SCRIPT_PATH\"" >&2
  exit 1
fi
