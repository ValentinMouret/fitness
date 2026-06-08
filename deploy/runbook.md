# Deployment Runbook

This runbook assumes the Dokploy-first target architecture from `deploy/README.md`.

## Services

Check service status:

```shell
sudo systemctl status postgresql
sudo systemctl status caddy
sudo systemctl status dokploy-admin-port-lockdown
sudo systemctl status github-actions-runner-fitness
docker service ls
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Dokploy runs in Docker Swarm. Caddy is still the public reverse proxy on `80/443` because it also serves non-Fitness services. Fitness production traffic currently flows through Caddy to Dokploy Traefik on `127.0.0.1:18080`.

Dokploy UI:

```text
https://dokploy.valentinmouret.io
```

Direct public access to `:3000` should fail. Local access from the VPS should still work.

```shell
curl --fail --silent --head https://dokploy.valentinmouret.io
curl --fail --silent --head http://127.0.0.1:3000
```

From outside the VPS, this should time out or fail:

```shell
curl --connect-timeout 5 --head http://valentinmouret.io:3000
```

## Logs

Dokploy and proxy logs:

```shell
docker service logs --tail=200 dokploy
docker logs --tail=200 dokploy-traefik
journalctl -u dokploy-admin-port-lockdown -n 100 --no-pager
```

Application logs:

```shell
# Prefer the Dokploy UI logs tab.
docker ps --format 'table {{.Names}}\t{{.Status}}'
docker logs --tail=200 <fitness-container-name>
```

The old `fitness-app-1` container has been removed. Dokploy is the active production deployment path.

Database lifecycle logs:

```shell
ls -lah /srv/fitness/logs/db
tail -n 200 /srv/fitness/logs/db/<log-file>
```

GitHub runner logs:

```shell
journalctl -u github-actions-runner-fitness -n 200 --no-pager
```

Legacy deployment logs, if the old state directory still exists:

```shell
tail -n 200 /home/valentin/fitness/.deploy/deploy.log
ls -lah /home/valentin/fitness/.deploy/review-apps
```

These logs are historical only.

## Legacy Webhook Cleanup

The repository no longer contains the old webhook config or hand-written deploy scripts. The live Caddyfile has been reloaded, `webhook.service` has been stopped and disabled, and the old generated review app snippets have been removed.

Verify the legacy service remains disabled:

```shell
sudo systemctl status webhook
```

Verify old generated review app snippets are gone:

```shell
test ! -e /home/valentin/fitness/deploy/review-apps
```

## Dokploy Admin Port

The raw Dokploy port is published by Docker Swarm on `:3000`, but public access is blocked through the Docker `DOCKER-USER` chain.

Reapply the block:

```shell
sudo systemctl restart dokploy-admin-port-lockdown
```

Verify the block service:

```shell
sudo systemctl status dokploy-admin-port-lockdown
```

If the service fails with `status=203/EXEC`, check that the script starts with an unindented shebang:

```shell
head -1 /usr/local/sbin/dokploy-admin-port-lockdown.sh
```

Expected:

```shell
#!/bin/sh
```

The service file is:

```text
/etc/systemd/system/dokploy-admin-port-lockdown.service
```

The script is:

```text
/usr/local/sbin/dokploy-admin-port-lockdown.sh
```

## Dokploy Settings

Check Dokploy global host settings:

```shell
PG_CONTAINER="$(docker ps --format '{{.Names}}' | grep '^dokploy-postgres\.' | head -1)"

docker exec "$PG_CONTAINER" psql -U dokploy -d dokploy \
  -c 'select id, "serverIp", host, https, "certificateType" from "webServerSettings";'
```

Expected host:

```text
dokploy.valentinmouret.io
```

Check user-level trusted origins:

```shell
docker exec "$PG_CONTAINER" psql -U dokploy -d dokploy \
  -c 'select email, "trustedOrigins" from "user";'
```

The temporary `http://valentinmouret.io:3000` trusted origin should not be present.

## Production

Run a production health check:

```shell
curl --fail --silent https://fitness.valentinmouret.io/healthz
```

Verify the local Caddy-to-Dokploy route:

```shell
curl --fail --silent --header 'Host: fitness.valentinmouret.io' http://127.0.0.1:18080/healthz
```

Trigger a production deployment:

```shell
# Prefer the GitHub workflow after CI passes.
# Manual fallback: use the Dokploy UI Deploy button for the production app.
```

Prepare a production migration check manually:

```shell
sudo -iu postgres /srv/fitness/db/prepare-production.sh <sha>
```

If a production deploy fails before Dokploy moves traffic, leave the current app alone and inspect Dokploy deployment logs.

If production migration fails after the shadow check passed, keep the last healthy app running and apply a corrective migration.

## Review Apps

Run a review app health check:

```shell
curl --fail --silent https://<dokploy-preview-host>/healthz
```

If Safari or curl cannot resolve the preview host, verify that Dokploy generated a host under the review-app wildcard:

```shell
dig +short <dokploy-preview-host>
dig +short test.review.valentinmouret.io
```

The expected review-app host shape is `*.review.valentinmouret.io`. A host like `preview-fitness-app-...valentinmouret.io` is outside the configured review-app wildcard and will not resolve unless a separate root-zone wildcard exists.

