# Configure Fitness authentication

Fitness uses one owner login. Browser sessions use a signed, expiring HttpOnly cookie. Remote Model Context Protocol (MCP) clients use OAuth authorization code exchange with PKCE and one `fitness` scope for reads and writes. The MCP endpoint exposes workout tools and generic SQL reads over documented views. See [MCP tools and reader setup](mcp.md).

## Local magic-link foundation (ENSO-89)

The approved next authentication model is invitation-only email magic links with
Better Auth 1.7.6 and its native PostgreSQL adapter. Drizzle remains unchanged.
This first stage is a local development foundation: the existing owner login,
private app pages, OAuth and MCP authorization remain on their current boundary.
Native sessions do not authorize access to those surfaces. Production admission
stays closed until all enabled data, browser and agent paths have tested tenant
isolation and the owner's historical data migration has been reviewed.

Migration 0012 adds only auth users, sessions, accounts, verification records and
invitations. It does not assign ownership or change fitness records/catalogues.
The nullable account password field is part of Better Auth's core storage;
password authentication, password signup and SSO are disabled.

To exercise the foundation, create an explicitly named loopback test/dev database
and configure the existing test server credentials together with:

```sh
AUTH_FOUNDATION_ENABLED=true
AUTH_FOUNDATION_ORIGIN=http://127.0.0.1:5196
AUTH_FOUNDATION_OWNER_USER_ID=720cbf7c-67b5-4d6b-b026-c8e1099ff435
AUTH_LOCAL_DATABASE_URL=postgresql://localhost/fitness_magic_link_test
AUTH_LOCAL_INBOX=/tmp/fitness-auth-foundation/inbox.jsonl
```

Use the same database for `DATABASE_URL` and the test fixture connection. Run
`bun run auth:seed-local` to migrate and seed `owner@example.invalid`,
`first@example.invalid` and `second@example.invalid`. The command refuses
non-loopback databases and names without a `_test` or `_dev` suffix. It creates
no session cookies and does not mark email addresses verified. Request a link
through `/sign-in`, open the newest matching URL from the private local inbox,
then use **Manage invitations** as the owner. The inbox is outside public assets
and is written with mode 0600. Do not publish its contents.

`/sign-in`, `/account/invitations` and `/api/auth/*` return 404 by default.
Production configuration is now supported but activation remains held. With
`NODE_ENV=production` and `AUTH_FOUNDATION_ENABLED=true`, startup requires a
canonical HTTPS `AUTH_FOUNDATION_ORIGIN`, the approved durable owner UUID and
complete `AUTH_SMTP_HOST`, `AUTH_SMTP_PORT`, `AUTH_SMTP_SECURE`, `AUTH_SMTP_USER`,
`AUTH_SMTP_PASSWORD` and `AUTH_SMTP_FROM`. The sender is a plain verified email
address. `AUTH_SMTP_SECURE=true` uses implicit TLS; `false` requires STARTTLS and
refuses cleartext fallback. Certificates are verified with TLS 1.2 or newer.
Production forbids `AUTH_LOCAL_INBOX`; development/test require the loopback
inbox and reject mixed SMTP settings. SMTP debug logging is disabled and errors
are generic. Keep credentials in deployment secrets, never PRs or logs.
Configuration acceptance does not prove provider delivery or approve activation.
The owner bootstrap uses an explicit stable ID and rejects conflicting email/ID
assignments. Only that authenticated owner can list, create or revoke invitations.
If email delivery fails after creation, the invitation remains visible with an
inline error. **Resend email** retries delivery for an active, unaccepted
invitation. It does not renew expired invitations or reactivate revoked accounts.
Invitation expiry defaults to seven days (`AUTH_INVITATION_TTL_SECONDS`); accepted
accounts can request fresh sign-in links. Revocation removes existing sessions
and rejects outstanding links. Unknown addresses get the same response without
an email or an account. Magic links expire in five minutes, are stored as hashes,
and are single-use. Native session readers must use `getAdmittedSession`, which
rechecks admission; a raw library session is not sufficient authorization.

Better Auth's verification IDs use text because its concurrency reservations use
deterministic non-UUID primary keys. Ordinary user/session/account IDs remain
UUIDs. The adapter's custom UUID generator preserves supplied reservation IDs.
Origin and CSRF protection are explicitly enabled, including in test mode.

The standard server and Docker entry use a Morgan preload that logs request paths
without query strings. Better Auth's verbose library logger is disabled, so
rejected callback URLs cannot leak tokens into error logs. Status/path logging
remains available. The SMTP transport is exercised over real loopback SMTP;
production selects the SMTP adapter with mandatory TLS. Real provider delivery,
verified sender DNS and owner access recovery remain cutover gates.

Run `bun run test:auth:integration` with `AUTH_TEST_ADMIN_URL` pointing explicitly
to a disposable PostgreSQL admin connection. Its native-auth test creates and
drops its own uniquely named database. The SMTP test needs no database.
`tests/e2e/auth-foundation.spec.ts` verifies the built React Router flow against
the matching dedicated server and inbox. Set `E2E_SERVER_LOG` to that server's
log file to verify successful, rejected and replayed callbacks contain no tokens.
CI supplies these settings and exercises the owner invite flow, two independent
sessions, revocation, origin rejection, and denied private-app/OAuth/MCP access.

