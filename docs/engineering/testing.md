# Testing

Use this guide to choose tests and keep their dependencies explicit. The
[project README](../../README.md) owns the standard verification commands.
This guide describes current test configuration, not the historical CI remedies
recorded in the [February 2026 incident](../incidents/2026-02-10-ci-test-failures.md).

## Test pure behaviour directly

Use Vitest for domain rules, parsers, utilities, and view-model transformations.
Colocate tests with the code they exercise. Prefer pure functions with simple
dependency injection; do not use mocking.

Domain and application tests should not need database connections, loggers, or
server environment configuration. Avoid setup-level infrastructure imports:
importing a database module can trigger environment validation before tests run.
Do not weaken production validation to accommodate unit tests.

[vitest.config.ts](../../vitest.config.ts) supplies test-only environment values
for existing server-dependent tests. It excludes `*.integration.test.*` and
`tests/e2e/` from `bun run test`.

## Use real infrastructure for integration tests

Run database tests against a dedicated test database with controlled fixtures
and cleanup. Confirm the connection string before applying migrations, seeding,
or running write tests; do not use production data.

The auth integration suite has a separate command, `bun run test:auth:integration`,
and [configuration](../../vitest.auth.config.ts). See
[authentication setup](../operations/authentication.md) for its environment and
cleanup behaviour. Personal data ownership and owner-history migration regressions use
`bun run test:tenant:integration`, with `TENANT_TEST_ADMIN_URL` explicitly
pointing to a loopback disposable PostgreSQL admin connection. The suite creates
and drops its own scratch database.

