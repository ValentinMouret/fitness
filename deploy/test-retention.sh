#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
test_prefix="fitness-retention-test-$$"
test_directory="$(mktemp -d)"
cleanup() {
  docker rm -f "$test_prefix-caddy" "$test_prefix-app" "$test_prefix-default" "$test_prefix-preview" "$test_prefix-db" >/dev/null 2>&1 || true
  docker volume rm "$test_prefix-store" >/dev/null 2>&1 || true
  docker network rm "$test_prefix" >/dev/null 2>&1 || true
  docker image rm "$test_prefix:default" "$test_prefix:publisher" >/dev/null 2>&1 || true
  rm -rf "$test_directory"
}
trap cleanup EXIT

docker build --tag "$test_prefix:default" .
docker build --build-arg RETENTION_STARTUP_USER=root --build-arg RETAIN_PRODUCTION_ASSETS=true --tag "$test_prefix:publisher" .
docker network create "$test_prefix" >/dev/null
docker volume create "$test_prefix-store" >/dev/null
docker run -d --name "$test_prefix-db" --network "$test_prefix" \
  -e POSTGRES_PASSWORD=retention-test -e POSTGRES_DB=fitness_retention_acceptance postgres:17 >/dev/null

for attempt in {1..30}; do
  if docker exec "$test_prefix-db" pg_isready -h 127.0.0.1 -U postgres -d fitness_retention_acceptance >/dev/null 2>&1; then break; fi
  if [ "$attempt" = 30 ]; then echo "Test database did not start" >&2; exit 1; fi
  sleep 1
done

if docker run --rm --network none "$test_prefix:publisher" >"$test_directory/missing-mount.log" 2>&1; then
  echo "Publisher started without its persistent mount" >&2; exit 1
fi
grep -F 'must be mounted' "$test_directory/missing-mount.log"
if docker run --rm --network none -e PREVIEW_APP=true \
  --mount "type=volume,source=$test_prefix-store,target=/retained-production" \
  "$test_prefix:publisher" >"$test_directory/preview-refusal.log" 2>&1; then
  echo "Publisher started in a preview" >&2; exit 1
fi
grep -F 'must not run in previews' "$test_directory/preview-refusal.log"

test_environment=(
  -e "DATABASE_URL=postgresql://postgres:retention-test@$test_prefix-db:5432/fitness_retention_acceptance"
  -e ANTHROPIC_API_KEY=dummy -e AUTH_USERNAME=fixture -e AUTH_PASSWORD=fixture
  -e AUTH_SESSION_SECRET=retention-fixture-secret-at-least-32-characters
  -e PORT=3000
)
start_app() {
  local app_name="$1"
  shift
  docker run -d --name "$app_name" --network "$test_prefix" \
    --mount "type=volume,source=$test_prefix-store,target=/retained-production" \
    "${test_environment[@]}" "$@" >/dev/null
  for attempt in {1..30}; do
    if docker exec "$app_name" node -e 'fetch("http://127.0.0.1:3000/healthz").then(r=>r.json()).then(v=>{if(v.status!=="ok"||v.checks.database!=="ok")process.exit(1)})' >/dev/null 2>&1; then break; fi
    if [ "$attempt" = 30 ]; then docker logs "$app_name"; exit 1; fi
    sleep 1
  done
  docker exec --user bun "$app_name" sh -c '
    set -eu
    test "$(awk '\''/^Uid:/ {print $2}'\'' /proc/1/status)" = 1000
    test ! -w /retained-production/assets
    test ! -r /retained-production/manifests
    test ! -w /app/deploy
    test ! -w /app/deploy/retained-entrypoint.sh
    test ! -w /app/deploy/publish-assets.ts
    test ! -w /app/deploy/preview-entrypoint.sh
    test ! -w /app/node_modules/zod
  '
}

start_app "$test_prefix-app" "$test_prefix:publisher"
docker logs "$test_prefix-app" | grep -E 'Published [0-9]+ immutable assets before startup'
docker exec --user root "$test_prefix-app" bun -e '
  const fs = require("node:fs");
  const crypto = require("node:crypto");
  const names = fs.readdirSync("/app/build/client/assets");
  const retained = fs.readdirSync("/retained-production/assets");
  if (names.length !== retained.length) throw new Error("Missing retained assets");
  for (const name of names) {
    const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    if (digest(`/app/build/client/assets/${name}`) !== digest(`/retained-production/assets/${name}`)) throw new Error("Retained bytes differ");
  }
  if (fs.readdirSync("/retained-production/manifests").length !== 1) throw new Error("Expected one release manifest");
  console.log(`Verified ${names.length} retained assets against the image`);
