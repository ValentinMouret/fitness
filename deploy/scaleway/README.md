# Scaleway deployment

Terraform provisions one STARDUST1-S in Warsaw (`pl-waw-2`), with PostgreSQL,
Fitness and Caddy on the same host. IPv6-only is the default; Cloudflare's proxied
AAAA record serves both IPv4 and IPv6 visitors. This is the authoritative operator
guide for Scaleway; the older OVH/Dokploy guide is recovery context.

## Current deployment and ownership

On 2026-11-01, Valentin authorized an empty replacement because OVH was down,
then requested the current application and automated deployment from `main`.
Infrastructure and the Cloudflare deployment tunnel have been provisioned. The
connector service is active, authenticated tunnel SSH works as `fitness-deploy`,
and unauthenticated tunnel requests return 401. GitHub's four deployment secrets
and hostname variable are configured. Application revision
`471e9cbb7cfc8743b4a30e46989c6dc961dba521` reports healthy database connectivity;
browser checks verified the current navigation and existing password login.
The first successful gated CI deployment remains a separate verification: these
checks do not establish that the newly configured workflow has completed.

| Component | Operator reference |
| --- | --- |
| Public application | `https://fitness.valentinmouret.io` |
| Scaleway instance | `pl-waw-2/15eff67f-2d81-4d99-9093-7f6baa49d2b5` |
| Public IPv6 | `2001:bc8:1d90:2f82:dc00:ff:fe09:430e` |
| CI SSH hostname | `deploy-fitness.valentinmouret.io` |
| Cloudflare tunnel | `629db578-36a0-496a-b780-6d08e4a7d21b` |
| Connector service | `fitness-deployment-tunnel.service` |
| Application files | `/srv/fitness`, owned by `fitness-deploy` after access installation |
| Database | Docker volume `fitness_postgres`; never run `down -v` |

This guide gives Martin the operator references for independent SRE verification;
it does not reassign implementation or release ownership. Record the exact
deployed SHA from `/healthz`, workflow run, migration result and relevant user
checks at each handoff. Do not infer deployment from the
current checkout: the initial Scaleway release used an older branch. Release only
the reviewed `main` revision, with the Docker image's `GIT_SHA` matching it.

Public traffic follows Cloudflare → Caddy → `127.0.0.1:5174` → PostgreSQL at
`127.0.0.1:5432`. CI follows Cloudflare Access → outbound IPv6 cloudflared tunnel
→ local SSH → `fitness-deploy`. The tunnel supplies IPv4-capable CI access without
buying an IPv4 address. Scaleway SSH ingress remains restricted to operator CIDRs;
HTTP/HTTPS and ICMP rules explicitly cover IPv4 and IPv6. Terraform manages the
deployment CNAME; the public application's proxied AAAA was configured separately.

## Cost and limits

