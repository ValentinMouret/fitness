#!/usr/bin/env bash
set -euo pipefail
cd /srv/fitness
exec 9>/srv/fitness/.release.lock
flock -n 9 || { echo 'Another release is running' >&2; exit 1; }
image=${1:?Usage: release.sh fitness:<git-sha>}
[[ $image =~ ^fitness:[0-9a-f]{40}$ ]] || { echo 'Expected a full Git SHA image tag' >&2; exit 1; }
for file in app.env database.env runtime.env; do
  test -s "$file" || { echo "Missing $file" >&2; exit 1; }
done
export APP_IMAGE="$image"
compose() { docker compose --env-file runtime.env "$@"; }
docker image inspect "$image" >/dev/null
compose config --quiet
compose up -d --wait postgres
# Preserve a local recovery dump before any migration. Copy it off-host for durability.
mkdir -p backups
chmod 700 backups
backup="backups/before-$(date -u +%Y%m%dT%H%M%SZ).dump"
(umask 077; compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup")
compose run --rm --no-deps --entrypoint bun app run db:migrate
if grep -q '^MCP_DATABASE_URL=.' app.env; then
  compose run --rm --no-deps --entrypoint bun app scripts/provision-mcp-reader.ts
fi
compose up -d --wait --wait-timeout 180 app
compose up -d caddy
sed -i "s/^APP_IMAGE=.*/APP_IMAGE=$image/" runtime.env
curl --fail --silent --show-error http://127.0.0.1:5174/healthz
printf '\nDeployed %s. Verify public HTTPS before changing DNS.\n' "$image"
