#!/usr/bin/env bash
# Dump PostgreSQL to Scaleway Object Storage; the bucket expires objects after 30 days.
set -euo pipefail
cd /srv/fitness
name=${1:?Usage: backup.sh <object-name-without-extension>}
setting() { sed -n "s/^$1=//p" .env | tail -n 1; }
bucket=$(setting BACKUP_BUCKET)
dump=$(mktemp)
trap 'rm -f "$dump"' EXIT
docker exec fitness-postgres-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$dump"
curl -fsS --aws-sigv4 'aws:amz:pl-waw:s3' \
  --user "$(setting BACKUP_ACCESS_KEY):$(setting BACKUP_SECRET_KEY)" \
  -H 'x-amz-content-sha256: UNSIGNED-PAYLOAD' \
  -T "$dump" "https://$bucket.s3.pl-waw.scw.cloud/$name.dump"
echo "Uploaded $name.dump ($(stat -c %s "$dump") bytes)"
