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
- `compose.yaml`: `postgres`, `app`, `cloudflared`. Every service reads `/srv/fitness/.env`.
- `release.sh <sha>`: backup, migrate, provision the MCP reader, start, verify `/healthz`,
  install the nightly backup cron.
- `backup.sh <name>`: dump PostgreSQL and upload `<name>.dump` to the bucket.
- `../../scripts/deploy-scaleway-ci.sh`: CI builds the image, uploads it over SSH and releases.

## Server secrets

`/srv/fitness/.env` (owner `fitness-deploy`, mode 0600, literal values, no quotes):

```dotenv
POSTGRES_USER=fitness
POSTGRES_DB=fitness
POSTGRES_PASSWORD=<hex>
DATABASE_URL=postgresql://fitness:<hex>@127.0.0.1:5432/fitness
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
[authentication](../../docs/operations/authentication.md). Every container sees
this file; that is the accepted trade-off for a single-owner host.

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
`docker compose --env-file release.env logs` in `/srv/fitness`. Never run
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

## One-time cutover from the Caddy setup (2026-11)

1. As root on the VM, build `.env` from the old files, keeping the owner URL:

   ```sh
   cd /srv/fitness && umask 077
   { grep -v '^DATABASE_URL=' app.env; cat migration.env database.env
     printf 'TUNNEL_TOKEN=%s\n' "$(cat /etc/cloudflared/fitness.token)"; } > .env
   chown fitness-deploy:fitness-deploy .env
   ```

2. Add `deploy_ssh_public_key` (`ssh-keygen -y` of the CI key) to
   `local.auto.tfvars.json`. Delete the manual proxied AAAA for
   `fitness.valentinmouret.io` in Cloudflare, then plan and apply. Expect two
   moved tunnel resources, an updated tunnel config and security group, and new
   app CNAME, bucket, IAM application, policy and key; nothing on the server.
   The running connector serves the app through the tunnel immediately.
3. Append `BACKUP_BUCKET`, `BACKUP_ACCESS_KEY` and `BACKUP_SECRET_KEY` to `.env`.
4. Merge to `main`. The release removes Caddy and starts the compose `cloudflared`.
   Check `/healthz`, login and MCP, and that `release/<sha>.dump` is in the bucket.
5. Clean up as root:

   ```sh
   systemctl disable --now fitness-deployment-tunnel
   rm /etc/systemd/system/fitness-deployment-tunnel.service /usr/local/bin/cloudflared
   rm -r /etc/cloudflared && userdel cloudflared
   cd /srv/fitness && rm -r app.env database.env migration.env runtime.env Caddyfile provision-runtime.ts backups
   docker volume rm fitness_caddy_data fitness_caddy_config
   docker exec fitness-postgres-1 psql -U fitness -d fitness -c 'drop owned by fitness_app; drop role fitness_app;'
   ```
