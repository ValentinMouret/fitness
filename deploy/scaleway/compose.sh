#!/usr/bin/env bash
# Preserve the operator file's raw values; never evaluate it as shell/dotenv code.
set -euo pipefail
cd "$(dirname "$0")"
keys=(DATABASE_URL MCP_DATABASE_URL ANTHROPIC_API_KEY ANTHROPIC_MODEL AUTH_USERNAME AUTH_PASSWORD AUTH_SESSION_SECRET AUTH_SESSION_TTL_SECONDS AUTH_FOUNDATION_ENABLED AUTH_FOUNDATION_ORIGIN AUTH_FOUNDATION_OWNER_USER_ID AUTH_LOCAL_INBOX AUTH_SMTP_HOST AUTH_SMTP_PORT AUTH_SMTP_SECURE AUTH_SMTP_USER AUTH_SMTP_PASSWORD AUTH_SMTP_FROM AUTH_EMAIL_FROM RESEND_API_KEY AUTH_INVITATION_TTL_SECONDS OAUTH_ISSUER_URL OAUTH_CLIENTS OAUTH_CODE_TTL_SECONDS OAUTH_ACCESS_TTL_SECONDS OAUTH_REFRESH_TTL_SECONDS POSTGRES_USER POSTGRES_DB POSTGRES_PASSWORD TUNNEL_TOKEN MIGRATION_DATABASE_URL)
for key in "${keys[@]}"; do unset "$key"; done
while IFS= read -r line || [[ -n $line ]]; do
  line=${line%$'\r'}
  [[ $line == *=* ]] || continue
  key=${line%%=*}
  for allowed in "${keys[@]}"; do
    if [[ $key == "$allowed" ]]; then export "$key=${line#*=}"; break; fi
  done
done < .env
if [[ -z ${APP_IMAGE:-} && -f release.env ]]; then
  while IFS= read -r line || [[ -n $line ]]; do
    [[ $line == APP_IMAGE=* ]] && export "$line"
  done < release.env
fi
exec docker compose --env-file /dev/null "$@"
