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
cleanup behaviour. Meal update regressions use `bun run test:nutrition:integration` with
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

For a local production-build server, stop the server you own before rebuilding
changed source, then restart it from the completed build before running E2E tests. A running server retains the previous asset manifest;
the new build can remove those assets and cause navigation failures. Run
`bun run gate`, restart the server from that build, then `bun run test:e2e`.
If using `bun run gate:e2e` with a separately running server, its build step still
replaces the served assets. Use the separated gate/build → server start → E2E
sequence locally; do not rebuild underneath a running server. Match the OAuth
issuer and test base URL to that server's port.

[playwright.config.ts](../../playwright.config.ts) requires a reachable existing
test server locally and fails before browser tests when `/login` is unavailable.
It never builds, migrates, seeds, or starts a local server. CI retains its isolated
server startup. Auth-only browser tests use a separate configuration and also
require an existing server. Their fixtures and lifetime profiles are described in the
[auth acceptance guide](../../tests/e2e/auth/README.md).

## Understand CI setup

The [CI workflow](../../.github/workflows/ci.yml) defines isolated PostgreSQL
services. Its unit/integration and E2E jobs currently push the schema and seed
their databases before testing. The E2E job downloads a build artifact and lets
Playwright start the production server; it does not reuse the local setup path.
The build job separately smoke-tests runtime migrations in the production image.

Keep required test environment values aligned with server validation. When a
failure occurs before tests start, inspect transitive imports and setup first;
when a page returns a server error, distinguish schema/configuration failures
from selector failures.

## Before hand-off

Run focused checks while iterating, then `bun run gate`. For a changed user
workflow, also run `bun run gate:e2e` when browsers are available and a test
server is correctly configured. Formatting and lint commands write changes;
inspect the working tree before and after running them.
