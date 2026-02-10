---
title: "CI Test Suite Failures: Eager Env Validation & Stale E2E Selectors"
category: test-failures
tags: [vitest, playwright, env-validation, zod, drizzle, e2e, ci]
severity: critical
component: testing-infrastructure
date: 2026-02-10
pr: https://github.com/ValentinMouret/fitness/pull/33
---

# CI Test Suite Failures: Eager Env Validation & Stale E2E Selectors

## Symptoms

- All 12 unit test suites crash with `ZodError` before any test runs
- 5/16 E2E tests fail — mix of "Internal Server Error" pages and stale selectors
- `bun run ci` fails completely

## Root Cause

### Unit Tests

`env.server.ts` validates environment variables eagerly at module load time via `schema.parse(process.env)`. The test setup file (`vitest.setup.ts`) imported `closeConnections` from `app/db/index`, which transitively imported `env.server.ts`, crashing all test suites because test environments lack `DATABASE_URL`, `ANTHROPIC_API_KEY`, etc.

A secondary import chain existed through `app/logger.server.ts`, which imported `env` from `env.server.ts` just to read `NODE_ENV`.

### E2E Tests

1. **Server errors**: The `workout_templates` table and `workouts.template_id` column (from migration `0003_workout_templates.sql`) were missing from the E2E test database. The Playwright webServer command only ran `build && start`, never syncing the schema.
2. **Stale selectors**: UI headings and link text had changed (e.g., "Today's Calories" → "Daily Intake", "Today's Meals" → "Meals") but E2E tests still asserted the old text.

## Solution

### 1. Delete `vitest.setup.ts`

No unit test needed the DB connection. The setup file existed only to call `closeConnections()` in `afterAll`, which was unnecessary.

### 2. Decouple `logger.server.ts` from `env.server.ts`

```typescript
// Before
import { env } from "./env.server";
const isDev = env.NODE_ENV !== "production";

// After
const isDev = process.env.NODE_ENV !== "production";
```

### 3. Add test environment variables to `vitest.config.ts`

Service files that import infrastructure repos still trigger the `env.server.ts` import chain. Providing test env vars in vitest config satisfies the Zod validation:

```typescript
test: {
  env: {
    NODE_ENV: "test",
    ANTHROPIC_API_KEY: "test",
    AUTH_USERNAME: "test",
    AUTH_PASSWORD: "test",
    DATABASE_URL: "postgresql://localhost:5432/fitness_test",
  },
  exclude: [
    "**/node_modules/**",
    ".direnv/**",
    "tests/e2e/**",
    "**/*.integration.test.*",
  ],
}
```

### 4. Exclude integration tests from unit test suite

Tests with `*.integration.test.*` naming need a real database. They are now excluded from `bun run test` and should be run separately.

### 5. Add `db:dev` to Playwright webServer command

```typescript
command: "bun run build && bun run db:dev && bun run db:seed && bun run start",
```

`drizzle-kit push` (via `db:dev`) diffs the schema and applies changes, ensuring the E2E database always matches the current Drizzle schema.

### 6. Update E2E test selectors

Updated `dashboard.spec.ts`, `nutrition.spec.ts`, and `workouts.spec.ts` to match current UI text and structure.

## Related Files

- `vitest.config.ts` — test env vars and exclusions
- `app/env.server.ts` — eager Zod validation (root cause)
- `app/logger.server.ts` — decoupled from env.server
- `app/db/index.ts` — DB connection (transitive import trigger)
- `playwright.config.ts` — webServer command with `db:dev`
- `tests/e2e/dashboard.spec.ts` — updated selectors
- `tests/e2e/nutrition.spec.ts` — updated selectors
- `tests/e2e/workouts.spec.ts` — updated selectors

## Prevention

See [CI Test Prevention Strategies](../../ci-test-prevention-strategies.md) for detailed prevention patterns covering:

1. Eager environment validation — lazy init patterns
2. Test infrastructure decoupling — no setup-level infra imports
3. E2E selector durability — semantic selectors with `getByRole()`
4. Schema synchronization — deterministic E2E setup with `db:dev`
