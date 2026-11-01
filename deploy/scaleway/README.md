# Scaleway deployment

One STARDUST1-S in `pl-waw-2` runs PostgreSQL, the app and `cloudflared` with
Docker Compose. The VM accepts no inbound web traffic: Cloudflare's tunnel serves
`fitness.valentinmouret.io` and Access-protected SSH for CI on
`deploy-fitness.valentinmouret.io`. Nightly and pre-migration `pg_dump`s go to a
Scaleway Object Storage bucket that expires objects after 30 days.

| Item | Monthly cost (excl. VAT) |
| --- | --- |
| STARDUST1-S + 10 GB local SSD, IPv6 only | ~€0.80 |
| Object Storage, a few MB of dumps | < €0.01 |
| Cloudflare tunnel and Access | free |

Managed or serverless databases cost more than the VM and cannot host the MCP
reader role. The VM has 1 GB RAM and 2 GB swap; images are built in CI.

## Files

- `*.tf`: VM, security group, tunnel, DNS, Access, backup bucket and write-only key.
- `compose.yaml`: `postgres`, `app`, `cloudflared`, plus an on-demand `maintenance` profile. Each service has an explicit environment allowlist.
- `release.sh <sha>`: backup, migrate, provision restricted runtime/MCP roles, start, verify `/healthz`,
  install the nightly backup cron.
- `backup.sh <name>`: dump PostgreSQL and upload `<name>.dump` to the bucket.
- `../../scripts/deploy-scaleway-ci.sh`: CI builds the image, uploads it over SSH and releases.

## Server secrets

`/srv/fitness/.env` (owner `fitness-deploy`, mode 0600, literal values, no surrounding quotes).
`compose.sh` reads exact allowlisted values without shell evaluation or dotenv
interpolation, preserving leading `#`, `$` and literal quotes. Always use the
wrapper rather than passing this raw file to `docker compose --env-file`:

```dotenv
POSTGRES_USER=fitness
POSTGRES_DB=fitness
POSTGRES_PASSWORD=<hex>
DATABASE_URL=postgresql://fitness_app:<different-runtime-hex>@127.0.0.1:5432/fitness
MIGRATION_DATABASE_URL=postgresql://fitness:<admin-hex>@127.0.0.1:5432/fitness
AUTH_USERNAME=…
AUTH_PASSWORD=…
AUTH_SESSION_SECRET=…
ANTHROPIC_API_KEY=…
RESEND_API_KEY=…
OAUTH_ISSUER_URL=https://fitness.valentinmouret.io
OAUTH_CLIENTS=[…]
MCP_DATABASE_URL=postgresql://fitness_mcp_reader:<hex>@127.0.0.1:5432/fitness
TUNNEL_TOKEN=<terraform output -raw tunnel_token>
BACKUP_BUCKET=fitness-backups-valentinmouret
BACKUP_ACCESS_KEY=<terraform output -raw backup_access_key>
BACKUP_SECRET_KEY=<terraform output -raw backup_secret_key>
```

Plus the `AUTH_FOUNDATION_*` and `AUTH_EMAIL_FROM` values documented in
[authentication](../../docs/operations/authentication.md). The file is an operator input, never mounted or loaded wholesale into a container.
The app receives only application settings and the restricted `fitness_app` URL;
PostgreSQL receives only `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD`;
cloudflared receives only `TUNNEL_TOKEN`. Backup credentials remain host-side.
Unset optional app settings are omitted rather than converted to empty strings.

The short-lived `maintenance` service overrides `DATABASE_URL` with
`MIGRATION_DATABASE_URL` and receives the runtime URL as `APP_DATABASE_URL`.
It runs Bun commands directly, never an HTTP server. After migrations, the
[idempotent provisioner](provision-runtime.ts) grants runtime DML and sequence
access for existing/future public tables created by the migration role, removes
privileged role flags, and refuses role memberships or object ownership.
PUBLIC database CREATE/TEMP and public-schema CREATE are revoked. Application
authorization still owns account isolation. Runtime startup skips migrations.

## Terraform

State is local and canonical at
`/Users/valentinmouret/Developer/valentinmouret/fitness/deploy/scaleway/terraform.tfstate`,
with inputs in `local.auto.tfvars.json` next to it. Both contain secrets: mode 0600,
never commit or paste them, keep an encrypted off-machine copy.

