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

## Backup failure and freshness evidence

`backup.sh` requires host Python 3 (standard library only), Docker and curl with
AWS SigV4 support. The Ubuntu production host was checked with Python 3.12.3.
It serializes backup attempts with a host file lock and atomically replaces the
private mode-0600 `/srv/fitness/backup-status.json` receipt. Upload credentials
stay in a temporary private curl config, outside command arguments and logs.

The last-success timestamp advances only after `pg_dump` succeeds and the
checksum-bearing PUT receives HTTP 2xx. Both Content-MD5 and SHA-256 are sent for
the actual dump bytes. This is an acknowledged upload, **not an independent
GET/hash or restore verification**. The write-only key gains no read permission.
Failed attempts retain the previous upload evidence and record only their stage,
failure category and subprocess exit code. Raw command errors and credentials
are not logged. A killed process leaves a running receipt that becomes unfinished.
A concurrent invocation exits nonzero without overwriting the active receipt.

The nightly cron calls the backup directly; it must not pipe through `logger`,
which masks failures. The helper attempts local syslog delivery itself while
preserving its own exit code and durable receipt. Receipt persistence failure
also exits nonzero. No helper can guarantee a durable write on a full/broken disk;
the external monitor must detect unreachable hosts and missing/unfinished state.

Using existing operator SSH as `fitness-deploy` (or root), run:

```sh
python3 /srv/fitness/backup.py check --max-age-seconds 108000
```

The 30-hour example is a **proposed threshold**, not an approved recovery point
objective or an installed monitor. The threshold is mandatory; the unfinished
attempt limit defaults to 600 seconds. The check reads only the receipt, not `.env`
or the bucket, and writes one JSON result to stdout:

| Exit | Meaning |
| --- | --- |
| 0 | Prior upload is fresh; `in_progress` does not mean the current attempt succeeded. |
| 1 | Latest attempt failed, or a running attempt exceeded its time limit. |
| 2 | No acknowledged upload or last upload older than the supplied limit. |
| 3 | Missing, malformed or future-dated receipt. |

The existing Fitness watchdog → EM → Martin route is the selected delivery path.
Do not add a service, app endpoint, sign-in email use, credential grant or second
backup schedule. The monitor needs existing operator SSH access to this private
file; it must treat SSH timeout, unreachable host, malformed/non-JSON output and
unexpected exit codes as unknown/failure, never healthy. Keep diagnostics to this
sanitized check output. App containers receive neither this receipt nor backup
configuration. A missing receipt before rollout is an evidence gap, not proof a
scheduled backup was missed.

**Nightly execution is separate from overall backup freshness.** Release uploads
can keep `last_success_at` fresh indefinitely. Monitor `last_daily_success_at`
independently against the agreed daily schedule and explicit grace. The first
expected nightly run is **2026-11-02 03:17 UTC / 04:17 Europe/Paris**, not before;
thereafter 03:17 UTC daily. The owner/EM must choose the grace and freshness
threshold. A release upload never closes nightly execution acceptance. Watchdog
integration and end-to-end failure/stale/unreachable notification delivery are
**not installed or proven by this patch**. They require an explicit integration
update and synthetic routing proof before closing alert acceptance. Continue
independent exact-object restore checks using the existing operator credentials.

Run `python3 deploy/scaleway/test-backup.py -v` locally (also in `bun run gate`).
It uses synthetic data in a disposable network-isolated PostgreSQL 17 container
and a loopback TLS endpoint/proxy, with real `pg_dump`, curl and `pg_restore`.
No production secrets, data, bucket requests or remote writes are involved.

## Draft storage protection decisions

As inspected on 2026-11-01: the existing bucket has 30-day expiry, versioning off,
no bucket SSE configuration, and a project-wide `ObjectStorageObjectsWrite`
writer policy. The payload is a raw PostgreSQL dump over HTTPS; this says nothing
about physical disk encryption. Read/list denial does not make a writer
append-only: it can overwrite a known object key. These options are preparation
only; none changes the bucket, keys, retention or existing objects.