Before any production cutover: bind browser/OAuth/MCP execution to trusted user
identity; scope every enabled private read/write/aggregate and parent-child link;
rehearse and reconcile owner-history backfill; verify real reader-role two-user
negative tests; and configure production email delivery and recovery. Existing
public meal links remain an explicit read-only exception. Catalogue publication,
aliases and private fallback decisions are outside this foundation.

Session-protected pages and API routes inherit server authentication middleware from `ProtectedLayout`. See [ADR 0001](../adr/0001-server-auth-middleware.md) for route placement, client navigation, and the separate OAuth/MCP boundaries.

## Configure browser login

Set `AUTH_USERNAME`, `AUTH_PASSWORD`, and `AUTH_SESSION_SECRET` in the server environment or the ignored `.env`. Generate the session secret with `openssl rand -hex 32`. Keep it stable across restarts. Replacing it invalidates existing browser sessions. The default session lifetime is seven days; the server checks the signed expiry even if an expired cookie is sent manually.

The migration from unsigned cookies requires signing in again. Use HTTPS in production; production sessions always set Secure. The reverse proxy must preserve the public Host header. Production origin checks expect HTTPS for that host, even when TLS terminates at Caddy and the internal request uses HTTP. OAuth redirects use the configured public issuer.

The existing local server uses Vite's `PORT` setting (for example, `5175`). Do not start a second server in an agent session. Vite and the server launcher own `PORT`; Playwright owns `TEST_PORT`, validated in `tests/e2e/support/auth.ts`. Neither belongs to the application environment schema. Set test-only options on the test command. Restart the existing server after changing `.env`. Use `NODE_ENV=development` for local HTTP.

## Enable OAuth

1. Apply migrations with `bun run db:migrate` before enabling OAuth. Migration `0005_wise_bromley.sql` adds only the three OAuth tables. Drizzle applies migrations transactionally.
2. Set `OAUTH_ISSUER_URL` to the public HTTPS origin, with no path or trailing slash. Local development also accepts HTTP loopback origins, such as `http://localhost:5175`.
3. Set `OAUTH_CLIENTS` to a JSON array. Each entry has `name`, `id`, `secret`, and `redirectUri`. Create one entry for ChatGPT and one for Claude, using distinct IDs and randomly generated secrets. Copy each exact callback URL from that client's configuration. Callback comparison includes the scheme, host, port, path, and query.
4. Add the issuer's `/mcp` URL to each client. Choose a predefined OAuth client and enter its ID and secret. Both `client_secret_basic` and `client_secret_post` are accepted. Sign into Fitness and approve access.

Leave `OAUTH_ISSUER_URL` unset and `OAUTH_CLIENTS=[]` to disable MCP and its OAuth endpoints. No dynamic registration endpoint is provided.

The server publishes discovery at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`. It advertises issuer identification and includes `iss` in authorization responses. ChatGPT can therefore use its stable callback; use the exact callback shown by the client rather than guessing it. See the [OpenAI authentication guide](https://developers.openai.com/plugins/build/auth) and [Claude custom connector setup](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

## Revoke access

POST a token to `/oauth/revoke`, authenticating with the client ID and secret. Use form fields `token` and, optionally, `token_type_hint=refresh_token`. Revocation is idempotent and revokes the entire connection, including access tokens and previously rotated refresh tokens. Each MCP request checks connection status in PostgreSQL.

There is no Connected apps page. An operator can also revoke a connection by setting its `oauth_connections.revoked_at` to the current time. Removing a configured client disables its existing tokens. Reconnecting creates a new connection and cannot revive a revoked one.

Authorization codes and access/refresh tokens are random and persisted only as SHA-256 hashes. Rotation retains spent refresh-token hashes to detect replay and revoke the whole connection. Connection locking serializes code exchange, refresh, and revocation. A failed database write rolls back token consumption. Do not delete spent refresh-token records while their connection remains usable.

## Verify locally

Run the server against a local test database. The auth test commands never start another server. Set `E2E_BASE_URL=http://localhost:5175` if Vite listens on localhost rather than 127.0.0.1. Set `E2E_AUTH_USERNAME` and `E2E_AUTH_PASSWORD` to match the server.

Use the standard checks in the [project README](../../README.md), plus these
auth-specific suites against the configured test environment:

```sh
bun run test:auth:integration
bun run test:e2e:auth browser-session protected-routes mutation-boundary oauth.spec.ts
```

See [testing](../engineering/testing.md) for environment isolation and the
difference between local and CI server setup.

CI runs the ordinary auth contract and storage check alongside product E2E tests. HTTPS and short-lifetime browser profiles remain explicit.

The integration suite uses `DATABASE_URL` from `.env`, creates uniquely identified OAuth connections, and deletes only its own records. It checks persisted expiry and rollback after injected token-write failures.

OAuth browser tests use the two fixture clients documented in [the auth acceptance guide](../../tests/e2e/auth/README.md). Configure those fixtures only on the test server. The guide also describes storage inspection and short-lifetime expiry profiles. Do not run all expiry profiles together with ordinary lifetime settings.

Server lifetime controls, in seconds:

