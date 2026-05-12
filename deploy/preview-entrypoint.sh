#!/bin/sh
set -eu

if [ "${PREVIEW_APP:-}" != "true" ]; then
  exec "$@"
fi

require_env() {
  name="$1"
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "Missing required preview environment variable: $name" >&2
    exit 1
  fi
}

require_env DOKPLOY_DEPLOY_URL
require_env REVIEW_DATABASE_ADMIN_URL
require_env REVIEW_DATABASE_SOURCE_URL
require_env REVIEW_DATABASE_URL_PREFIX

raw_deploy_url="$DOKPLOY_DEPLOY_URL"
normalized_deploy_url="$(
  printf "%s" "$raw_deploy_url" \
    | tr "[:upper:]" "[:lower:]" \
    | sed -e "s|^http://||" -e "s|^https://||" -e "s|/.*$||" -e "s|[^a-z0-9]|_|g" -e "s|^_*||" -e "s|_*$||"
)"

if [ -z "$normalized_deploy_url" ]; then
  normalized_deploy_url="preview"
fi

deploy_hash="$(printf "%s" "$raw_deploy_url" | sha256sum | awk '{ print substr($1, 1, 12) }')"
database_slug="$(printf "%s" "$normalized_deploy_url" | cut -c1-34)"
default_database_name="fitness_review_${database_slug}_${deploy_hash}"
export REVIEW_DATABASE_NAME="${REVIEW_DATABASE_NAME:-$default_database_name}"
export DATABASE_URL="${REVIEW_DATABASE_URL_PREFIX}${REVIEW_DATABASE_NAME}"

dump_file="$(mktemp)"
cleanup() {
  rm -f "$dump_file"
}
trap cleanup EXIT

echo "Preparing review database $REVIEW_DATABASE_NAME for $DOKPLOY_DEPLOY_URL"

psql "$REVIEW_DATABASE_ADMIN_URL" \
  --set ON_ERROR_STOP=1 \
  --set db="$REVIEW_DATABASE_NAME" <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'db';

DROP DATABASE IF EXISTS :"db" WITH (FORCE);
CREATE DATABASE :"db" TEMPLATE template0;
SQL

pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$dump_file" \
  "$REVIEW_DATABASE_SOURCE_URL"

pg_restore \
  --no-owner \
  --no-acl \
  --dbname="$DATABASE_URL" \
  "$dump_file"

bun app/db/migrate.ts

if [ "${REVIEW_DATABASE_RUN_SEED:-true}" = "true" ]; then
  psql "$DATABASE_URL" --set ON_ERROR_STOP=1 <<'SQL'
INSERT INTO measurements (name, unit, description)
VALUES
  ('weight', 'kg', 'One of the most important measures for overall fitness'),
  ('daily_calorie_intake', 'Cal', 'Amount of calories to consume')
ON CONFLICT (name) DO NOTHING;
SQL
fi

created_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
database_comment="fitness review app url=${DOKPLOY_DEPLOY_URL} created_at=${created_at}"
psql "$REVIEW_DATABASE_ADMIN_URL" \
  --set ON_ERROR_STOP=1 \
  --set db="$REVIEW_DATABASE_NAME" \
  --set comment="$database_comment" <<'SQL'
COMMENT ON DATABASE :"db" IS :'comment';
SQL

echo "Review database $REVIEW_DATABASE_NAME is ready"

exec "$@"