```sh
state=/Users/valentinmouret/Developer/valentinmouret/fitness/deploy/scaleway
terraform -chdir=deploy/scaleway init -reconfigure -backend-config="path=$state/terraform.tfstate"
terraform -chdir=deploy/scaleway plan -var-file="$state/local.auto.tfvars.json" -out=deployment.tfplan
terraform -chdir=deploy/scaleway apply deployment.tfplan
```

Export `SCW_ACCESS_KEY`, `SCW_SECRET_KEY`, `SCW_DEFAULT_PROJECT_ID` and
`CLOUDFLARE_API_TOKEN` first. A plan that replaces the server is a stop condition;
the VM and its disk are deletion-protected. Cloud-init runs on first boot only and
its changes are ignored afterwards.

## Deploy

Pushes to `main` deploy after the gate passes. The workflow needs the secrets
`SCALEWAY_DEPLOY_SSH_KEY`, `SCALEWAY_DEPLOY_KNOWN_HOSTS`, `CF_ACCESS_CLIENT_ID`,
`CF_ACCESS_CLIENT_SECRET` and the variable `SCALEWAY_DEPLOY_HOST`. A failed backup
or migration stops the release before the app is replaced; a successful migration
is not undone by deploying an older image. Inspect with
`./compose.sh logs` in `/srv/fitness`. Never run
`docker compose down -v`.

## Restore

Download a dump from the bucket with your own Scaleway credentials (the VM key is
write-only), copy it to the VM, then with only PostgreSQL running:

```sh
docker exec -i fitness-postgres-1 pg_restore --clean --if-exists --no-owner --no-acl \
  -U fitness -d fitness < fitness.dump
```

If the VM is lost, Stardust stock may be unavailable: change `type` to the cheapest
available instance, apply, restore the latest dump and release.

## One-time credential isolation cutover

Prepare a coordinated environment cutover before the first release; merging
alone must not race the environment change.

1. Keep a private mode-0600 copy of the existing `.env` and a verified current
   bucket backup. Preserve every existing app setting, owner UUID, session secret,
   email/OAuth/MCP credential, tunnel token and backup setting.
2. In a private editor, copy the current admin `DATABASE_URL` unchanged into
   `MIGRATION_DATABASE_URL`. Change only `DATABASE_URL` to the `fitness_app`
   username and a new random hex password; keep the same host, port and database.
   Do not print either URL or use secret-bearing shell arguments. Keep
   `POSTGRES_PASSWORD` unchanged; editing it does not rotate an existing role.
   Preserve all existing raw values exactly. Never print `./compose.sh config`
   with real secrets.
3. Upload the reviewed compose YAML/wrapper, release, backup and provisioner files together.
   Run the initial release SHA over independent direct IPv6 operator SSH, not
   the Cloudflare SSH tunnel. The changed cloudflared environment recreates the
   only connector, which would disconnect a CI release using that same tunnel.
   Once this initial release is healthy and the connector is back, subsequent CI
   releases with unchanged connector configuration can use the tunnel. It verifies the image's embedded SHA, resolves
   its immutable Docker image ID, backs up before migration, provisions the role,
   then replaces the app. A backup failure prevents migrations and app replacement.
   `release.env` records the digest only after the expected SHA is healthy.
4. Verify health, login, a normal app write and MCP; inspect only environment
   variable names to confirm admin/backup/tunnel credentials are absent from the
   app. Verify runtime DML succeeds and DDL/role escalation fail. Do not drop the
   admin role or the new runtime role.

If provisioning fails, the old running app keeps its existing environment. Keep
its image available, inspect the error privately, and correct the prepared env.
If app replacement fails, a code rollback does not undo migrations; use a matching
image/schema and preserve new account writes. After restoring with `--no-acl`,
run the maintenance provisioner and MCP reader provisioning before starting app.
The previous environment copy contains admin credentials and needs the same
restricted retention as other operator secrets.

## Local deployment checks

`./deploy/scaleway/test-isolation.sh <locally-built-image>` uses only synthetic
credentials to check the Compose allowlists and actual omission of optional env
values. It does not contact production or the backup bucket. The repository gate
runs this check against its built image locally and in CI.
