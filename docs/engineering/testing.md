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

## Exercise user workflows with Playwright

Prefer `getByRole()` and `getByLabel()` selectors. Use test IDs when there is no
suitable semantic locator, not as a replacement for accessible controls. Check
changed flows step by step so a failure identifies the broken interaction.

Locally, use the existing development server. Set `E2E_BASE_URL` and test
credentials to match it, and confirm it is using an appropriate database before
running write tests. Do not start another server in an agent session.

[playwright.config.ts](../../playwright.config.ts) reuses a reachable local
server. If none is reachable, its local fallback builds, migrates, seeds, and
starts a server; verify the URL first rather than accidentally invoking that
fallback. Auth-only browser tests use a separate configuration and never start
a server. Their fixtures and lifetime profiles are described in the
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
workflow, also run `bun run gate:e2e` when browsers are available and the existing
server is correctly configured. Formatting and lint commands write changes;
inspect the working tree before and after running them.
