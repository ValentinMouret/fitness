# Deployment

This document describes the target deployment architecture for Fitness on the OVH VPS.

The preferred direction is Dokploy-first: use Dokploy for the deployment UI, Git integration, Docker builds, routing, logs, production deploys, and review apps. Keep custom scripts only for Fitness-specific behavior that Dokploy does not own, mainly database preparation.

## Requirements

### Production

- Production is served at `https://fitness.valentinmouret.io`.
- The application is protected by basic authentication.
- Production deploys happen from `main` only after CI passes.
- The VPS builds the app image locally from the requested Git commit.
- PostgreSQL runs natively on the VPS.
- Database migrations run automatically during deploy.
- A failed build, migration, boot, or health check keeps the currently routed production container serving traffic.
- Deploy history and rollback releases are out of scope.
- Backups are out of scope for now.

### Review apps

- Every non-draft pull request from this repository gets a review app after CI passes.
- Draft pull requests never deploy review apps.
- Pull requests from forks never deploy review apps.
- Review apps are destroyed when their pull request closes.
- Review apps are served at `https://pr-<number>.review.valentinmouret.io`.
- The wildcard DNS record already exists in Cloudflare.
- Dokploy preview deployment domains must be generated under `review.valentinmouret.io`.
- Review apps use the same application authentication environment as production.
- Each review app gets its own PostgreSQL database on the same local PostgreSQL server.
- Each review app database is copied from production, then migrated with the pull request code.

## Selected architecture

The target setup uses these components:

- Ubuntu on the OVH VPS.
- Dokploy as the deployment platform.
- Dokploy-managed Traefik as the public reverse proxy and TLS terminator.
- Native PostgreSQL for production and review databases.
- Docker containers built and managed by Dokploy.
- A self-hosted GitHub Actions runner on the VPS for CI compute.
- GitHub integration in Dokploy for repository access and preview deployments.
- GitHub Actions calling Dokploy after CI passes where Dokploy's automatic trigger would deploy too early.

Choosing Dokploy means the public app routing should move to Dokploy-managed Traefik. Because Caddy still serves other services on this VPS, the current transition state keeps Caddy on public `80/443` and proxies Fitness traffic to Dokploy Traefik on localhost.

## Current VPS State

As of 2026-05-03, Dokploy is installed side-by-side with the existing Caddy deployment, and Fitness production traffic is routed through Dokploy.

What exists now:

- Caddy still owns public `80/443`.
- Caddy still serves Fitness, Jellyfin, Plex, and torrent routes.
- Caddy routes `fitness.valentinmouret.io` to Dokploy Traefik on `127.0.0.1:18080`.
- Dokploy runs in Docker Swarm.
- Dokploy UI is available at `https://dokploy.valentinmouret.io` through Caddy.
- The raw Dokploy port `:3000` is intentionally blocked from the public internet.
- The direct `:3000` block is persisted by `dokploy-admin-port-lockdown.service`.
- Dokploy's internal Traefik is running on localhost-only alternate ports:
  - `127.0.0.1:18080 -> :80`;
  - `127.0.0.1:18443 -> :443`.
- Dokploy's global host is configured as `dokploy.valentinmouret.io`.
- Dokploy's per-user temporary trusted-origin workaround for `http://valentinmouret.io:3000` has been removed.
- The public production app serves `/healthz` and reports PostgreSQL connectivity.
- Docker image/runtime support for `GIT_SHA` exists in the repository.
- The Dokploy app currently reports `sha: "unknown"` because Dokploy build/env SHA injection is not wired yet.

Important services:

```text
dokploy
dokploy-postgres
dokploy-redis
dokploy-traefik
dokploy-admin-port-lockdown.service
caddy.service
postgresql@17-main.service
```

The old `fitness-app-1` rollback container has been stopped and removed.

## Why Dokploy

Dokploy is a good fit because it provides the product surface that was previously custom:

- web UI for deploy status and logs;
- Git provider integration;
- Dockerfile and Docker Compose deployments;
- programmable deploy API;
- preview deployments for pull requests;
- custom domains for preview apps;
- cleanup of preview deployments when pull requests close.