Checked 2026-11-01: compute €0.0006/hour plus 10 GB local disk at
€0.000049/GB/hour is about **€0.80/month excluding VAT** (730 hours).
Optional IPv4 adds €3.65/month, making about €4.45/month.
[Scaleway price update](https://www.scaleway.com/en/blog/a-transparent-update-on-scaleway-pricing/)
and [network pricing](https://www.scaleway.com/en/pricing/network/).
Warsaw reported stock available; recheck the
[availability API](https://api.scaleway.com/instance/v1/zones/pl-waw-2/products/servers/availability)
before applying. Stock is not a reservation.

The VM has 1 GB RAM and a 10 GB local disk ceiling. Two GB of disk are swap.
Build images on your workstation, not the VM. Measure database and image sizes
before migrating; keep enough room for a database dump, image load and OS updates.
No paid registry, managed database, load balancer or deployment dashboard is used.
Serverless SQL cannot run the current MCP reader role/permission provisioning.

IPv6 must work from a direct operator SSH client and from the VM to package
repositories, container registries and Anthropic. CI uses the tunnel below and
does not require an IPv6-capable runner. A paid IPv4 remains an explicit fallback;
do not allocate it just to accommodate GitHub-hosted CI. Host networking lets the app reach IPv6;
PostgreSQL and the app bind only to 127.0.0.1. Only Caddy is public.
This is a single-host deployment with downtime during app replacement, no HA,
and no automatic rollback after migrations. Local pre-migration dumps are not
an off-host backup. Routine backup storage and review apps are not included.

## Authentication client IP

Email-code rate limiting reads only `X-Real-IP`. Caddy always overwrites that
header with its resolved client IP. It accepts `CF-Connecting-IP` only from
Cloudflare's published proxy ranges; direct origin requests use their socket IP,
so supplying forged forwarding headers cannot choose a different limiter identity.
The app remains bound to localhost. Do not add arbitrary/private networks to the
trusted proxy list or expose the app port.

The static ranges in `Caddyfile` were checked on 2026-11-01 against Cloudflare's
[IPv4 list](https://www.cloudflare.com/ips-v4/) and
[IPv6 list](https://www.cloudflare.com/ips-v6/). Review them when Cloudflare changes
its ranges. See Caddy's [trusted proxy settings](https://caddyserver.com/docs/caddyfile/options#trusted-proxies).

## Provision

For existing production, first follow **Terraform state and operator procedure**
below. These provisioning steps also describe a genuinely new deployment; never
apply them with an empty state against the existing production resources.

1. In Scaleway IAM, create an API key. Prefer an application with Instance access
   scoped to the intended project, including IAM SSH-key creation; an owner user
   key inherits owner access.
   Store credentials outside the repository in a mode-0600 file. Export
   `SCW_ACCESS_KEY`, `SCW_SECRET_KEY`, `SCW_DEFAULT_PROJECT_ID` and
   `SCW_DEFAULT_ORGANIZATION_ID` into the Terraform process. Never put secrets in
   tfvars, cloud-init or Git. Retain the Terraform state securely.
2. Copy `terraform.tfvars.example` to `terraform.tfvars`. Set your public SSH key
   and your actual SSH source CIDR (IPv6 for the default configuration).
3. Run `terraform init`, `terraform plan -out=deployment.tfplan`, inspect the plan,
   then `terraform apply deployment.tfplan`. Resources include one VM,
   one free IPv6 allocation, a security group, a project SSH key and the Cloudflare
   deployment tunnel/Access/DNS resources. The public application's DNS is separate.
   Scaleway distributes project SSH keys to other instances in that project.
4. Verify the SSH host fingerprint through Scaleway's API user-data key
   `ssh-host-fingerprints` (or serial console) before
   trusting it. Use the output `ipv6_address` for SSH and DNS. Wait for
   `cloud-init status --wait`; inspect `/var/log/cloud-init-output.log` on failure.
5. Configure an SSH alias such as `fitness-scaleway` for root at that address.
   Copy `compose.yaml`, `Caddyfile`, and `release.sh` into `/srv/fitness/`.
   Verify Docker Compose supports raw env files (v2.30 or later).

The VM is deletion-protected in Scaleway and Terraform. The root disk is retained
on termination. Do not remove those protections to work around a replacement plan;
recover data first. Cloud-init is first-boot configuration, not a configuration
management system: changing its template does not rerun installation on an
existing VM.

## Terraform state and operator procedure

The canonical production state is currently local, at this exact path:

```text
/Users/valentinmouret/Developer/valentinmouret/fitness/deploy/scaleway/terraform.tfstate
```

The application upgrade checkout is
`/Users/valentinmouret/.codex/worktrees/scaleway-current/fitness`. Its
`backend "local" {}` was initialized with the absolute canonical path above.
Its `.terraform/terraform.tfstate` is backend metadata, not a second production
state. A fresh clone/worktree does not inherit that backend configuration or the
ignored operator input file. Do not copy state into each worktree, create a new
Terraform workspace, or apply an empty plan to reconstruct existing resources.

From the reviewed current checkout, load Scaleway and Cloudflare credentials into
the process environment without printing them, then use:

```sh
set -euo pipefail
umask 077
fitness_state=/Users/valentinmouret/Developer/valentinmouret/fitness/deploy/scaleway/terraform.tfstate
fitness_inputs=/Users/valentinmouret/Developer/valentinmouret/fitness/deploy/scaleway/local.auto.tfvars.json
test -s "$fitness_state" && test -s "$fitness_inputs"
terraform -chdir=deploy/scaleway init -reconfigure -backend-config="path=$fitness_state"
terraform -chdir=deploy/scaleway workspace show
terraform -chdir=deploy/scaleway state list
terraform -chdir=deploy/scaleway plan -lock-timeout=5m \
  -var-file="$fitness_inputs" -out=deployment.tfplan
```

Require the `default` workspace and the known instance, IP, SSH key, security
group and Cloudflare resources. Inspect the plan before
`terraform -chdir=deploy/scaleway apply deployment.tfplan`. A proposal to create a
second VM or replace the current one is a stop condition to investigate state,
inputs and source. Do not bypass locking or `prevent_destroy` to make it proceed.
Use one operator at a time; local locking only coordinates callers using the same
canonical filesystem state. GitHub application deployment never runs Terraform.

Protect `terraform.tfstate`, its `.backup`, saved plans and any private state
snapshots with mode 0600 and restricted parent directories. Terraform `sensitive`
only redacts ordinary output; the state and binary plan contain readable connector
and Access client secrets. `terraform output -json`, `state pull` and `show -json`
can expose them. Do not paste their output, commit these files or upload them as
CI artifacts. The provider lock file is public dependency metadata and belongs in
Git; it is unrelated to the private state lock.

Keep an encrypted off-machine state backup and the credentials needed to recover
it. This guide does not claim that such a backup is already configured. A lost
laptop must not become the only copy of the resource mapping and secret outputs.
For recovery, freeze Terraform changes, restore the latest state, check its
lineage/resource IDs against live resources, then review a refresh-only plan.
If no state survives, import resources deliberately; rotate credentials whose
one-time secret values cannot be recovered. Never recreate the database-bearing
instance simply because Terraform lost its state.

## Configure and deploy

Create `/srv/fitness/app.env`, `database.env`, `migration.env`, and `runtime.env` from the examples
with mode 0600. They are root-owned during bootstrap; the access installer transfers
`/srv/fitness` to `fitness-deploy` for releases. Use separate random hex PostgreSQL
passwords for the `fitness_app` runtime role and the `fitness` migration/admin role,
so URI encoding is unambiguous. These files use literal values,
without surrounding shell quotes. The raw env-file format preserves `$` in secrets.
Preserve the production session secret, login, Anthropic key, OAuth clients and
issuer during recovery. Configure the MCP reader URL if the existing integration
uses it. Keep `PREVIEW_APP` unset. `runtime.env` contains only the public hostname
and the immutable active image digest after deployment.

`database.env` initializes PostgreSQL's `fitness` administrator. `migration.env`
contains that role's `DATABASE_URL`; it is loaded only by short-lived release
containers after `app.env`, overriding the runtime URL. The app service loads
only `app.env`, whose `DATABASE_URL` must use `fitness_app`. Its separate
`MCP_DATABASE_URL`, when configured, still uses `fitness_mcp_reader`.

The release runs migrations as admin, then [provisions the runtime role](provision-runtime.ts)
with SELECT/INSERT/UPDATE/DELETE on current and future `public` tables and
USAGE/SELECT on their sequences. Default grants apply to objects created by the
migration connection's role. It strips privileged role flags, refuses existing
object ownership or memberships, and removes PUBLIC database CREATE/TEMP and
public-schema CREATE permissions. The runtime cannot create schemas/tables,
alter roles, or bypass RLS; it does not own application tables. Account isolation
still depends on application authorization, not this database role alone.

Compose clears the image entrypoint and runs the image's HTTP command directly,
so ordinary startup/restart never migrates or provisions privileged roles.
The privileged one-off containers run only the requested Bun command and are
removed afterwards. They run as root to read the mode-0600 mounted runtime env
file; they never serve HTTP. This deployment does not support image-entrypoint
asset retention or preview bootstrap; keep their flags disabled.

For an existing installation, preserve the old administrator URL in a mode-0600
`migration.env`, change only `app.env`'s database URL to a new `fitness_app` password,
and install `provision-runtime.ts` beside `release.sh` before releasing. Keep the
same database name and host/port in both URLs. Do not demote the database owner or
change `POSTGRES_PASSWORD` expecting it to rotate an existing PostgreSQL role.
Releasing grants the runtime role before replacing the app. Verify runtime DML
and DDL denial after the switch; retain the backup/admin credentials for recovery.

From the repository run:

```sh
./deploy/scaleway/upload-release.sh fitness-scaleway <git-commit>
```

This builds the exact committed source for linux/amd64 and uploads it over SSH.
It excludes uncommitted work. Run the repository gate before releasing a commit.
On the server:

```sh
cd /srv/fitness
./release.sh fitness:<full-git-sha>
```

The release verifies the supplied full-SHA tag contains the same `GIT_SHA` and
resolves it to the Docker image ID. Compose runs that immutable digest. The release
locks concurrent deploys, starts PostgreSQL, saves a local dump,
runs migrations, runtime grants and optional MCP reader provisioning, waits for app health, then
starts Caddy and validates/reloads its configuration. Build/migration failure prevents app replacement. Boot failure can
leave the app unavailable; inspect `docker compose --env-file runtime.env logs`
and restore a compatible image or database as appropriate. Migration success
cannot be undone by reverting an image alone. The active image is saved to
`runtime.env` only after startup succeeds. Containers restart after host reboot.
Copy successful backups off-host and remove obsolete images/dumps deliberately
before the disk fills. Do not use `docker compose down -v`: it deletes data.

## Recover OVH data and cut over Cloudflare

If OVH is down, recover a database dump or use its rescue environment first.
A local development database is not automatically an acceptable production copy.
If there is no recoverable data, an empty deployment requires an explicit decision.
Keep the old disk and any backups intact.

Before starting the application, start only PostgreSQL with
`docker compose --env-file runtime.env up -d --wait postgres`. Restore a verified
PostgreSQL custom-format dump into the newly created, empty `fitness` database:

```sh
cat recovered.dump | docker compose --env-file runtime.env exec -T postgres \
  pg_restore --exit-on-error --no-owner --no-acl -U fitness -d fitness
```

Use a dump including the Drizzle migration history. Verify restored data and
migration state; provision the MCP reader again after migrations (the release
script does this when MCP_DATABASE_URL is present). Never restore over live data
without a separate recovery plan. Then run the release.

For `fitness.valentinmouret.io`, record the existing Cloudflare A/AAAA/CNAME values.
Replace only that hostname's old origin with a **proxied AAAA** pointing to the VM's
full IPv6 address; remove stale A/AAAA values for that same hostname. Preserve all
unrelated records. Caddy needs DNS pointing here before ACME can issue its public
certificate; inspect its logs during this step. Use Cloudflare **Full (strict)**
TLS, never Flexible. Do not change an account-wide TLS setting without checking
its other domains; prefer a hostname-specific rule if needed.

Verify `https://fitness.valentinmouret.io/healthz` reports the expected Git SHA and
healthy database, then test owner login, data visibility and OAuth/MCP. Check
outbound Anthropic connectivity from the app. A healthy HTTP endpoint alone does
not prove restored data or OAuth is correct. Retire OVH only after recovery and
these checks; this Terraform configuration never deletes it.

## Continuous deployment

GitHub Actions runs the full gate on GitHub-hosted machines. A successful push to
`main` then builds that exact SHA and deploys it to Scaleway; pull requests never
deploy. Superseded revisions are skipped, deployment runs serialize, and the final
health check must report the same SHA. CI does not need Scaleway provisioning keys
or application/database secrets.

The IPv6-only host is reached through the free Cloudflare Tunnel and Access
resources in `deployment-tunnel.tf`. Activate Cloudflare Zero Trust Free once in
the dashboard before applying these resources. Export `CLOUDFLARE_API_TOKEN` for
Terraform; the local existing `CLOUDFLARE_API_KEY` value is an API token, not a
global API key. Terraform state now contains sensitive tunnel and Access tokens:
keep it private and backed up. Do not upload plans or state as CI artifacts.

Install the verified cloudflared Linux AMD64 release from the version/checksum
pinned in `scripts/deploy-scaleway-ci.sh`. Transfer that binary, a dedicated CI
SSH public key and the sensitive `deployment_tunnel_token` output to the server,
then run `install-deployment-access.sh` as root with those three file paths.
The service uses IPv6 explicitly. The connector token stays on the VM.
The `fitness-deploy` user owns `/srv/fitness` and has Docker access, which is
privileged; its key disables SSH forwarding and interactive terminals.

Configure repository variable `SCALEWAY_DEPLOY_HOST` with `deployment_hostname`.
Configure these GitHub Actions secrets:

- `SCALEWAY_DEPLOY_SSH_KEY`: dedicated deployment private key, never your personal key.
- `SCALEWAY_DEPLOY_KNOWN_HOSTS`: verified server host key under the deployment hostname.
- `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`: corresponding sensitive
  Terraform outputs. The service token expires after one year; rotate it and
  update GitHub before `deployment_access_expires_at`.

CI preserves all remote env files. Deployments currently briefly interrupt the
app while replacing its container. Monitor free disk space and retain needed
backups off-host; the smallest instance has limited storage.

The current application requires an accepted owner identity even when legacy
password login remains enabled. Follow the owner-bootstrap/migration procedure
in `docs/operations/authentication.md` before upgrading a pre-ownership database.
Set `AUTH_FOUNDATION_OWNER_USER_ID` to that durable identity and keep
`AUTH_FOUNDATION_ENABLED=false` to retain the existing password login. Do not use
the local fixture seeder in production.

## Secret locations, rotation and recovery

| Material | Current home and consumer |
| --- | --- |
| Scaleway/Cloudflare provisioning API credentials | Operator environment/private local credential storage; Terraform only |
| App login, session secret, Anthropic/OAuth and runtime database credentials | VM `/srv/fitness/app.env`, mode 0600; app container |
| PostgreSQL administrator credentials | VM `/srv/fitness/database.env` and `migration.env`, mode 0600; PostgreSQL and short-lived release containers only |
| Cloudflare connector token | `/etc/cloudflared/fitness.token`, root:cloudflared 0640 inside a restricted directory; systemd connector |
| CI SSH private key and pinned server host key | GitHub Actions `SCALEWAY_DEPLOY_SSH_KEY`, `SCALEWAY_DEPLOY_KNOWN_HOSTS` |
| Access service credentials | GitHub Actions `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`; also Terraform state |

The deployment account's Docker membership is effectively root privilege. Giving
CI that account permits changes to containers and reading their environment; it
does not provide isolation from application secrets. Keeping provisioning keys out
of GitHub and application env files out of uploads still reduces unnecessary copies.

The initial Access token expires on **2027-11-01 at 17:34:17 UTC**; verify the
current `deployment_access_expires_at` output before relying on that date. Rotate
before expiry with a reviewed Terraform change: create a replacement token,
temporarily allow both token IDs in the existing Service Auth policy, update both
GitHub secrets, prove SSH and a gated deployment, then revoke/remove the old token.
For compromise, revoke first and accept the deployment interruption. Do not use
an Allow/bypass policy or browser login as a CI workaround.

For SSH-key rotation, temporarily install both restricted public keys on
`fitness-deploy`, update the GitHub private-key secret, test, then remove the old
key. The access installer replaces `authorized_keys`; do not rerun it assuming
it preserves a second key. A changed server host key requires independent
fingerprint verification before updating `SCALEWAY_DEPLOY_KNOWN_HOSTS`.

Rotate the tunnel connector token through Cloudflare, refresh its Terraform data
source, securely replace the VM token file with the same permissions and restart
`fitness-deployment-tunnel`. Verify healthy connector status and SSH. Keep the
token out of process arguments, logs and GitHub. Treat old state backups as secrets
even after rotation; their credentials may remain valid until explicitly revoked.

If CI access fails, inspect `systemctl status fitness-deployment-tunnel` and
`journalctl -u fitness-deployment-tunnel` through restricted direct IPv6 SSH or the
Scaleway console. Check Access token expiry, hostname/host-key pinning and local
sshd before changing network policy. Preserve this independent operator access
while rotating CI credentials. Restoring Terraform state does not restore the
PostgreSQL volume, app env files or Caddy certificates; recover those separately.

## Scaleway-managed secrets and remote state: proposed next step

Scaleway provides suitable managed services for both needs. They are **not used
by this deployment yet**. Review access, recovery and incremental cost before
migrating; do not silently expand the agreed approximately €0.80/month baseline.

**Secret Manager** provides encrypted, versioned secret storage with IAM access
control. Current published pricing is **€0.04 per stored secret version/month**,
**€0.03 per 10,000 accesses**, and **€0.01 per restored version**, excluding tax.
For example, ten retained versions cost €0.40/month before requests. Retaining
old versions increases that total. The source is Scaleway's
[Secret Manager overview](https://www.scaleway.com/en/secret-manager/) and
[security pricing](https://www.scaleway.com/en/pricing/security-and-account/),
checked 2026-11-01. A future setup should grant each consumer only its required
secrets and define how it obtains its initial access credential. Putting a secret
in Secret Manager does not automatically remove its copies from Terraform state,
GitHub or the VM. Prefer managing secret metadata/IAM with Terraform and writing
secret values through a separate authenticated operator path; verify provider
state behavior before handling values in Terraform.

**Object Storage** supports Terraform's S3 backend and native state locking.
Scaleway added the required conditional writes in May 2026; use `use_lockfile=true`.
The provider now recommends this over a PostgreSQL state backend. See the
[Scaleway backend guide](https://registry.terraform.io/providers/scaleway/scaleway/latest/docs/guides/backend_guide)
and [Terraform S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3).
Require Terraform 1.10 or later for S3-native locking. Older guidance claiming
Scaleway S3 cannot lock state is obsolete. Bucket Object Lock retention is a
different feature; do not apply immutable retention to the transient `.tflock`.

Use a dedicated private, versioned Multi-AZ bucket, encryption at rest, narrow
operator IAM and a documented recovery copy. Standard Multi-AZ lists
**€0.000022/GB/hour**, approximately **€0.01606/GB/month** at 730 hours; state is
small, but retained versions, other objects and transfer determine the bill.
Do not budget from historical permanent-free-storage claims or assume a trial
applies. [Current storage pricing](https://www.scaleway.com/en/pricing/storage/)
was checked 2026-11-01. No paid managed database is needed just for state locking.

Before migration, choose the bucket/region, least-privilege identity, encryption,
version retention, backup owner and cost bound. Verify state read/write and
concurrent lock exclusion with disposable data. Freeze Terraform writers, take a
private backup, configure the S3 endpoint and migrate the existing canonical state
with `terraform init -migrate-state`. Use environment credentials, never embed
keys in backend configuration. Verify the same lineage/resources and a no-change
plan, test version recovery, then document the new canonical backend for every
operator. Keep the old local file as a protected recovery copy, not a competing
active state. Provision the backend independently enough that destroying the app
cannot destroy its only state/recovery storage.