If DNS resolves but HTTPS fails before reaching the app, check the edge proxy route. Caddy currently owns public `80/443`, so review-app hostnames must be routed from Caddy to Dokploy Traefik, or public `80/443` must move to Dokploy Traefik.

With Caddy still owning the edge, apply the repository Caddyfile on the VPS and reload Caddy:

```shell
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

If Caddy validation or reload fails because `*.review.valentinmouret.io` requires a DNS challenge, either install Caddy with the Cloudflare DNS module and configure wildcard TLS, or replace the wildcard site block with the exact Dokploy preview host while validating a single review app.

After reloading Caddy, confirm the review hostname reaches the app:

```shell
curl --fail --verbose https://<dokploy-preview-host>/healthz
```

Dokploy preview environment variables:

```dotenv
PREVIEW_APP=true
NODE_ENV=production
PORT=5174
AUTH_USERNAME=...
AUTH_PASSWORD=...
ANTHROPIC_API_KEY=...
REVIEW_DATABASE_ADMIN_URL=postgresql://valentin:...@172.20.0.1:5432/postgres
REVIEW_DATABASE_SOURCE_URL=postgresql://valentin:...@172.20.0.1:5432/fitness
REVIEW_DATABASE_URL_PREFIX=postgresql://valentin:...@172.20.0.1:5432/
REVIEW_DATABASE_RUN_SEED=true
```

The preview container entrypoint derives its database name from `DOKPLOY_DEPLOY_URL`, copies production data into that database, runs migrations, ensures baseline measurements exist, and then starts the app.

List review databases:

```shell
sudo -iu postgres psql -c "
  select d.datname, sd.description
  from pg_database d
  left join pg_shdescription sd
    on sd.objoid = d.oid
   and sd.classoid = 'pg_database'::regclass
  where d.datname like 'fitness_review_%'
  order by d.datname;
"
```

Drop a review database after its Dokploy preview deployment is gone:

```shell
sudo -iu postgres dropdb --force <fitness_review_database_name>
```

## PostgreSQL

List databases:

```shell
sudo -iu postgres psql -c '\l'
```

Check production database connectivity:

```shell
sudo -iu postgres psql fitness_production -c 'select 1;'
```

Drop a broken review app database:

```shell
sudo -iu postgres dropdb --if-exists fitness_review_pr_123
```

Dokploy app containers must not use `localhost` for native PostgreSQL. From inside those containers, PostgreSQL is reached through the Docker bridge host address.

Current production value:

```text
DATABASE_URL=postgres://...@172.20.0.1:5432/fitness
```

If a review app fails with `no pg_hba.conf entry for host "172.20.0.x"`, allow the Dokploy Docker bridge subnet in PostgreSQL host-based authentication:

```shell
sudo grep -n "172.20" /etc/postgresql/17/main/pg_hba.conf
sudo install -o postgres -g postgres -m 640 /etc/postgresql/17/main/pg_hba.conf /etc/postgresql/17/main/pg_hba.conf.bak
sudo tee -a /etc/postgresql/17/main/pg_hba.conf >/dev/null <<'EOF'
host    all             valentin        172.20.0.0/16           scram-sha-256
EOF
sudo systemctl reload postgresql@17-main
```

Validate the host-based authentication rule from a Dokploy app container:

```shell
APP="$(docker ps --format '{{.Names}}' | grep '^fitness-app-' | head -1)"
docker exec "$APP" sh -lc 'psql "$DATABASE_URL" -c "select 1;"'
```

Check bridge access from the app container:

```shell
APP="$(docker ps --format '{{.Names}}' | grep '^fitness-app-' | head -1)"

docker exec "$APP" sh -lc 'node -e "
  const net = require(\"node:net\");
  const u = new URL(process.env.DATABASE_URL);
  const s = net.createConnection({ host: u.hostname, port: Number(u.port || 5432) });
  s.on(\"connect\", () => { console.log(\"tcp-ok\"); s.end(); });
  s.on(\"error\", e => { console.error(e.code, e.message); process.exit(1); });
"'
```

## GitHub Runner

The self-hosted runner should not hold production application secrets beyond what is needed to call Dokploy and prepare databases.

Restart the runner:

```shell
sudo systemctl restart github-actions-runner-fitness
```

Check the latest runner logs:

```shell
journalctl -u github-actions-runner-fitness -n 200 --no-pager
```

## Common Failures

Failed image build:

- keep the current production app running;
- inspect Dokploy deployment logs;
- fix the commit and push again.

Failed shadow database migration:

- keep the current production app running;
- inspect the database lifecycle log;
- fix the migration and push again.

Failed production migration:

- the app may be in a partially upgraded database state;
- keep Dokploy routed to the last healthy app until the schema issue is understood;
- apply a corrective migration if needed.

Failed candidate health check:

- keep traffic on the old app;
- inspect candidate container logs in Dokploy;
- fix the commit and push again.

Failed review app refresh:

- destroy the preview deployment in Dokploy if needed;
- drop the review database;
- rerun the review app deploy from the pull request workflow.