The main custom requirement is database lifecycle:

- production deploys need migration gating;
- review apps need fresh databases copied from production;
- review app databases need migrations from the pull request code;
- failed database preparation must not publish a broken review app.

Those behaviors should live in small scripts called from Dokploy pre-deploy commands or from GitHub Actions before triggering a Dokploy deploy.

## Completed

- Interviewed and documented the deployment requirements.
- Selected Dokploy as the preferred deployment platform.
- Added `GET /healthz` to the app.
- Added PostgreSQL connectivity to the health response.
- Added `GIT_SHA` to the app environment schema.
- Added Docker build/runtime support for `GIT_SHA`.
- Installed Dokploy side-by-side without taking Caddy off `80/443`.
- Exposed Dokploy at `https://dokploy.valentinmouret.io` through Caddy.
- Removed direct public access to Dokploy's raw `:3000` port.
- Persisted the raw `:3000` block with a systemd oneshot service.
- Configured the Dokploy Fitness production app.
- Routed `fitness.valentinmouret.io` through Caddy to Dokploy Traefik.
- Connected the Dokploy app to native PostgreSQL through the Docker bridge.
- Confirmed public production `/healthz` returns `status: ok` and `checks.database: ok`.
- Removed the old repository-managed webhook deployment config and scripts.
- Removed the old GitHub workflow jobs that called the webhook review-app endpoints.
- Applied the updated Caddyfile on the VPS and reloaded Caddy.
- Stopped and disabled `webhook.service`.
- Stopped and removed the old `fitness-app-1` rollback container.
- Removed old generated review app Caddy snippets from the VPS.

## Next Work

The old VPS deployment path has been removed. Dokploy is the active production deployment path.

Deferred work:

- CI-gated Dokploy production deploys.
- Dokploy-managed health checks.
- `GIT_SHA` injection into Dokploy builds.
- Full review app cleanup automation when preview deployments are removed.

Concrete next steps:

1. Persist PostgreSQL access from the Dokploy Docker bridge if it is not already persisted outside the current session.
2. Add Tailscale-based admin access for Dokploy and other private server surfaces.
3. Configure Dokploy preview deployment domains and environment variables.
4. Route review-app hostnames through the active edge proxy and validate one preview deployment.
5. Decide whether Caddy remains the front proxy for all services or whether Jellyfin, Plex, and torrent move to Dokploy-managed Traefik.

## Installation Notes

The default Dokploy installer expects ports `80`, `443`, and `3000` to be free. On this VPS, Caddy already owns `80/443`, so the default installer fails with `Error: something is already running on port 80`.

The current install intentionally avoided that by:

- creating Dokploy's Swarm services manually;
- publishing Dokploy UI on `:3000`;
- running Dokploy Traefik on localhost-only `18080/18443`;
- proxying `https://dokploy.valentinmouret.io` from Caddy to `127.0.0.1:3000`;
- blocking direct public access to `:3000`.

Do not stop Caddy just to make the installer pass unless all Caddy-managed sites are ready to be migrated.

## Server Ownership

Root is used only for initial installation and OS-level service changes.

Runtime ownership:

- `dokploy`: owns Dokploy runtime state, deployment configuration, and managed containers.
- `postgres`: owns PostgreSQL.
- `github-runner`: owns the self-hosted GitHub Actions runner.

The Dokploy runtime has Docker access. On a single-user VPS this is acceptable, but it should be treated as privileged access.

## Filesystem Layout

Dokploy owns most deployment state. Fitness-specific files live outside generated Dokploy internals so they can be backed up, inspected, and replaced independently.

Target layout:

```text
/srv/fitness/
  env/
    app.env                     # shared app environment for production and review apps
    dokploy.env                 # Dokploy API token for local scripts, if needed
  db/
    prepare-production.sh       # shadow DB + production migration gate
    prepare-review-app.sh       # create/copy/migrate review DB
    destroy-review-app.sh       # drop review DB
  logs/
    db/
  state/
    review-apps/
      pr-<number>.env           # generated review app env, if Dokploy needs file-based env
```