`bun run test:mcp:acceptance` builds the full stack and runs a real HTTP SDK
client against a separate loopback PostgreSQL cluster and app server. It needs
local `initdb`, `pg_ctl`, `pg_dump` and `pg_restore`. It includes retained OAuth
credential migration, local rehearsal preflight/apply and backup recovery proof;
see the [isolated ownership rehearsal](../operations/authentication.md#isolated-restored-history-rehearsal-command).
This operator acceptance suite is separate from ordinary unit/tenant tests and
does not change an existing reader login or open native onboarding.

Meal update regressions use `bun run test:nutrition:integration` with
`NUTRITION_TEST_DATABASE_URL` explicitly pointing to a migrated, dedicated test
database. The suite creates and cleans up its own fixtures and never calls AI.
Meal-update browser tests likewise require `E2E_DATABASE_URL` for fixture setup;
use the same dedicated database as the running test server. Other excluded
integration tests need an explicit runner configuration; the ordinary unit
command does not execute them.

## Exercise components without a server

`bun run test:browser` bundles the real meal picker into a Chromium page without
starting the app or using a database. It checks touch, focus, Escape and selection
at phone width, and runs as part of `bun run gate`. Full persistence workflows
still use the E2E suite against the existing test server or isolated CI server.

The set-entry fixture also uses the actual app CSS and fonts in Chromium and
WebKit at phone boundary widths. Reuse `tests/browser/interaction-layout.ts`
to capture named controls in document coordinates and assert stability through
focus, typing, clearing, blur and save, including adjacent controls. Capture a
new baseline after intentional expansion or navigation. The existing fixture
proves the detector rejects an injected adjacent-control displacement; CLS alone
is not sufficient for input interactions. Keep new scenarios within the existing
matrix when they share its risks rather than multiplying whole-page suites.

## Exercise user workflows with Playwright

Prefer `getByRole()` and `getByLabel()` selectors. Use test IDs when there is no
suitable semantic locator, not as a replacement for accessible controls. Check
changed flows step by step so a failure identifies the broken interaction.

Developers and QA manage the local servers needed for their work. Check for a
suitable running server, or configure and start one with `bun run dev`; use a
separate port when working concurrently. Inspect its logs, restart it when
needed, and stop servers you started when finished. Set `TEST_PORT` or
`E2E_BASE_URL` and test credentials to match it. Before write tests, confirm the
server and test fixtures use the same dedicated test database; do not use
production or personal data.

When iterating against a production-build server, do not rebuild underneath it:
a running server keeps the previous asset manifest. Match the OAuth issuer and
test base URL to that server's port.

[playwright.config.ts](../../playwright.config.ts) requires a reachable existing
test server and fails before browser tests when `/login` is unavailable. It never
builds, migrates, seeds, or starts a server, and has no CI-specific settings;
`bun run gate` starts the servers it tests. Auth-only browser tests use a separate
configuration and also require an existing server. Their fixtures and lifetime profiles are described in the
[auth acceptance guide](../../tests/e2e/auth/README.md).

## Run the gate

[`bun run gate`](../../scripts/gate.ts) is the single check that guards main, and
the [CI workflow](../../.github/workflows/ci.yml) only runs that command. Keep
checks in the script, not in the workflow, so local and CI results cannot
diverge. The gate builds its own environment (`NODE_ENV=test`, UTC, test
credentials) instead of reading your shell or `.env`, creates throwaway
databases named `fitness_gate_<run>_<role>_test`, and runs independent stages
in parallel: static checks; build and database preparation; then unit,
integration, browser, end-to-end (regular and native account servers) and
production-image checks. Each step logs to `.gate/<step>.log`, and failures
print the end of their log. Set `GATE_KEEP_DATABASES=1` to inspect databases
after a run.

After orchestration finishes, `.gate/summary.md` and `summary.json` index stage
results, source HEAD/index tree, working-tree differences and existing evidence.
Open the linked logs or Playwright reports for assertion/scenario details; trace,
error-context and image paths are included when those files exist. No log,
inbox or trace payload is copied into the summary. CI links the existing gate-log
artifact from its job summary; precommit copies the same files into
`.gate/precommit/`. Rerun with `bun run gate`, which recreates the isolated test
environment. These are diagnostic artifacts, never cached permission or commit
receipts. Early toolchain failures still report directly in the terminal.

Keep required test environment values aligned with server validation. When a
failure occurs before tests start, inspect transitive imports and setup first;
when a page returns a server error, distinguish schema/configuration failures
from selector failures.

## Fast feedback while editing

`bun run tc:watch` reruns typechecking when app, tests, server, scripts or
`tsconfig.json` change. Use the existing `bun run test:debug <path>` for focused
unit-test watching and `bunx biome check <files>` for non-mutating lint/format
feedback. These checks support iteration; the full gate still runs before commit.

## Before hand-off

Run focused checks while iterating, then `bun run gate`. Formatting and lint
commands write changes; inspect the working tree before and after running them.

### Account timezone acceptance

The `device-timezone` Playwright project runs after both `auth` and `chromium`,
so its temporary account-wide timezone changes cannot race other workflow tests.
Its tests run serially and restore prior settings. For a focused rerun against
an already authenticated dedicated test server, use
`bun run test:e2e --project=device-timezone --no-deps`; a full run keeps the
project dependencies enabled.

### Native account browser acceptance

`playwright.native.config.ts` is a separate serial phone browser profile with
real local email-code sessions and empty cookie contexts. Start a rebuilt local
foundation-enabled server against a migrated dedicated test database, configure
`E2E_BASE_URL`, `E2E_DATABASE_URL`, `AUTH_LOCAL_INBOX` and the test owner identity,
then run `bunx playwright test --config playwright.native.config.ts`.
It does not start, migrate or seed a server. Ordinary Chromium tests exclude it.
Run it separately from other suites on the same database: its database-failure
checks temporarily install a trigger and rename a table, restoring both in
`finally`. Fixtures and new sessions are removed after the suite; existing owner
settings are restored. Traces, video and automatic screenshots are disabled to
avoid persisting sign-in codes and session credentials. CI runs the legacy
browser suite with the foundation disabled, then starts a native server and
runs this separate profile against the same isolated job database. The unit and
integration CI job also runs full HTTP SDK acceptance with its own PostgreSQL
cluster.

### Before committing

The pre-commit hook formats staged files with lint-staged, then runs the same
`bun run gate` as CI in a temporary local checkout of the index. It installs
locked dependencies there and leaves unstaged and untracked work untouched.
A failed gate, changed index/HEAD, or source modification during testing blocks
the commit. Logs are retained in `.gate/precommit/`; the checkout is removed.
No source is uploaded and no hosted test receipt or publication approval is used.
Install the versions in `.node-version` and `.bun-version`, PostgreSQL server
tools, Docker and Playwright Chromium/WebKit before running it. On macOS, Docker
must support host networking so the image migration check can reach PostgreSQL.