| Decision | Benefit and remaining work |
| --- | --- |
| Bucket-default SSE-ONE | Provider-managed AES-256 for **new uploads**. Existing objects are unaffected. No customer key recovery workflow, but account/operator recovery still matters. Verify a newly uploaded object's encryption metadata and a restore before acceptance. [Provider guide](https://www.scaleway.com/en/docs/object-storage/how-to/enable-sse-one/). |
| Client-side encryption and recoverable custody | Existing encrypted laptop copy uses the existing FITNESS1/AES-256-GCM format. Agree an independent protected recovery-key copy, custodian and recovery test; prove decryption/restore from that recovery copy, plus wrong-key/tamper rejection. A key stored beside the VM uploader does not protect against VM compromise. Changing the production upload format or adopting public-key encryption requires a separately reviewed implementation. Historical raw objects need a separately authorized download/encrypt/new-object/restore plan; do not overwrite or delete originals here. |
| Constrain writer | Review explicit bucket/prefix/principal PutObject policy while preserving operator recovery access; enforce create-only conditional writes with bucket policy if chosen. `If-None-Match: *` in a client alone cannot constrain a compromised writer. A policy on this bucket does not remove project-wide write access to other buckets: verify supported IAM resource scoping or separately decide project isolation. Never widen access as a shortcut. [Conditional writes](https://www.scaleway.com/en/docs/object-storage/api-cli/using-conditional-writes/), [bucket policies](https://www.scaleway.com/en/docs/object-storage/api-cli/bucket-policy/). |
| Versioning plus bounded noncurrent retention | Keeps prior versions after overwrite; previous versions remain billable. Explicitly decide noncurrent expiry as well as current 30-day expiry. Existing null-version objects are retained; enabling versioning cannot be undone to an unversioned state, only suspended. This does not repair an overwrite that predates enablement. [Versioning](https://www.scaleway.com/en/docs/object-storage/how-to/use-bucket-versioning/). |
| Object Lock | Stronger retention requires versioning and an irreversible bucket-level choice; compliance retention cannot be shortened during its term. Decide retention, bypass authority and storage budget separately. No activation in this patch. [Object Lock](https://www.scaleway.com/en/docs/object-storage/how-to/use-object-lock/). |

Published prices checked 2026-11-01 are €0.01606/GB/month Standard Multi-AZ,
€0.00803/GB/month Standard One Zone, requests/ingress included, and 75 GB egress
free monthly then €0.01/GB, before tax. The public page defaults to Paris: confirm
the existing Warsaw bucket's actual storage class, region price and billing
rounding before treating this as its quote. Each additional 100 GB of retained
versions would be approximately €1.606/month at that Multi-AZ rate; version count
and retention determine growth. No separate SSE-ONE surcharge was identified on
that page, which is **not a confirmed zero-cost quote**. Key custody can use the
existing private tooling; no new paid key service is proposed. These are storage
rates, not an assertion of the actual bill. [Current pricing and billing-unit
notice](https://www.scaleway.com/en/pricing/storage/).

Owner decisions remain: acceptable freshness/grace; provider-managed versus
client-side confidentiality and key custody; writer containment; version/noncurrent
retention and any irreversible lock; approved budget. Martin owns any subsequent
production application and verification. No rotation, object rewrite, access
expansion or new schedule is authorized by this draft.

## Prepared same-bucket create-only policy

The uploader now keeps the logical `daily/<date>` or `release/<sha>` prefix and
adds a UTC timestamp plus random suffix before `.dump`. Every invocation chooses
one unique key and sends exactly `If-None-Match: *`; HTTP 412 is a failed attempt,
not success or permission to overwrite. The receipt records the exact uploaded
key. Old receipts/objects remain readable; the existing key validator accepts
both formats. Restore from the receipt's `last_success_object`, verify the
independently downloaded hash and restore; do not reconstruct `release/<sha>.dump`
or select the newest arbitrary object. Clock order alone is not recovery proof.

`scaleway_object_bucket_policy.backups` uses the existing provider and bucket,
with explicit project scope. `backup-policy.json.tftpl` is the authoritative
policy. The mandatory `backup_operator_principals` set accepts explicit existing
`user_id:<UUID>` / `application_id:<UUID>` principals only. The existing
Organization Owner/recovery user must be included in the private canonical
inputs after independent identity verification. No wildcard or project principal
is accepted; a lifecycle precondition forbids the backup writer in this set.
The operator statement preserves existing S3 permissions through the intersection
with existing IAM; it creates no IAM grant. The writer statement allows only
PutObject under this bucket's `daily/*` and `release/*` prefixes, with both header
presence and **StringEquals `*`**, not wildcard StringLike matching. No multipart
exception, broad writer allowance or AWS Deny policy is added.

Provider evidence: [2023 policy semantics and owner recovery](https://www.scaleway.com/en/docs/object-storage/api-cli/bucket-policy/),
[conditional-write key/enforcement](https://www.scaleway.com/en/docs/object-storage/api-cli/using-conditional-writes/),
and the [pinned Terraform policy resource](https://github.com/scaleway/terraform-provider-scaleway/blob/v2.89.0/docs/resources/object_bucket_policy.md).
Scaleway documents header-presence enforcement and StringEquals separately;
the exact combination is a **candidate pending live synthetic verification**.
Terraform compilation/schema checks and local HTTP tests do not prove provider
condition evaluation, effective permissions or lockout prevention. Client headers
alone do not contain a compromised writer. The existing project-wide writer IAM
rule remains unchanged: this protects only the named bucket, not other project
buckets. [Object Storage has no documented IAM resource-level condition support](https://www.scaleway.com/en/docs/iam/policies-permissions/supported-products-resource-level/).
Do not inspect/change other buckets or invent an IAM bucket condition.

Martin's controlled rollout and rollback contract (not executed by preparation):

1. Privately preserve current bucket policy or confirmed absence, canonical
   Terraform state/inputs, and bucket lifecycle/versioning/encryption settings.
   Independently verify existing operator identity and Organization Owner
   break-glass authority. An unexpected existing policy stops this plan; review
   and preserve it before any replacement. Never print state, API keys or inputs.
2. Deploy the compatible unique-key uploader first. Verify a new upload and exact
   receipt/hash using existing operator access. Update canonical inputs with the
   verified existing recovery principals. Plan against the canonical local state;
   accept only the intended same-bucket policy addition. Stop on IAM, bucket/VM
   replacement, lifecycle, encryption, versioning or Object Lock changes. No
   Terraform apply or production upload is part of local preparation.
3. Apply only the reviewed saved plan through the existing operator. Use a unique
   **synthetic `.txt` probe** under `daily/` for live acceptance, never an existing
   backup. Probes must not enter receipt-based backup/restore selection. Prove new
   conditional PUT succeeds; replacement with `*`, missing/empty/non-star header,
   quoted alternate ETag, and duplicate headers in both orders cannot replace
   the original bytes. Re-download and compare the original hash after each
   negative check. Verify out-of-prefix writes fail and operator HEAD confirms
   no object was created; writer GET/list/delete/ACL changes remain denied.
   Verify operator list, GET/hash and bucket-policy recovery/control access.
   Unsupported conditions or any unexpected success stops acceptance.
4. On failure, the existing Organization Owner restores the exact privately
   saved prior policy. **Delete only the bucket policy if it was originally
   absent**; never delete a bucket, object or IAM grant as rollback. Scaleway
   documents that this Owner can put/delete policies even when data access is
   restricted. Keep the compatible uploader; rolling back to the old stable-key
   uploader while policy is enforced breaks uploads. Hold subsequent Terraform
   apply until configuration/state are deliberately reconciled; do not run a
   broad Terraform destroy or blindly reapply a failed policy.

The existing 30-day lifecycle, versioning OFF, Object Lock OFF and SSE configuration
are unchanged. Historical dumps are neither rewritten nor deleted. Account/key
recovery still needs an independently accessible encrypted state/input bundle and
separately protected recovery material. The owner destination/custodian question
is tracked once by EM; it does not block this policy preparation. No sensitive
bundle is transferred or new service introduced here.

Pricing check on 2026-11-01: the [public catalog filtered to Warsaw Object Storage](https://api.scaleway.com/product-catalog/v2alpha1/public-catalog/products?product_types=object_storage&region=pl-waw&page_size=100)
reports current Standard Multi-AZ SKU `usage-new-gen-bucket-standard/pl-waw` at
€0.000022 per GB (hourly rate on the pricing page), about €0.01606/GB/month, and
also a retired legacy Standard SKU at half that rate. `STANDARD` alone does not
identify the account's billed generation. No separate SSE item appears in these
catalog rows; absence is **not proof of a zero SSE surcharge**. Actual billed SKU,
SSE pricing, rounding/minima and account terms must be confirmed before recommending
new-object SSE. The existing operator's narrow November ObjectStorage consumption
query for the Fitness project returned no posted lines; that proves no zero-cost
claim and does not identify its billed SKU. No SSE, paid key service, rotation or historical rewrite is
implemented by this patch. [Pricing and billing-unit notice](https://www.scaleway.com/en/pricing/storage/).

The backup test suite uses the existing Terraform tool in a pinned Docker image,
with network disabled and synthetic inputs, to compile the actual policy template
and reject unsafe principal inputs through a real Terraform plan. Real curl/TLS
and PostgreSQL tests verify unique keys, the exact header, checksum/restore and
HTTP-precondition failure handling. These are isolated preparation tests, not
live Scaleway authorization proof.
