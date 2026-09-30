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
Enabling this foundation in production is rejected by environment validation.
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
production SMTP wiring is part of the later reviewed cutover, with TLS required.

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
