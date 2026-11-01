#!/usr/bin/env bash
set -euo pipefail
cd /srv/fitness
exec 9>.release.lock
flock -n 9 || { echo 'Another release is running' >&2; exit 1; }
sha=${1:?Usage: release.sh <git-sha>}
[[ $sha =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full Git SHA' >&2; exit 1; }
image="fitness:$sha"
test -s .env || { echo 'Missing /srv/fitness/.env' >&2; exit 1; }
docker image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$image" |
  grep -Fxq "GIT_SHA=$sha" || { echo 'Image GIT_SHA does not match' >&2; exit 1; }

export APP_IMAGE=$image
compose() { docker compose --env-file /dev/null "$@"; }
compose up -d --wait postgres
./backup.sh "release/$sha"
compose run --rm --no-deps app bun run db:migrate
if grep -q '^MCP_DATABASE_URL=.' .env; then
  compose run --rm --no-deps app bun scripts/provision-mcp-reader.ts
fi
compose up -d --wait --wait-timeout 180 --remove-orphans app cloudflared
echo "APP_IMAGE=$image" > release.env
curl -fsS http://127.0.0.1:5174/healthz | grep -Fq "\"sha\":\"$sha\""

# shellcheck disable=SC2016 # cron expands the date, not this shell.
(crontab -l 2>/dev/null | grep -v backup.sh || true
  echo '17 3 * * * /srv/fitness/backup.sh "daily/$(date -u +\%F)" 2>&1 | logger -t fitness-backup') | crontab -
docker image prune -af --filter "until=168h" >/dev/null
echo "Released $sha"