System files:

```text
/etc/systemd/system/github-actions-runner-fitness.service
```

Dokploy-managed files and Traefik files are left in Dokploy's own installation directories.

## Environment

`/srv/fitness/env/app.env` is the shared application environment for production and review apps.

It contains at least:

```dotenv
NODE_ENV=production
AUTH_USERNAME=...
AUTH_PASSWORD=...
ANTHROPIC_API_KEY=...
```

`DATABASE_URL` is generated per environment:

- production points to the production database;
- each review app points to its own `fitness_review_pr_<number>` database.

Secrets are not stored in the repository.

## Networking

Target state: Dokploy-managed Traefik is the only public HTTP entrypoint for Fitness.

```text
Internet
  -> Cloudflare DNS
  -> Dokploy Traefik :443
  -> production app container
  -> review app container
  -> Dokploy UI
```

Application containers are exposed through Dokploy domains, not host port bindings.

Domains:

- production: `fitness.valentinmouret.io`;
- review apps: `pr-<number>.review.valentinmouret.io`;
- Dokploy UI: a separate admin hostname, protected by Dokploy authentication and not reused for the app.

Current transition state:

```text
Internet
  -> Cloudflare DNS
  -> Caddy :443
  -> Dokploy Traefik 127.0.0.1:18080
  -> production app container
```

The old `/hooks/*` deployment route has been removed from the repository Caddyfile and from the live VPS Caddy config.

## Production Deploy Lifecycle

Input:

- branch: `main`;
- Git SHA;
- successful CI result.

Lifecycle:

1. GitHub Actions runs CI on the self-hosted runner.
2. The production deploy job runs only after required CI jobs pass.
3. The deploy job prepares a production migration check:
   - create a shadow database from production with `pg_dump` and `pg_restore`;
   - run migrations against the shadow database;
   - fail without touching production if the shadow migration fails.
4. The deploy job triggers Dokploy production deployment for the selected SHA.
5. Dokploy builds the app image on the VPS.
6. Dokploy starts the candidate container.
7. Dokploy health checks verify that the candidate serves HTTP and can reach PostgreSQL.
8. Production migrations run against the production database.
9. Dokploy moves traffic only after the candidate is healthy.
10. The previous container is retired after the routing change.

If build, boot, migration gate, or health check fails before traffic moves, the current production app keeps serving traffic.

Database migrations are the one point that cannot be made fully reversible without a backup or compatibility window. The shadow database check catches migration failures before production, but once production migrations succeed, schema rollback is out of scope.

## Review App Deploy Lifecycle

Input:

- Dokploy preview deployment URL;
- pull request branch;
- Git SHA.

Lifecycle:

1. Dokploy creates or updates the preview deployment for the pull request.
2. Dokploy injects preview-specific environment variables, including `DOKPLOY_DEPLOY_URL`.
3. The container entrypoint sees `PREVIEW_APP=true`.
4. The entrypoint derives a PostgreSQL database name from `DOKPLOY_DEPLOY_URL`.
5. The entrypoint drops and recreates that review database.
6. The entrypoint copies production data into the review database with `pg_dump` and `pg_restore`.
7. The entrypoint runs migrations against the review database with the pull request code.
8. The entrypoint runs the baseline measurement seed, unless `REVIEW_DATABASE_RUN_SEED=false`.
9. The entrypoint exports the review `DATABASE_URL` and starts the app.

Review app data is disposable. A new commit refreshes the review app from current production data.

Required Dokploy preview environment variables:

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

`DATABASE_URL` does not need to be set for previews. If Dokploy inherits it from production, the preview entrypoint overrides it before running migrations, seeds, or the app server.

The preview seed only ensures the baseline measurements exist. The other seed files are not run for previews because the database is copied from production.

## Review App Destroy Lifecycle

Lifecycle:

1. Dokploy destroys the preview deployment when the pull request closes or merges.
2. The review database remains until manual cleanup or a future cleanup automation drops it.