| Setting | Default |
| --- | ---: |
| `AUTH_SESSION_TTL_SECONDS` | 604800 |
| `OAUTH_CODE_TTL_SECONDS` | 300 |
| `OAUTH_ACCESS_TTL_SECONDS` | 900 |
| `OAUTH_REFRESH_TTL_SECONDS` | 2592000 |

Local fixtures verify the protocol, not actual ChatGPT/Claude connections. Complete linking from both real clients after configuring a publicly reachable HTTPS deployment. The browser suite's Secure-cookie test also requires HTTPS.

## Habit ownership stage (production hold)

Migration `0013_habit_ownership.sql` assigns all existing habit definitions, including
inactive and deleted history, to exactly one explicitly bootstrapped owner.
Completions inherit ownership through their parent habit. A nonempty database
without that owner, or with ambiguous self-invitations, fails transactionally.
No owner identity is invented by the migration. Empty databases need no backfill.

Before releasing this stage against existing data, independently review the
owner's stable UUID and email, bootstrap that identity through the reviewed
operator procedure, configure `AUTH_FOUNDATION_OWNER_USER_ID`, and reconcile
historical counts and relationships. That production bootstrap and migration
are not authorized by local test success. Until the prerequisite is met, do not
deploy this stage: private routes require the configured, self-invited, accepted
and nonrevoked owner record and fail with HTTP 503 when it is missing.

The signed legacy browser session and validated legacy OAuth bearer still admit
only the original owner. Native magic-link accounts remain excluded from private
browser/OAuth/MCP entry points. Habit operations, dashboard habit data and AI
habit references now receive explicit trusted identity. Other private subsystems
remain unconverted; onboarding cannot be activated yet.

The MCP query runner sets `fitness.user_id` only inside each read-only transaction
and rolls it back before returning the pooled connection. Habit views filter on
that identity; missing identity returns no habit rows. SQL submitted by clients
cannot call `set_config` or `current_setting`. Other exposed views still require
conversion before additional accounts can access MCP.

Run `bun run test:tenant:integration` with `TENANT_TEST_ADMIN_URL` explicitly
pointing to a loopback disposable PostgreSQL admin database. The suite creates
and drops its own database, proves missing/ambiguous-owner rollback, preserves
active/inactive/deleted owner history and rejects cross-account habit writes.
`bun run test:mcp:integration` proves real restricted-role habit view isolation
and pooled identity cleanup. CI seeds synthetic owner/invited accounts only
inside its isolated PostgreSQL service before browser tests.

After additional accounts write private data, rollback must retain ownership
and scoped operations; restoring the former global application is not a safe
recovery procedure. Production admission remains disabled in this stage.

### Measurement, target and daily note ownership (production hold)

Migration `0014_measurement_ownership.sql` extends the same explicit owner
backfill prerequisite to measurement definitions, dated measurements, all
active/deleted target history and the existing daily note. It preserves names,
IDs, timestamps and values. Definitions are unique by user/name; dated measures
by user/name/time; the singleton note by user/ID; active targets by user/name.
Composite foreign keys prevent a dated value or target from referencing another
account's definition.

Browser services, dashboard aggregates, calorie target persistence and SQL
progress views receive the trusted actor. Target replacement locks the owned
measurement and runs in one transaction; a conflicting foreign target ID rolls
back without deleting the caller's previous target. Native admission remains
closed and unconverted private paths still prevent onboarding. The production
bootstrap/backfill/compatibility hold from the habit stage also applies here.

`bun run db:seed` now requires a configured and explicitly bootstrapped owner.
It adds only the neutral weight/calorie definitions to that owner's account and
never copies private values or creates a calorie prescription. CI bootstraps
synthetic users in its isolated test service before seeding those definitions.
A new account's first-action/empty-state setup remains part of the later
onboarding stage.

The tenant suite also checks measurement/target/note history preservation,
same-name/same-timestamp isolation, composite foreign keys, independent notes,
concurrent target replacement and forged-ID rollback. MCP tests use the real
restricted role for parallel A/B progress aggregates and missing-identity reads.

### OAuth ownership stage (draft release hold)

Migration 0015 assigns every existing OAuth connection, including revoked
connections, to the uniquely accepted bootstrap owner. It preserves connection
IDs, hashed codes/tokens, expiry, replay and revocation history. Like migrations
0013–0014, it must remain held until the owner bootstrap/backfill and legacy
compatibility rollout have been reviewed and rehearsed.

Consent passes the trusted legacy owner to authorization-code issuance. New
connections require an accepted, non-revoked invitation; code exchange and
refresh serialize with invitation revocation. Access lookup returns the account
identity joined through the persisted connection and rejects revoked admission.
MCP checks this identity against the legacy owner before registering any tools,
then passes the connection's account identity to the SQL runner. Other accounts
remain denied while private workout/nutrition paths are still global. Native
sessions still cannot consent or enter the private app; this stage does not
activate onboarding.

### Workout ownership stage (draft release hold)

Migration 0016 assigns all workout and retained template roots, including
archived/imported history, to the uniquely accepted bootstrap owner. Children
inherit ownership through their existing parent IDs. Composite foreign keys
bind workout/template source associations to one account and sets to their
actual workout/template exercise membership. Existing IDs, order, notes,
weights, reps, RPE and reported RIR remain intact.

