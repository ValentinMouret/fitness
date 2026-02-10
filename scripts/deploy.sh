#!/bin/bash
set -euo pipefail

REPO_DIR="/home/valentin/fitness"
LOG_FILE="/var/log/fitness-deploy.log"
LOCK_FILE="/var/lock/fitness-deploy.lock"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S'): $1" | tee -a "$LOG_FILE"
}

# Prevent concurrent deployments
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  log "Deploy already in progress, skipping"
  exit 0
fi

log "Deployment started"

cd "$REPO_DIR"

git fetch origin main
git reset --hard origin/main

log "Building and starting containers"
docker compose up -d --build 2>&1 | tee -a "$LOG_FILE"

log "Waiting for container to be ready"
for i in $(seq 1 30); do
  if docker compose exec -T app echo "ready" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    log "ERROR: Container failed to become ready"
    exit 1
  fi
  sleep 1
done

log "Running migrations"
docker compose exec -T app bun db:migrate 2>&1 | tee -a "$LOG_FILE"

docker image prune -f >> "$LOG_FILE" 2>&1

log "Deployment completed"
