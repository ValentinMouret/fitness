#!/usr/bin/env bash
set -euo pipefail
cd /srv/fitness
exec 9>/srv/fitness/.release.lock
flock -n 9 || { echo 'Another release is running' >&2; exit 1; }
image=${1:?Usage: release.sh fitness:<git-sha>}
[[ $image =~ ^fitness:[0-9a-f]{40}$ ]] || { echo 'Expected a full Git SHA image tag' >&2; exit 1; }
for file in app.env database.env migration.env runtime.env provision-runtime.ts; do
  test -s "$file" || { echo "Missing $file" >&2; exit 1; }
done
sha=${image#fitness:}
docker image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$image" |
  grep -Fxq "GIT_SHA=$sha" || { echo 'Image source SHA does not match its tag' >&2; exit 1; }
APP_IMAGE=$(docker image inspect --format '{{.Id}}' "$image")
[[ $APP_IMAGE =~ ^sha256:[0-9a-f]{64}$ ]] || exit 1
export APP_IMAGE
compose() { docker compose --env-file runtime.env "$@"; }
admin() {
  docker run --rm --network host --memory 384m \
    --env-file app.env --env-file migration.env --env NODE_ENV=production \
    --mount "type=bind,source=$PWD/app.env,target=/run/fitness-app.env,readonly" \
    --mount "type=bind,source=$PWD/provision-runtime.ts,target=/app/deploy/provision-runtime.ts,readonly" \
    --user 0 --entrypoint bun "$APP_IMAGE" "$@"
}
compose config --quiet
compose up -d --wait postgres
# Preserve a local recovery dump before any migration. Copy it off-host for durability.
mkdir -p backups
chmod 700 backups
backup="backups/before-$(date -u +%Y%m%dT%H%M%SZ).dump"
(umask 077; compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup")
admin run db:migrate
admin /app/deploy/provision-runtime.ts
if grep -q '^MCP_DATABASE_URL=.' app.env; then
  admin scripts/provision-mcp-reader.ts
fi
compose up -d --wait --wait-timeout 180 app
compose up -d caddy
compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
sed -i "s/^APP_IMAGE=.*/APP_IMAGE=$APP_IMAGE/" runtime.env
curl --fail --silent --show-error http://127.0.0.1:5174/healthz
printf '\nDeployed source %s, image %s. Verify public HTTPS.\n' "$sha" "$APP_IMAGE"