Before deployment, the required rehearsal must check orphan workout sets,
template sets and source-workout links. The migration fails on incompatible
history; it does not delete, reassign or fabricate parent records. Owner
bootstrap/backfill and legacy browser/MCP compatibility remain release holds.

Workouts, sessions, history, duplication, dashboard readers and weekly/historical
volume use explicit account factories. Mutations lock the owned parent before
changing children. MCP workout views filter trusted transaction-local identity;
set/group/volume descendants inherit that filter. The legacy-owner MCP gate
remains until every private tool is isolated.

The owner deferred private provisional exercise creation. This stage scopes
private workout records without publishing or copying personal exercise
catalogues/cues or choosing general-user creation policy. Existing owner
creation/history is retained; catalogue/onboarding parity needs concrete review
before admitting new accounts.

### Nutrition ownership stage (draft release hold)

Migration 0017 assigns ingredients, meal templates, compositions and meal logs,
including archived/AI-generated history, to exactly one explicitly accepted
bootstrap owner. It preserves IDs, quantities, assignments, notes, usage,
completion dates and existing public share flags/URLs. Ingredient name and
meal-category/date uniqueness become account-specific. Composite foreign keys
bind each composition and consumed template to its account; incompatible
historical associations fail the migration rather than rewriting data.

Nutrition factories, dashboard summaries, meal estimation ingredient context,
AI ingredient resolution and MCP commands receive explicit trusted identity.
Child mutations lock their owned parent. Restricted nutrition views require
transaction-local identity, including for published recipes: the MCP reader
never treats public sharing as permission to query another account's records.

The existing `/share/meal/:id` route is the sole anonymous nutrition exception.
It reads a published, active template and its owned composition in one query;
private/archived templates return 404. Only the owner can change sharing.

Owner bootstrap/backfill rehearsal, legacy browser/MCP compatibility, proxy
logging and client-IP review remain preactivation requirements. Native private
app/OAuth admission and the legacy-owner MCP safeguard remain closed. This
stage does not add private exercise creation or decide catalogue publishing.

### Equipment and retained preference ownership (draft release hold)

Migration 0018 assigns gym floors/equipment, equipment preferences, retained
training preferences and retired generation conversations to the unique accepted
bootstrap owner. Existing IDs, archive timestamps, preference keys/content,
conversation messages/context JSON, token counts and workout links remain
intact. Composite foreign keys bind equipment to its account's floor and retained
conversations to its account's workout. Existing owner data is not used as another
account's defaults; missing/ambiguous bootstrap or incompatible parent links fail
closed. No retired generation feature is reintroduced.

The live substitution workflow loads equipment through a required account
factory and rejects foreign equipment IDs. Equipment availability updates and
stored preference reads also require an actor. These private tables are not
exposed through MCP reader views. Exercise substitution/catalogue definitions
remain a separate shared-catalogue boundary; personal descriptions/cues still
require separation and reviewed canonical publication/correction. Owner-only
MCP and native-app admission safeguards remain in force.

## Integrated ownership release review

The held stack must be evaluated as one release. Passing a stage does not permit
native admission or removal of the legacy-owner MCP gate.

| Order | Migration | Preserved ownership scope |
| --- | --- | --- |
| 1 | 0013 / draft233 | Habits and completions through owned parents |
| 2 | 0014 / draft234 | Measurement definitions, values, targets and daily note |
| 3 | 0015 / draft235 | Existing OAuth connections; token/code hashes and expiry/replay state retained |
| 4 | 0016 / draft236 | Workouts/templates, exercise membership, sets, order and history |
| 5 | 0017 / draft237 | Ingredients, recipes, consumed meals, compositions and public-link flags |
| 6 | 0018 / equipment draft | Gym/equipment, stored preferences and retired conversation content |

### Gate 1: approve the real owner and migration procedure

- Record the real owner's stable UUID and normalized invited email explicitly;
  the synthetic local owner UUID/email are not production choices.
- Confirm the production source/migration journal and take a recoverable database
  backup. Foundation migration0012 must already be present. Keep native admission
  disabled, preserve the legacy session secret and pause writes during assignment.
- Review the operator invocation of `bootstrapAuthOwner` before using it against
  production. It takes an explicit pool, UUID, email and timestamp and refuses an
  ID/email conflict. There is currently no approved production bootstrap CLI;
  `auth:seed-local` intentionally refuses production and must not be bypassed.
- Verify exactly one self-invited, accepted, nonrevoked owner identity, and set
  `AUTH_FOUNDATION_OWNER_USER_ID` to that same UUID. Review duplicates/conflicts
  rather than treating the oldest account or test fixture as the owner.
- Check orphan workout-set exercise membership, template-set exercise membership
  and source-workout links before0016. Check all retained composition, gym-floor
  and conversation-workout links, including deleted history. Do not repair by
  deleting records or silently changing their parent.
- Rehearse0013–0018 together on an isolated restored copy: reconcile counts,
  primary IDs, all retained fields/JSON, associations and OAuth credential state.
  Record duration and recovery evidence. The committed mixed synthetic dataset
  rehearsal checks all six migrations together, including transactional refusal
  without bootstrap; it does not replace a rehearsal of actual owner history.

### Gate 2: prove compatibility before merging the held stack

