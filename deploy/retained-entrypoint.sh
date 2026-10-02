#!/bin/sh
set -eu

if [ "${RETAIN_PRODUCTION_ASSETS:-}" = "true" ]; then
  if [ "${PREVIEW_APP:-}" = "true" ]; then
    echo "Production asset retention must not run in previews" >&2
    exit 1
  fi
  bun /app/deploy/publish-assets.ts
fi

if [ "$(id -u)" = "0" ]; then
  exec su bun -s /bin/sh -c 'exec "$@"' -- sh /app/deploy/preview-entrypoint.sh "$@"
fi

exec /app/deploy/preview-entrypoint.sh "$@"