'

# A root image with publication disabled must still run the app as bun.
start_app "$test_prefix-default" -e RETAIN_PRODUCTION_ASSETS=false "$test_prefix:publisher"

# Exercise the actual preview database copy/startup even if the shared mount is inherited.
start_app "$test_prefix-preview" \
  -e PREVIEW_APP=true -e DOKPLOY_DEPLOY_URL=http://retention-preview.example.invalid \
  -e "REVIEW_DATABASE_ADMIN_URL=postgresql://postgres:retention-test@$test_prefix-db:5432/postgres" \
  -e "REVIEW_DATABASE_SOURCE_URL=postgresql://postgres:retention-test@$test_prefix-db:5432/fitness_retention_acceptance" \
  -e "REVIEW_DATABASE_URL_PREFIX=postgresql://postgres:retention-test@$test_prefix-db:5432/" \
  "$test_prefix:default"
docker exec --user root "$test_prefix-app" sh -c 'test "$(find /retained-production/manifests -type f | wc -l)" -eq 1'

# Seed an old image's module, then verify the checked-in handler and proxy fallback.
mkdir "$test_directory/old-assets"
printf 'export const retired = true;\n' > "$test_directory/old-assets/retired-ABCDEFGH.js"
docker run --rm --network none --entrypoint bun \
  --mount "type=bind,source=$test_directory/old-assets,target=/app/build/client/assets,readonly" \
  --mount "type=volume,source=$test_prefix-store,target=/retained-production" \
  "$test_prefix:publisher" /app/deploy/publish-assets.ts
cat > "$test_directory/Caddyfile" <<EOF
:8080 {
  import /etc/caddy/retained-assets.caddy
  reverse_proxy $test_prefix-app:3000
}
:8081 {
  reverse_proxy $test_prefix-preview:3000
}
EOF
docker run -d --name "$test_prefix-caddy" --network "$test_prefix" \
  --mount "type=bind,source=$test_directory/Caddyfile,target=/etc/caddy/Caddyfile,readonly" \
  --mount "type=bind,source=$(pwd)/deploy/retained-assets.caddy,target=/etc/caddy/retained-assets.caddy,readonly" \
  --mount "type=volume,source=$test_prefix-store,target=/srv/fitness/retained-production,readonly" \
  caddy:2.10.2-alpine >/dev/null
for attempt in {1..30}; do
  if docker exec "$test_prefix-app" node -e "fetch('http://$test_prefix-caddy:8080/healthz').then(r=>{if(!r.ok)process.exit(1)})" >/dev/null 2>&1; then break; fi
  if [ "$attempt" = 30 ]; then docker logs "$test_prefix-caddy"; exit 1; fi
  sleep 1
done
docker exec -e "RETAINED_TEST_CADDY=$test_prefix-caddy" "$test_prefix-app" node -e '
  (async () => {
    const origin = `http://${process.env.RETAINED_TEST_CADDY}`;
    const old = await fetch(`${origin}:8080/assets/retired-ABCDEFGH.js`);
    if (old.status !== 200 || await old.text() !== "export const retired = true;\n" || !old.headers.get("content-type")?.includes("javascript") || old.headers.get("cache-control") !== "public, max-age=31536000, immutable") throw new Error("Retained route failed");
    for (const url of [`${origin}:8080/assets/missing-ABCDEFGH.js`, `${origin}:8081/assets/retired-ABCDEFGH.js`]) {
      const response = await fetch(url);
      if (response.status !== 404 || response.headers.get("cache-control")?.includes("immutable")) throw new Error("Proxy or preview fallback failed");
    }
    const html = await fetch(`${origin}:8080/login`);
    if (!html.headers.get("cache-control")?.includes("no-store")) throw new Error("HTML cache policy changed");
    console.log("Read-only Caddy retained bytes, MIME, headers, misses and preview isolation passed");
  })().catch(error => { console.error(error); process.exit(1); });
'
echo "Retention startup, privilege drop and inherited preview mount checks passed"
bash deploy/test-retention-swarm.sh "$test_prefix:publisher"