- Use the full stacked head, not individual draft CI skips, for required CI and
  local `gate:e2e`, auth, ownership, nutrition and restricted-reader suites.
- Prove legacy owner browser reads/writes and existing OAuth connection/token
  refresh/revocation against the rehearsed dataset with native admission closed.
  Exercise a real external owner MCP client; SDK/HTTP fixtures alone do not prove
  its stored connection compatibility. Check SQL pooled identity cleanup.
- Review all draft diffs and deployment ordering with release coordination.
  Apply only after the owner-bootstrap/history/compatibility evidence is accepted;
  then independently verify source, health, counts and legacy access in production.
- Before another account writes, recovery may restore the coordinated backup and
  source. After another account has data, retain scoped code/schema and ownership;
  do not restore global reads or the original single-owner assignment over it.

### Gate 3: keep onboarding closed until the remaining boundaries pass

- Separate private exercise labels/descriptions/cues from shared canonical data.
  Review what may be published and who may correct/create shared definitions.
  Private missing-exercise creation remains deferred; demonstrate the proposed
  support path and its logging-parity consequence rather than claiming parity.
- Review empty-account measurement/target behavior and default target labeling;
  existing owner defaults must not become a new user's personalized prescription.
  Add and test account timezones wherever server/calendar boundaries require them.
- Bind native browser, consent and MCP admission to actual accepted account
  identity only after every enabled private/catalogue capability is scoped.
  Run real A/B loader/action/history/aggregate/AI/public-share negatives through
  those native sessions before removing the owner-only safeguards.
- Review production email delivery, fresh-link recovery and invitation revocation,
  proxy query stripping and trusted client-IP/rate-limit evidence. Martin's replica
  tests do not authorize the still-pending live shared Traefik change.
- Admit the first invitation-only cohort only after independent full release and
  parity acceptance. No retired generation UI, public signup or private exercise
  fallback is included by the ownership migrations.

### Isolated restored-history rehearsal command

`scripts/rehearse-ownership.ts` is an operator rehearsal for a restored local
copy, not a production bootstrap command. It refuses remote hosts and database
names outside `fitness_ownership_rehearsal_test_*` or disposable
`fitness_tenant_test_*`. Its source must have the exact reviewed migration
journal through0012; a partially migrated or differently versioned copy stops
for review. The owner UUID/email must be explicitly supplied and reviewed;
conflicting or ambiguous identities stop the command.

The September29 archive and live database use the historical
`workouts_template_id_fkey` name. Migration0016 accepts that name or the
schema-generated `workouts_template_id_workout_templates_id_fk` only after
verifying exactly one FK from `workouts.template_id` to `workout_templates.id`.
Unexpected, duplicate or wrong-target constraints fail for review. The final
unmodified migration must pass a fresh archive rehearsal; an in-memory
diagnostic constraint-name replacement is not acceptance evidence. That archive
predates current owner history and cannot serve as a current rollback point.

Use PostgreSQL tools matching the backup/server major version. Restore the
controlled owner-history dump into a fresh isolated database. Set `PGHOST`,
`PGPORT`, `PGUSER` and any password through the operator's local environment;
never use the production endpoint for these commands:

```sh
createdb fitness_ownership_rehearsal_test_copy
pg_restore --no-owner --exit-on-error \
  --dbname=fitness_ownership_rehearsal_test_copy "$OWNER_HISTORY_DUMP"
export OWNERSHIP_REHEARSAL_DATABASE_URL='postgresql://127.0.0.1:5432/fitness_ownership_rehearsal_test_copy'
export OWNERSHIP_REHEARSAL_OWNER_ID="$REVIEWED_OWNER_UUID"
export OWNERSHIP_REHEARSAL_OWNER_EMAIL="$REVIEWED_OWNER_EMAIL"
export OWNERSHIP_REHEARSAL_ARTIFACT_DIR="$PRIVATE_REHEARSAL_DIRECTORY"
bun scripts/rehearse-ownership.ts
```

The default invocation only reads the copy. It checks owner conflicts and
orphan workout/template set membership, source-workout, composition,
consumed-template, gym-floor and retired conversation links, including archived
history. Review the count/fingerprint report before the explicit apply step:

```sh
bun scripts/rehearse-ownership.ts --apply
```

Apply saves a custom-format backup **before** owner bootstrap in a new private
artifact directory. It invokes `bootstrapAuthOwner` with the supplied UUID/email,
checks exactly one accepted self-bootstrap identity, applies0013–0018, compares
counts and ordered full-row fingerprints for all25 covered tables (excluding
only the added `user_id`) and checks every owned row has the supplied owner.
The JSON report records the backup location and elapsed bootstrap/migration/
reconciliation time. Fingerprints detect accidental changes; retain the backup
and independently inspect history and relationships before release acceptance.
Keep writes stopped throughout the source snapshot and rehearsal. The script
does not repair orphans, admit accounts or roll back a live application.

Recovery proof uses a **second fresh isolated database**, preserving the failed
copy and artifacts for diagnosis:

```sh
createdb fitness_ownership_rehearsal_test_recovery
pg_restore --no-owner --exit-on-error \
  --dbname=fitness_ownership_rehearsal_test_recovery "$REHEARSAL_BEFORE_DUMP"
```

