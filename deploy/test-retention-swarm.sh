#!/bin/bash
set -euo pipefail

test_image="${1:?Pass the locally built publishing image}"
test_prefix="fitness-retention-swarm-$$"
cleanup() { docker rm -f "$test_prefix" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# A disposable inner daemon keeps the developer/CI daemon's Swarm state untouched.
docker run -d --privileged --name "$test_prefix" -e DOCKER_TLS_CERTDIR= \
  docker:29.4-dind@sha256:685b91dca8eab7de1dce1c303dbb7a763e4082d6a60db10968adf3295fbd2495 >/dev/null
swarm() { docker exec "$test_prefix" docker "$@"; }
check_http() {
  swarm run --rm --network retention --entrypoint node "$test_image" -e '
    fetch("http://retention-app:3000/healthz").then(async r => {
      const v = await r.json(); if (!r.ok || v.status !== "ok" || v.checks.database !== "ok") process.exit(1);
    }).catch(() => process.exit(1));
  '
}

for attempt in {1..30}; do
  if swarm info >/dev/null 2>&1; then break; fi
  if [ "$attempt" = 30 ]; then docker logs "$test_prefix"; exit 1; fi
  sleep 1
done
swarm swarm init --advertise-addr eth0 >/dev/null
docker save "$test_image" postgres:17 | docker exec -i "$test_prefix" docker load >/dev/null
swarm network create --driver overlay --attachable retention >/dev/null
swarm run -d --name retention-db --network retention \
  -e POSTGRES_PASSWORD=retention-test -e POSTGRES_DB=fitness_retention_acceptance postgres:17 >/dev/null
for attempt in {1..30}; do
  if swarm exec retention-db pg_isready -h 127.0.0.1 -U postgres -d fitness_retention_acceptance >/dev/null 2>&1; then break; fi
  if [ "$attempt" = 30 ]; then swarm logs retention-db; exit 1; fi
  sleep 1
done
swarm service create --detach --no-resolve-image --name retention-app --replicas 1 --network retention \
  --env DATABASE_URL=postgresql://postgres:retention-test@retention-db:5432/fitness_retention_acceptance \
  --env ANTHROPIC_API_KEY=dummy --env AUTH_USERNAME=fixture --env AUTH_PASSWORD=fixture \
  --env AUTH_SESSION_SECRET=retention-fixture-secret-at-least-32-characters --env PORT=3000 \
  --mount type=volume,source=retained-store,target=/retained-production \
  --update-order start-first --update-monitor 5s --update-failure-action rollback \
  --restart-condition any --restart-delay 5s "$test_image" >/dev/null
for attempt in {1..60}; do
  old_task="$(swarm service ps retention-app --filter desired-state=running --format '{{.ID}} {{.CurrentState}}' | awk '$2 == "Running" {print $1}')"
  if [ -n "$old_task" ]; then
    old_container="$(swarm inspect --type task "$old_task" --format '{{.Status.ContainerStatus.ContainerID}}')"
    old_health="$(swarm inspect --type container "$old_container" --format '{{.State.Health.Status}}')"
    if [ "$old_health" = healthy ]; then break; fi
  fi
  if [ "$attempt" = 60 ]; then swarm service ps retention-app --no-trunc; exit 1; fi
  sleep 1
done
check_http
swarm service update --detach --mount-rm /retained-production retention-app >/dev/null
for attempt in {1..60}; do
  old_state="$(swarm inspect --type task "$old_task" --format '{{.DesiredState}} {{.Status.State}}')"
  if [ "$old_state" != "running running" ]; then
    echo "Failed publisher retired the original healthy task" >&2; swarm service ps retention-app --no-trunc; exit 1
  fi
  update_state="$(swarm service inspect retention-app --format '{{.UpdateStatus.State}}')"
  if [ "$update_state" = rollback_completed ]; then break; fi
  if [ "$attempt" = 60 ]; then swarm service ps retention-app --no-trunc; exit 1; fi
  sleep 1
done
check_http

# Rehearse restoring the saved immutable image rather than deploying current Git.
saved_image="$(swarm image inspect "$test_image" --format '{{.Id}}')"
swarm service update --detach --no-resolve-image --image "$saved_image" retention-app >/dev/null
for attempt in {1..60}; do
  update_state="$(swarm service inspect retention-app --format '{{.UpdateStatus.State}}')"
  if [ "$update_state" = completed ]; then break; fi
  if [ "$attempt" = 60 ]; then swarm service ps retention-app --no-trunc; exit 1; fi
  sleep 1
done
test "$(swarm service inspect retention-app --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')" = "$saved_image"
check_http
echo "Start-first failure retained the original task; immutable image restore passed"
