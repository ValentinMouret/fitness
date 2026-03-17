#!/bin/bash
set -euo pipefail

# Review App lifecycle manager
# Usage: review-app.sh <action> <pr_number>
# Actions: deploy, destroy

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

ACTION="${1:?Usage: review-app.sh <deploy|destroy> <pr_number>}"
PR_NUMBER="${2:?Usage: review-app.sh <deploy|destroy> <pr_number>}"

# Validate PR number is numeric
if ! [[ "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "ERROR: PR number must be numeric, got '$PR_NUMBER'"
  exit 1
fi

BASE_PORT=6000
PORT=$((BASE_PORT + PR_NUMBER))
CONTAINER_NAME="fitness-review-${PR_NUMBER}"
DB_NAME="fitness_review_${PR_NUMBER}"
IMAGE_NAME="fitness-review:${PR_NUMBER}"
SUBDOMAIN="pr-${PR_NUMBER}.review.valentinmouret.io"

CADDY_REVIEW_DIR="${CADDY_REVIEW_DIR:-/etc/caddy/review-apps}"
CADDY_SNIPPET="${CADDY_REVIEW_DIR}/${PR_NUMBER}.caddy"

REVIEW_STATE_DIR="${REVIEW_STATE_DIR:-$REPO_DIR/.deploy/review-apps}"
LOCK_FILE="${REVIEW_STATE_DIR}/review-${PR_NUMBER}.lock"
LOG_FILE="${REVIEW_STATE_DIR}/review-${PR_NUMBER}.log"

# These must be set in the environment
: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN must be set}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set (owner/repo)}"

mkdir -p "$REVIEW_STATE_DIR" "$CADDY_REVIEW_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [PR #${PR_NUMBER}]: $1" | tee -a "$LOG_FILE"
}

# Prevent concurrent operations on the same PR
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  log "Operation already in progress for PR #${PR_NUMBER}, skipping"
  exit 0
fi

github_comment() {
  local body="$1"

  # Find existing review-app comment
  local existing_id
  existing_id=$(curl -sf \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments" \
    | jq -r '.[] | select(.body | contains("<!-- review-app -->")) | .id' | head -1)

  if [ -n "$existing_id" ] && [ "$existing_id" != "null" ]; then
    curl -sf -X PATCH \
      -H "Authorization: token ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments/${existing_id}" \
      -d "$(jq -n --arg body "$body" '{body: $body}')" > /dev/null
  else
    curl -sf -X POST \
      -H "Authorization: token ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments" \
      -d "$(jq -n --arg body "$body" '{body: $body}')" > /dev/null
  fi
}

deploy() {
  log "Deploying review app"

  # 1. Create ephemeral database
  log "Creating database ${DB_NAME}"
  psql "$DATABASE_URL" -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || log "Database already exists"

  # Build the review app DATABASE_URL from the base one, replacing the db name
  REVIEW_DB_URL=$(echo "$DATABASE_URL" | sed "s|/[^/]*$|/${DB_NAME}|")

  # 2. Fetch PR branch and build
  log "Fetching PR #${PR_NUMBER}"
  cd "$REPO_DIR"
  git fetch origin "pull/${PR_NUMBER}/head:pr-${PR_NUMBER}" --force
  git worktree add -f "/tmp/review-app-${PR_NUMBER}" "pr-${PR_NUMBER}"

  log "Building Docker image"
  docker build -t "$IMAGE_NAME" "/tmp/review-app-${PR_NUMBER}"

  # Clean up worktree
  git worktree remove -f "/tmp/review-app-${PR_NUMBER}" 2>/dev/null || true
  git branch -D "pr-${PR_NUMBER}" 2>/dev/null || true

  # 3. Run container
  log "Starting container on port ${PORT}"
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    --network host \
    -e DATABASE_URL="$REVIEW_DB_URL" \
    -e NODE_ENV=production \
    -e AUTH_USERNAME="${AUTH_USERNAME}" \
    -e AUTH_PASSWORD="${AUTH_PASSWORD}" \
    -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
    -e PORT="${PORT}" \
    "$IMAGE_NAME"

  # 4. Wait for container to be ready
  log "Waiting for container to be ready"
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:${PORT}" > /dev/null 2>&1; then
      break
    fi
    if [ "$i" -eq 30 ]; then
      log "ERROR: Container failed to become ready"
      docker logs "$CONTAINER_NAME" >> "$LOG_FILE" 2>&1
      exit 1
    fi
    sleep 1
  done

  # 5. Run migrations and seed
  log "Running migrations"
  docker exec "$CONTAINER_NAME" npm run db:migrate 2>&1 | tee -a "$LOG_FILE"
  docker exec "$CONTAINER_NAME" npm run db:seed 2>&1 | tee -a "$LOG_FILE"

  # 6. Write Caddy config and reload
  log "Configuring Caddy for ${SUBDOMAIN}"
  cat > "$CADDY_SNIPPET" <<EOF
${SUBDOMAIN} {
    reverse_proxy localhost:${PORT}

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }
}
EOF
  caddy reload --config /etc/caddy/Caddyfile 2>&1 | tee -a "$LOG_FILE"

  log "Review app deployed at https://${SUBDOMAIN}"

  # 7. Comment on PR
  github_comment "<!-- review-app -->
🚀 **Review app deployed**

https://${SUBDOMAIN}

_Updated at $(date -u '+%Y-%m-%d %H:%M UTC')_"
}

destroy() {
  log "Destroying review app"

  # 1. Stop and remove container
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

  # 2. Drop database
  log "Dropping database ${DB_NAME}"
  psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>&1 | tee -a "$LOG_FILE"

  # 3. Remove Caddy config and reload
  rm -f "$CADDY_SNIPPET"
  caddy reload --config /etc/caddy/Caddyfile 2>&1 | tee -a "$LOG_FILE"

  # 4. Clean up Docker image
  docker rmi "$IMAGE_NAME" 2>/dev/null || true

  log "Review app destroyed"

  # 5. Comment on PR
  github_comment "<!-- review-app -->
🧹 **Review app destroyed**

_Cleaned up at $(date -u '+%Y-%m-%d %H:%M UTC')_"
}

case "$ACTION" in
  deploy)  deploy ;;
  destroy) destroy ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Usage: review-app.sh <deploy|destroy> <pr_number>"
    exit 1
    ;;
esac
