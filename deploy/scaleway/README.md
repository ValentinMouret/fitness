# Scaleway deployment

Terraform provisions one STARDUST1-S in Warsaw (`pl-waw-2`), with PostgreSQL,
Fitness and Caddy on the same host. IPv6-only is the default; Cloudflare's proxied
AAAA record serves both IPv4 and IPv6 visitors. This replaces the OVH deployment
only after data recovery, app verification and DNS cutover. No cloud resources
have been provisioned merely by adding these files.

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

IPv6 must work from your SSH client and from the VM to package repositories,
container registries and Anthropic. If it does not, enable `allocate_ipv4` and
accept its documented extra cost. Host networking lets the app reach IPv6;
PostgreSQL and the app bind only to 127.0.0.1. Only Caddy is public.
This is a single-host deployment with downtime during app replacement, no HA,
and no automatic rollback after migrations. Local pre-migration dumps are not
an off-host backup. Routine backup storage and review apps are not included.

## Provision

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
   then `terraform apply deployment.tfplan`. The default resources are one VM,
   one free IPv6 allocation, a security group and a project SSH key. No DNS is changed.
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

## Configure and deploy

Create `/srv/fitness/app.env`, `database.env`, and `runtime.env` from the examples,
owned by root with mode 0600. Use a random hex PostgreSQL password (also in
`DATABASE_URL`) so URI encoding is unambiguous. These files use literal values,
without surrounding shell quotes. The raw env-file format preserves `$` in secrets.
Preserve the production session secret, login, Anthropic key, OAuth clients and
issuer during recovery. Configure the MCP reader URL if the existing integration
uses it. Keep `PREVIEW_APP` unset. `runtime.env` contains only the public hostname
and image tag.

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

The release locks concurrent deploys, starts PostgreSQL, saves a local dump,
runs migrations and optional MCP reader provisioning, waits for app health, then
starts Caddy. Build/migration failure prevents app replacement. Boot failure can
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