Verify the original journal through0012, historical counts/IDs/fields, OAuth
hashes/expiry/replay state, and pre-bootstrap auth state in the recovery database.
Production recovery still requires coordinated source/database restoration;
after another account writes, never restore global code or reassign all history.

Martin independently passed a fresh September 29 archive restore at clean
integrated commit `10bc3d8466d14e83e40954757d97966d4dc1b084`, applying0010–0018
verbatim with isolated synthetic owner bootstrap between0012 and0013. All28
historical tables and10,162 rows preserved counts and canonical content hashes;
all1,003 rows in21 owner-bearing tables had the sole owner, with zero unvalidated
foreign keys. This clears the historical FK blocker, not the fresh current
snapshot, production identity/authorization or admission release gates.

### Held private exercise content boundary

Migration0019 adds one account preference row per exercise, preserving legacy
descriptions and mind-muscle cues for the sole explicitly bootstrapped owner,
including archived exercises. Missing or ambiguous bootstrap with legacy
content fails transactionally. It clears those fields on the shared exercise
row; browser/session/substitution reads and the MCP view project only the
actor's preference. Exercise IDs and names are preserved. Shared names still
need neutral-publication review before admitting another account.

Cue changes require membership in an active actor-owned workout and update
only that actor's preference. Shared create/correction/archive operations
require the configured accepted original owner. Corrections retain the exercise
ID; archive removes it from active catalogue listings while retaining historical
workout links and private cues. No private exercise creation or preferred-label
search behavior is introduced.

The isolated rehearsal command now expects the reviewed20-entry journal and
seven pending ownership migrations. Alongside its25 retained-table fingerprints,
it compares complete exercise content after joining the owner's migrated
preferences and verifies preference ownership. The SDK fixture includes a legacy
private cue and exercises owner-only catalogue creation without copying private
content into shared columns. The synthetic PostgreSQL tests verify A/B and
missing-GUC projections, forged membership refusal, cue clearing, archive/history
parity and ambiguous-owner rollback; browser acceptance checks cue save/reload.

Martin independently repeated the September 29 encrypted archive restore at exact
private-cues commit `827d8e021d17811c5df84d40792091c63ec41e2c`, applying0010–0019
verbatim. All28 historical tables /10,162 rows retained canonical content hashes;
235 private exercise rows retained IDs, content and timestamps in owner preferences.
The SQL view exposed private cues to the owner and none to B or a missing actor.
The archive had no archived exercises with non-null cues, so that case remains
covered by the synthetic regression. This historical proof does not replace a
fresh current snapshot/rehearsal before live cutover. Keep schema and its matching
app release coordinated: an older app cannot read account preference cues.
Current snapshot/identity authorization, publication review and native admission
holds remain; this stage does not open private routes or B MCP access.

### External SDK acceptance and remaining boundary audit

