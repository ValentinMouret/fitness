#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="${REPO_DIR:-$DEFAULT_REPO_DIR}"

ACTION="${1:?Usage: review-app.sh <deploy|destroy> <pr_number> [sha]}"
PR_NUMBER="${2:?Usage: review-app.sh <deploy|destroy> <pr_number> [sha]}"
SHA="${3:-}"

if ! [[ "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "ERROR: PR number must be numeric, got '$PR_NUMBER'"
  exit 1
fi

if [[ "$ACTION" == "deploy" && -z "$SHA" ]]; then
  echo "ERROR: deploy requires a commit SHA"
  exit 1
fi

BASE_PORT="${BASE_PORT:-6100}"
MAX_PORT="${MAX_PORT:-6199}"
CONTAINER_NAME="fitness-review-${PR_NUMBER}"
DB_NAME="fitness_review_${PR_NUMBER}"
IMAGE_NAME="fitness-review:${PR_NUMBER}"
SUBDOMAIN="pr-${PR_NUMBER}.review.valentinmouret.io"

CADDY_REVIEW_DIR="${CADDY_REVIEW_DIR:-$REPO_DIR/deploy/review-apps}"
REVIEW_STATE_DIR="${REVIEW_STATE_DIR:-$REPO_DIR/.deploy/review-apps}"
LOCK_FILE="${REVIEW_STATE_DIR}/review-${PR_NUMBER}.lock"
LOG_FILE="${REVIEW_STATE_DIR}/review-${PR_NUMBER}.log"
PORT_FILE="${REVIEW_STATE_DIR}/review-${PR_NUMBER}.port"
WORKTREE_DIR="${REVIEW_STATE_DIR}/worktree-${PR_NUMBER}"

: "${POSTGRES_ADMIN_URL:?POSTGRES_ADMIN_URL must be set}"
: "${PRODUCTION_DATABASE_URL:?PRODUCTION_DATABASE_URL must be set}"
: "${AUTH_USERNAME:?AUTH_USERNAME must be set}"
: "${AUTH_PASSWORD:?AUTH_PASSWORD must be set}"
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY must be set}"

mkdir -p "$REVIEW_STATE_DIR" "$CADDY_REVIEW_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [PR #${PR_NUMBER}]: $1" | tee -a "$LOG_FILE"
}

db_url_with_name() {
  local url="$1"
  local db_name="$2"
  local base="$url"
  local query=""

  if [[ "$url" == *\?* ]]; then
    base="${url%%\?*}"
    query="?${url#*\?}"
  fi

  echo "${base%/*}/${db_name}${query}"
}

REVIEW_DB_URL="$(db_url_with_name "$PRODUCTION_DATABASE_URL" "$DB_NAME")"
CADDY_SNIPPET="${CADDY_REVIEW_DIR}/${PR_NUMBER}.caddy"

cleanup_worktree() {
  git -C "$REPO_DIR" worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true
  rm -rf "$WORKTREE_DIR"
}

trap cleanup_worktree EXIT

port_file_glob_prefix="${REVIEW_STATE_DIR}/review-"

port_is_reserved() {
  local candidate="$1"

  if compgen -G "${port_file_glob_prefix}*.port" >/dev/null; then
    if grep -Rlx -- "$candidate" "$REVIEW_STATE_DIR"/review-*.port >/dev/null 2>&1; then
      return 0
    fi
  fi

  ss -ltn "sport = :${candidate}" | awk 'NR > 1 { found = 1 } END { exit found ? 0 : 1 }'
}

assign_port() {
  if [[ -f "$PORT_FILE" ]]; then
    cat "$PORT_FILE"
    return
  fi

  local candidate
  for candidate in $(seq "$BASE_PORT" "$MAX_PORT"); do
    if ! port_is_reserved "$candidate"; then
      echo "$candidate" >"$PORT_FILE"
      echo "$candidate"
      return
    fi
  done

  log "ERROR: No free review app port available in range ${BASE_PORT}-${MAX_PORT}"
  exit 1
}

PORT="$(assign_port)"

drop_review_database() {
  log "Dropping database ${DB_NAME}"
  psql "$POSTGRES_ADMIN_URL" -v ON_ERROR_STOP=1 <<SQL >/dev/null
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}'
  AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "${DB_NAME}";
SQL
}

create_review_database() {
  log "Creating database ${DB_NAME}"
  psql "$POSTGRES_ADMIN_URL" -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE \"${DB_NAME}\";"
}

restore_production_data() {
  log "Restoring production data into ${DB_NAME}"
  pg_dump --no-owner --no-privileges "$PRODUCTION_DATABASE_URL" \
    | psql "$REVIEW_DB_URL"
}

write_caddy_snippet() {
  cat >"$CADDY_SNIPPET" <<EOF
${SUBDOMAIN} {
    reverse_proxy localhost:${PORT}

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }
}
EOF
}

reload_caddy() {
  sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null
  sudo systemctl reload caddy
}

deploy() {
  local docker_env_args=(
    -e "DATABASE_URL=${REVIEW_DB_URL}"
    -e "NODE_ENV=production"
    -e "AUTH_USERNAME=${AUTH_USERNAME}"
    -e "AUTH_PASSWORD=${AUTH_PASSWORD}"
    -e "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"
    -e "PORT=${PORT}"
  )

  if [[ -n "${ANTHROPIC_MODEL:-}" ]]; then
    docker_env_args+=(-e "ANTHROPIC_MODEL=${ANTHROPIC_MODEL}")
  fi

  log "Fetching commit ${SHA}"
  git -C "$REPO_DIR" fetch origin "$SHA" --quiet || git -C "$REPO_DIR" fetch origin "pull/${PR_NUMBER}/head" --quiet
  git -C "$REPO_DIR" cat-file -e "${SHA}^{commit}"
  cleanup_worktree
  git -C "$REPO_DIR" worktree add --force --detach "$WORKTREE_DIR" "$SHA" >/dev/null

  log "Building Docker image"
  docker build -t "$IMAGE_NAME" "$WORKTREE_DIR" 2>&1 | tee -a "$LOG_FILE"

  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

  drop_review_database
  create_review_database
  restore_production_data

  log "Starting container on port ${PORT}"
  docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    --network host \
    "${docker_env_args[@]}" \
    "$IMAGE_NAME" >/dev/null

  log "Waiting for container to be ready"
  local attempt
  for attempt in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:${PORT}" >/dev/null 2>&1; then
      break
    fi

    if [[ "$attempt" -eq 30 ]]; then
      log "ERROR: Container failed to become ready"
      docker logs "$CONTAINER_NAME" >>"$LOG_FILE" 2>&1 || true
      exit 1
    fi

    sleep 1
  done

  log "Running migrations"
  docker exec "$CONTAINER_NAME" npm run db:migrate 2>&1 | tee -a "$LOG_FILE"

  log "Writing Caddy config"
  write_caddy_snippet
  reload_caddy

  log "Review app deployed at https://${SUBDOMAIN}"
}

destroy() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  drop_review_database
  rm -f "$CADDY_SNIPPET" "$PORT_FILE"
  docker rmi "$IMAGE_NAME" >/dev/null 2>&1 || true
  reload_caddy

  log "Review app destroyed"
}

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  log "Operation already in progress for PR #${PR_NUMBER}, skipping"
  exit 0
fi

case "$ACTION" in
  deploy)
    deploy
    ;;
  destroy)
    destroy
    ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Usage: review-app.sh <deploy|destroy> <pr_number> [sha]"
    exit 1
    ;;
esac
