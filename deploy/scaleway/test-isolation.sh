#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
image=${1:?Usage: test-isolation.sh <locally-built-image>}
work=$(mktemp -d)
project="fitness-isolation-test-$$"
trap 'rm -rf "$work"; docker volume rm "${project}_postgres" >/dev/null 2>&1 || true' EXIT
cp compose.yaml compose.sh "$work/"
cat > "$work/.env" <<'ENV'
POSTGRES_USER=fitness
POSTGRES_DB=fitness
POSTGRES_PASSWORD=fixture-admin
DATABASE_URL=postgresql://fitness_app:fixture-runtime@localhost/fitness
MIGRATION_DATABASE_URL=postgresql://fitness:fixture-admin@localhost/fitness
AUTH_USERNAME=fixture
AUTH_PASSWORD=#literal$with"quotes'and spaces
AUTH_SESSION_SECRET=#012345678901234567890123456789$literal
TUNNEL_TOKEN=fixture-tunnel
BACKUP_SECRET_KEY=fixture-backup
ENV
export APP_IMAGE=$image
compose() { "$work/compose.sh" -p "$project" "$@"; }
compose --profile maintenance config --format json > "$work/config.json"
python3 - "$work/config.json" <<'PY'
import json, sys
s = json.load(open(sys.argv[1]))['services']
a = s['app']['environment']
assert a['DATABASE_URL'].startswith('postgresql://fitness_app:')
assert not set(a).intersection({'POSTGRES_PASSWORD', 'MIGRATION_DATABASE_URL', 'APP_DATABASE_URL', 'TUNNEL_TOKEN', 'BACKUP_SECRET_KEY', 'BACKUP_ACCESS_KEY'})
assert set(s['postgres']['environment']) == {'POSTGRES_USER', 'POSTGRES_DB', 'POSTGRES_PASSWORD'}
assert set(s['cloudflared']['environment']) == {'TUNNEL_TOKEN'}
m = s['maintenance']['environment']
assert m['DATABASE_URL'].startswith('postgresql://fitness:')
assert m['APP_DATABASE_URL'] == a['DATABASE_URL']
assert not set(m).intersection({'POSTGRES_PASSWORD','TUNNEL_TOKEN','BACKUP_SECRET_KEY','BACKUP_ACCESS_KEY'})
PY
compose run --rm --no-deps --entrypoint env app > "$work/container.env"
python3 - "$work/container.env" <<'PY'
import sys
values = open(sys.argv[1]).read().splitlines()
keys = {v.split('=', 1)[0] for v in values}
assert 'AUTH_USERNAME=fixture' in values
assert "AUTH_PASSWORD=#literal$with\"quotes'and spaces" in values
assert 'AUTH_SESSION_SECRET=#012345678901234567890123456789$literal' in values
assert not keys.intersection({'RESEND_API_KEY', 'AUTH_SMTP_HOST', 'MIGRATION_DATABASE_URL', 'APP_DATABASE_URL', 'POSTGRES_PASSWORD', 'TUNNEL_TOKEN', 'BACKUP_SECRET_KEY'})
print('Compose credential isolation and optional omission passed')
PY