The admission-hold findings in this section describe the earlier held stack.
See [local native identity cutover](#local-native-identity-cutover) for the current
local runtime and acceptance evidence; production admission remains disabled.

Run `bun run test:mcp:acceptance` with Bun, Node and local `initdb`, `pg_ctl`,
`pg_dump`, `pg_restore` available. It builds the current app, creates a separate
loopback PostgreSQL cluster (test trust authentication, synthetic data only),
uses its own restricted reader login, and starts/stops its own HTTP server.
It cannot replace or rotate an existing local reader login. Cleanup removes its
scratch databases, server, cluster and artifacts, including on test failure.

The fixture issues an owner credential at0012, runs the read-only preflight and
apply command, checks all25 history fingerprints, restores the backup into a
fresh database, then exercises the real external SDK HTTP transport against
the full stacked runtime. It verifies retained-owner query/write access,
foreign private references, B's accepted credential refusal, missing/unknown
bearers, missing self-bootstrap identity, SDK discovery/refresh without new
consent, replay refusal and revocation on an already initialized client. The
existing restricted SQL integration suite proves independent A/B queries and
pooled identity cleanup. **B runtime access remains deliberately closed**: these
tests do not prove native multi-account admission, the actual owner's stored
ChatGPT/Claude connection, production email delivery or live proxy behavior.

The disposable HTTP app also enables the local auth foundation and redeems real
magic links for A and B, verifying each session's exact account identity. Both
native sessions must still be redirected to legacy login for protected documents,
Single Fetch data routes, private resources and direct POSTs across habits,
measurements, workouts and nutrition. Single Fetch responses are decoded to verify
only a redirect is returned, with no private loader payload. A forged workout
rename must be denied and leave the stored name unchanged. Native A/B OAuth
consent GET/POST also require legacy login and issue no code/connection. This tests
the current admission hold;
full native workflow parity requires the later reviewed identity cutover.

The fixture also uses the historical FK name and includes a nonempty archived
habit before0013. Its read-only preflight leaves auth users empty; apply succeeds
only because `bootstrapAuthOwner` runs **before** the ownership migrations.
`auth:seed-local` migrates first and cannot bootstrap a nonempty restored source;
use the reviewed isolated rehearsal ordering, not a bypass of the local seeder.

Code audit at the held stack identifies the following admission gates:

| Boundary | Current evidence and remaining gate |
| --- | --- |
| Protected browser routes and private APIs | `ProtectedLayout` accepts the signed legacy browser session and resolves the configured accepted original owner. It does not use native B sessions. Habits, measurements/targets/notes, workouts/history/dashboard, nutrition/AI context and equipment use that explicit actor. Native identity cutover and real native A/B workflows remain required. |
| MCP private writes and SQL reads | `handleMcp` resolves the credential account and compares it with the configured owner before registering tools. Workout/nutrition factories and SQL transaction GUC receive that account. B initialization is denied; base-table reads are denied by the restricted role. Keep this gate until catalogue/private-cue scope is complete. |
| Shared exercise catalogue reads | Actor repository factories, selectors/history/session mapping, substitutes and `fitness_data.exercises` now project descriptions/MMC only from that account's preferences. The owner approved sharing all exercise catalogue rows on October 1, 2026. Global names/type/movement are shared; descriptions and personal cues remain account-private. No publication subset is required. |
| Catalogue writes | Browser canonical create/correction/archive and MCP `create_exercise` require the configured accepted original owner. Corrections preserve IDs and archive retains history. Session cue edits lock the owned workout, require active exercise membership and write only account preferences. B canonical creation is denied; private missing-exercise creation remains deferred. Owner-only create/edit controls and GET/POST authorization are implemented; admitted native B browser acceptance remains required. |
| Empty-account targets and dates | Dashboard and nutrition resolve only account targets and visibly label unsaved display defaults; saved zero stays zero and read errors are not missing-target fallback. Migration0020 stores each account device timezone. Protected UI synchronizes the device IANA zone before calendar interaction, then preserves mounted drafts during revalidation. Initial read-only requests use UTC when unset; date-default writes reject with409 until configured. Habits/nutrition use UTC date tokens derived from the account zone. Measurement history, streaks and logged-today checks retain existing server-local day semantics in this release; manual date defaults use the account day and explicit dates remain unchanged. Quick weight logs retain actual timestamps. Historical date-only and instant rows are not reclassified or converted. A future explicit distinction is required before device-local measurement aggregation. Empty dashboard still requires a neutral weight definition; no implicit copy of owner definitions/goals is approved. |
| Native auth and invitation administration | `/api/auth/*` and `/sign-in` use admitted native sessions when the foundation is enabled; invitation administration requires the configured owner. They do not open protected fitness routes. SMTP/fresh-link recovery, invitation revocation and cutover acceptance remain release gates. |
| OAuth/public endpoints | Discovery exposes protocol metadata only. Authorization still requires the legacy session and accepted owner; token/refresh/revoke bind the stored connection/account. `/healthz` reports source/database health without private history. Anonymous `/share/meal/:id` is the explicit active published-recipe exception; private lists and SQL views still exclude another account's recipe. |
| Retired data and operator scripts | Stored training preferences and generation conversations are owned and preserved but have no enabled route/tool consumer. Gym/equipment preference/measurement seeds require the actual accepted owner; the exercise seed still writes the shared catalogue and needs publication review. No tracked active scheduler/import worker adds a separate private-data execution path. |

These are release blockers and scoped follow-ups, not evidence of an admitted B
data breach: onboarding stays disabled and owner-only browser/MCP safeguards
remain. Martin's live query-string logging and trusted-IP remediation approval
is still separate from the isolated SDK proof.

### Local native identity cutover

The current local cutover supersedes the admission-hold audit above when
`AUTH_FOUNDATION_ENABLED=true`. The foundation remains disabled by default. Nonproduction uses loopback inboxes;
production uses validated HTTPS and SMTP settings. Actual SMTP delivery, the durable owner
bootstrap, fresh restored-history rehearsal and integrated exact-head CI remain
release prerequisites; local inbox capture is not production delivery proof.

- `requireFitnessUser` validates the accepted original-owner bootstrap, then
  requires the admitted native session for protected documents, Single Fetch,
  private resources/actions and OAuth consent. Missing native sessions never
  fall back to legacy credentials. With the foundation disabled, legacy owner
  behavior remains in force.
- OAuth grants bind to that native actor and cookie-bound consent ticket. MCP
  admission uses the persisted credential account and invitation state; the
  foundation-disabled path retains its owner-only restriction. Catalogue writes
  and invitation administration still require the configured original owner.
- Empty dashboards display a neutral weight definition without a database write.
  An explicit weight log ensures only that account's neutral definition and saves
  the actual timestamp in one transaction. Existing metadata is preserved.
  Explicit calorie-target saves similarly ensure their neutral definition and
  target atomically. Owner goals, definitions and history are never copied.
- Native logout clears the actual native session. `/sign-in` exposes Open Fitness
  for an admitted session. Device timezone synchronization and draft-preserving
  revalidation continue unchanged; the narrower measurement policy above stands.

The separate native phone browser profile redeems real local magic links in
independent contexts. It checks private habits/completions, measurement dates,
notes, ingredients/meals/templates, explicit targets, workout sets/RIR and
private cues through saves/reloads and known foreign IDs. Template create/edit,
apply, public sharing and owner revocation are checked, including anonymous
published access and foreign edit/apply/revoke refusal. It checks history and
meal-resolution resources, substitution access, Single Fetch isolation,
owner-only catalogue/invitation controls, logout, post-logout private resource
refusal and cross-origin rejection. Empty-account failures use real PostgreSQL
errors to verify no neutral definition survives a failed weight save and database
read failures do not become display defaults. Run this profile serially against
its dedicated test database; its temporary table rename must not overlap another
suite using that database. The SDK suite separately checks native A/B OAuth,
account-switch refusal, retained owner credentials, private writes/SQL reads,
bootstrap failure, refresh replay and invitation/token revocation.

These checks do not prove production email, the owner's stored ChatGPT/Claude
connection, every template/substitution/equipment UI flow or live deployment.
Those remain part of the integrated release acceptance matrix.

### Historical native A/B rehearsal readiness (held)

This is preparation at held target-defaults head
`e6619d6f12520de2286176cae303565b3baba927`, not native workflow acceptance.
The actual HTTP fixture establishes two invitation/magic-link identities and
checks the closed private boundary. Do not inject route contexts, monkeypatch
identity, use legacy cookies as B, or count direct repository tests as native
browser acceptance. The owner resolved catalogue sharing and device timezone on October 1, 2026;
admission still depends on implementation and acceptance below; there is no new bypass flag in this stage.

#### Approved shared catalogue scope

On October 1, 2026, the owner approved sharing all exercise catalogue rows.
Preserve canonical IDs and historical relationships. Description and personal
cues remain private. Only the original accepted owner can create, correct or
archive catalogue entries; private exercise creation remains deferred. Browser
controls and GET/POST authorization must enforce the same policy as MCP.

#### Minimal identity cutover and acceptance order

1. Verify the approved shared catalogue and device timezone implementation. Preserve
   original owner history and existing defaults; seed only required neutral
   measurement definitions for an empty account, never owner logs or targets.
2. Review a local-only cutover changing `ProtectedLayout` actor acquisition and
   OAuth consent to the admitted native session. `requirePersonalUser` already
   validates invitation/session state and same-origin writes. Do not fall back
   to owner identity when a native session is missing. If a local rehearsal gate
   is introduced, keep it loopback/nonproduction and closed by default; the
   existing foundation flag alone currently does not admit private app access.
3. Review MCP admission against the credential's actual accepted account rather
   than substituting the original owner. Keep catalogue correction owner-only;
   retained original-owner tokens must remain bound to the same owner and reader
   transaction GUC. Recheck invitation revocation at every applicable boundary.
4. In a separate disposable cluster/server, invite A/B and redeem actual email
   links. Browser storage contexts must be separate. For each private workflow,
   complete own actions/reload and attempt the other's known IDs/direct requests:
   habits/completions; definitions/measurements/targets/note; workout/templates/
   sets/RIR/history/substitution; personal food/templates/meals/estimation context;
   equipment/preferences; private exercise descriptions/cues. Use deterministic
   estimation fixtures at the external adapter, not live AI or synthetic route
   identity. Verify anonymous published meal sharing and owner-only publish/revoke.
5. Exercise actual OAuth consent for each native account and external HTTP SDK
   query/write/refresh/replay/revoke. Confirm account switches cannot reuse a
   consent ticket or pending action for another account. Reject expired/revoked
   invitations and sessions, unknown tokens and cross-account associations.
6. Test empty dashboards/definitions/default labels and account local midnight,
   opposite offsets and DST boundaries after timezone policy is implemented.
   The existing repository/legacy browser tests remain useful regressions but do
   not replace this complete native journey. Actual stored ChatGPT/Claude owner
   connections and production email/proxy checks are separate release evidence.

#### Coherent integration and exact-head CI

Ownership drafts233–242 are sequential dependencies, not independent patches to
merge in arbitrary order. Keep the final schema and private-cue reader release
together. Prepare one integration branch containing the reviewed stack and later
approved boundary decisions; reconcile `main` there and review every integration
commit before committing. Record final app head plus migration checksums, then
repeat local gate, SDK/native acceptance and current restored-history proof.

`.github/workflows/ci.yml` triggers pull requests **targeting main** and skips jobs
for draft PRs. A held stack PR targeting another branch does not run required CI,
even if marked ready. Empty check rollups are unreported, not green. When release
coordination authorizes review readiness, use a main-targeted PR at the exact
frozen integrated head and require quality, build/runtime migration smoke,
unit/integration and full E2E checks. Do not weaken triggers or remove draft holds
to claim evidence. The external SDK operator command is currently a separate
local gate, not a CI job. Any source/integration commit invalidates old exact-head
CI evidence and requires the relevant checks again.

#### Actual owner and production prerequisites

Production requires an explicitly approved durable owner UUID and normalized
email, verified against invitation/user state, plus authorized operator/config
invocation. Local fixture UUIDs/emails and accepted self-invitations are never
production identity choices. Missing/ambiguous bootstrap must stay fail-closed.
Preserve OAuth connection ownership and historical IDs. Run read-only orphan/
journal/content preflight on a fresh current snapshot; bootstrap before0013 when
restoring nonempty history; apply exact reviewed SQL without substitutions.

Coordinate a write-free migration window, fresh encrypted backup and verified
matching-code restoration before any production migration. Recovery must preserve
new account writes rather than restoring global code or assigning all rows back
to one person. Real stored external clients, SMTP access recovery/revocation,
trusted proxy/IP/log handling and explicit release authorization remain required.
This readiness audit approves none of those actions.