Review databases are named `fitness_review_<preview-url-slug>_<hash>`. The entrypoint also writes a database comment containing the preview URL and creation time.

## Health Checks

A health check prevents routing traffic to a dead candidate.

It should verify:

- the container process is running;
- the HTTP server responds locally;
- the app can reach PostgreSQL;
- the expected build SHA is the one running.

Recommended application endpoint:

```text
GET /healthz
```

Recommended successful response:

```json
{
  "status": "ok",
  "sha": "<git-sha>"
}
```

The endpoint must not expose secrets.

## TODO

- Persist PostgreSQL access from the Dokploy Docker bridge if it is not already persisted outside the current session.
- Set up Tailscale-based admin access for Dokploy and other private server surfaces.
- Later: configure Dokploy `GIT_SHA` injection.
- Later: configure Dokploy-managed `/healthz` health checks if the feature is available.
- Later: validate CI-gated Dokploy production deployments.
- Later: automate review database cleanup when preview deployments are removed.

## GitHub Workflows

CI jobs run on the self-hosted VPS runner.

Required jobs:

- format/lint;
- typecheck;
- schema and migration checks;
- unit and integration tests against local PostgreSQL service or a test PostgreSQL container;
- build;
- e2e tests.

Future production deploy job:

- runs only on `push` to `main`;
- depends on all required CI jobs;
- triggers Dokploy through its API or webhook;
- does not build the production image in GitHub.

Future review app deploy job:

- runs only for non-draft pull requests targeting `main`;
- runs only when the pull request source repository is this repository;
- depends on all required CI jobs;
- prepares the review database;
- triggers or permits the Dokploy preview deployment.

Future review app destroy job:

- runs when a pull request closes;
- runs only when the pull request source repository is this repository;
- destroys the Dokploy preview deployment or lets Dokploy handle preview cleanup;
- drops the review database.

## Git Access

Dokploy uses GitHub integration to fetch the repository.

This means:

- GitHub does not need SSH access to the VPS;
- the VPS needs read access to GitHub;
- manual SSH access to the VPS remains available for operations.

## Failure Model

Production deploy failures before Dokploy moves traffic keep the current production app serving traffic.

Review app deploy failures leave the previous review app serving if one exists. If the failure happens during database refresh, the review app can be recreated by rerunning the deploy.

The database scripts should write one timestamped log file per run under `/srv/fitness/logs/db`.

## Out Of Scope

- automated backups;
- release history outside what Dokploy provides;
- multi-server deployment;
- Kubernetes;
- external container registry;
- public unauthenticated routes;
- review apps for forks;
- manual review apps for draft pull requests.

## Release asset retention (ENSO-92, activation held)

The application loads initial route metadata while keeping route modules lazy.
Only outgoing sidebar/bottom-tab navigation from an idle `/workouts` or
`/measurements` index starts a document request to adopt the current frontend.
Same-tab clicks, active workouts, builders, editors and pending operations retain
client navigation. This does not update every old tab automatically, and it does
not preserve drafts across manual refresh or deliberately leaving their route.

Old hashed modules must remain available: initial metadata does not download
those modules, and a removed module can still cause React Router to reload and
lose mounted drafts. Retention is a release prerequisite, not an app fallback.

### Publish before serving traffic

The opt-in [startup wrapper](retained-entrypoint.sh) runs the
[publisher](publish-assets.ts) before the existing migration/server entrypoint.
Production build arguments are `RETENTION_STARTUP_USER=root` and
`RETAIN_PRODUCTION_ASSETS=true`. Both default to the current nonpublishing `bun`
startup. The wrapper always drops root to `bun` before migrations or HTTP,
including when publication is disabled. Startup code and its parent directory
are root-owned and cannot be modified by the app.

The publisher requires a real mount at `/retained-production`, owned by root
with mode 0755. It accepts only flat fingerprinted regular files from the image's
`/app/build/client/assets`, rejects symlinks, hard links and differing bytes at an
existing name, verifies staged SHA-256 hashes, and publishes via atomic
no-overwrite hard links. Files are 0644; manifests are 0600 in a 0700 directory
outside `assets`. It syncs files and publication directories before starting the
app. A failure stops startup. Publication is additive: a failed candidate may
leave valid unused files, and no deploy deletes old assets.

The image health check waits for successful HTTP and database readiness. In a
start-first Swarm update, this prevents a failing publisher from replacing the
healthy task merely because its container process started. The isolated Swarm
rehearsal uses production's rollback policy and five-second monitor/restart delay;
without the health check the original task was retired, whereas the reviewed
health check kept that same task running through publisher failure and rollback.

Dokploy v0.29.2 supports separate `buildArgs` and `previewBuildArgs`; preview
builds replace production arguments. Keep preview arguments at their defaults,
and do not put the retention flag in the shared runtime environment. A retained
mount may still be inherited by previews. The default preview process is `bun`
and cannot modify root-owned retained files or read private manifests; an
explicit retention flag in a preview stops startup before publication. Caddy's
retained handler belongs only to the production site. Do not claim the mount is
absent from previews.

Verify with `bash deploy/test-retention.sh`. It builds default and publishing
images, uses an isolated disposable PostgreSQL container and volume, verifies
image/store hashes, missing-mount and flagged-preview failures, PID 1 running as
UID 1000, protected startup/store paths, and an actual preview database copy and
server even with an inherited mount. CI runs the same acceptance check. The
preview check seeds measurements against the migrated ownership schema for an
accepted synthetic owner, verifies that the source stays unchanged, and rejects
missing or revoked owners. Run this command locally before handing off changes
to preview startup, seeding, or ownership migrations: the ordinary `bun run gate`
does not execute container entrypoints or their SQL.
The filesystem tests also cover concurrent identical/conflicting publishers.
The same command verifies the production-only Caddy handler using a read-only
store, including old-only bytes/MIME/immutable headers, proxy misses, preview
isolation and HTML no-store. It then runs a disposable Docker-in-Docker Swarm;
the developer/CI Docker daemon's Swarm state is unchanged. This test needs Docker
with privileged test-container support. Its PostgreSQL, volumes and inner daemon
are disposable and never use production data.

### Activation and rollback (held for review)

1. Complete independent operational review and verify the live configuration
   for the brief root startup publisher, bind mount and Caddy change. Existing
   idiomatic implementation authorization remains valid; routine preparation
   needs no new generic approval. Resolve any actual saved Dokploy access
   restriction through the permitted user settings, without bypassing it. Save
   fresh Dokploy settings, Caddy config, full Swarm service spec and immutable
   current/rollback image IDs. Disable autoDeploy and drain all production jobs
   before merging or installing; keep automatic/manual releases suspended while
   seeding. Do not change native authentication or ownership migrations.
2. Create `/srv/fitness/retained-production` as root:root 0755. Pin the sole
   desired-running production task/container by exact Swarm labels. Export its
   `/app/build/client/assets` from that full container ID to private staging,
   then use the reviewed publishing image's `bun /app/deploy/publish-assets.ts`
   command with staging mounted read-only at `/app/build/client/assets` and the
   host store mounted at `/retained-production`. Set `GIT_SHA=unknown` if the
   source cannot identify its revision; record the actual source container and
   immutable image ID separately. Recheck the task/container after seed and
   compare every exported/retained hash. Abort if routing changed or is ambiguous.
   Seed any older image intended for rollback as well.
3. Configure production build arguments above and a bind mount from
   `/srv/fitness/retained-production` to `/retained-production`. Preserve default
   preview build arguments. Check the actual production image user/flag, mounted
   host path and root ownership. The publisher must complete before HTTP starts;
   the resulting server must run as `bun`. Test a preview cannot modify the store.
4. After the seed and publishing startup are verified, copy
   the reviewed snippet to `/srv/fitness/retained-assets.caddy` and import that
   absolute path inside only the production site in the live
   `/home/valentin/fitness/deploy/Caddyfile`, before its proxy fallback. Preserve
   both that file and `/etc/caddy/Caddyfile`; validate the complete effective
   configuration before reload. Compare retained asset bytes, MIME and
   immutable headers. Missing assets must proxy, HTML/private data must retain
   their existing policy, and preview routing must be unchanged. Perform the
   cold old-tab/new-release draft-preservation test through the public route.
5. Keep all retained files during deployments. Retain retired releases for at
   least 30 days from retirement and preserve current/rollback releases. Cleanup
   is separate reviewed operator work using manifests and retirement timestamps,
   never original file mtimes; no pruning is included here.

On publisher failure, the candidate must not become healthy; verify the original
healthy task continues serving through rollback. The live service currently has
no health check: the reviewed image's probe must be present and must not be
disabled by a service override before activation.
On Caddy failure, restore its saved production site and reload; do not remove
retained files. To roll back the image/startup settings, first remove the retained
Caddy handler, then restore the saved build arguments/mount and previously routed
image using an operator-rehearsed exact service rollback command. Dokploy's
ordinary Deploy button builds current Git and is not proof of immutable image
rollback. Preserve the full service spec and rehearse restoring its saved image
and startup/mount settings before activation. An older rollback image may lack
the readiness probe: preserve a working HTTP/database health check as a service
override when restoring it, and rehearse that exact command. Removing the handler ends the
old-tab retention guarantee.
Already retained bytes need no rollback or deletion.

### Separate deployment control hold

The October 2 audit found `autoDeploy=true` on GitHub `main` plus manual Deploy.
Dokploy v0.29.2 has no shared before-traffic host hook, no per-application runtime
user override, and no commit SHA parameter on `application.deploy`. The startup
publisher covers asset publication for every configured candidate without a
custom deploy orchestrator. It does **not** establish CI-gated exact-commit
releases. That release requirement remains a separate activation hold: an API
call alone cannot prove which commit Dokploy clones. Do not claim a serialized
CI export gate exists, or activate production while operational review, access
restrictions or live control checks remain unresolved. An earlier automatic
approval review rejected Dokploy access because of a saved browser preference;
resolve that actual restriction through permitted user settings, without using
an alternate route to perform the blocked access/configuration action.

A supervised release can keep the application branch at `main`, preserving PR
preview selection: with autoDeploy disabled and production jobs drained, install
an active GitHub ruleset for exactly `refs/heads/main` that restricts updates and
deletion with no bypass actors. Record the created rule ID and read back its full
configuration and effective branch rules. Only then select the frozen **postmerge
main** revision and require successful CI on that exact SHA; PR-head CI is not a
substitute. Keep the lock through Dokploy clone/build, verified image/task/HTTP
readiness and any recovery. Check the actual clone SHA and immutable image/task
identity; a supplied `GIT_SHA` build argument alone proves no source identity.
Remove only that recorded rule after successful verification or reconciled
recovery with no pending production jobs. Leave autoDeploy disabled. This is a
supervised release procedure, not an ongoing automatic CI gate; no rule has been
installed by this change.

The original older amd64 image passed a disposable-service rehearsal on its
native host using synthetic PostgreSQL and a private network: HTTP/database
readiness, UID 1000, retention of the original test task through a failed
readiness candidate, and recovery of a new healthy task from the same immutable
image with the port-5174 health override. Owned test resources were removed and
the live Fitness task/service spec stayed unchanged. This establishes actual
older-binary disposable recovery; fresh image/settings capture, asset seed and
live cutover/reconciliation remain activation checks. Martin has not returned
his independent SRE review; the source review does not represent his approval.

The local two-version regression used distinct A/B lazy modules, an empty browser
cache and real Caddy serving retained files read-only. B alone returned 404 for
A's old module; Caddy returned retained bytes without a document reload. Builder
objectives/selected ingredients and genuinely unsaved completed-set edits stayed
mounted across replacement/revalidation, including the active rest timer.
Leaving an idle workout index adopted B. Combined with the container acceptance,
this verifies the candidate mechanism locally; it does not establish live
Dokploy settings, production activation or exact-commit deployment control.
