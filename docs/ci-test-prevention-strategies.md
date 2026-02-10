# CI Test Failure Prevention Strategies

## Prevention

### 1. Eager Environment Validation

**Problem**: `env.server.ts` calls `schema.parse(process.env)` at module load time, causing all unit tests to crash when imported transitively.

**Strategies**:
- **Lazy initialization**: Move environment validation to a singleton-initialized function that's called only when the app actually needs the environment (in React Router loaders/actions or server entry point), not at module import time.
  ```typescript
  // env.server.ts: Defer validation
  let cachedEnv: ServerEnv | null = null;
  export function getEnv(): ServerEnv {
    if (!cachedEnv) cachedEnv = schema.parse(process.env);
    return cachedEnv;
  }
  ```
- **Test environment defaults**: The `vitest.config.ts` already sets test env vars—ensure they include all required fields or provide sensible defaults in schema with `.optional()` or `.default()` for test-safe values.
- **Never import env.server directly in libraries**: Keep env access isolated to infrastructure layer (repositories, services that need DB connections). Domain and application layers should accept config as parameters, not import it.

---

### 2. Test Infrastructure Decoupling

**Problem**: Logger and DB modules are imported by test setup, pulling in `env.server.ts` and causing transitive dependency failures.

**Strategies**:
- **No setup-level infrastructure imports**: The test setup file should contain only test utilities and configuration, never infrastructure modules. Keep it pure.
  ```typescript
  // vitest.setup.ts should be minimal—no db, logger, or env imports
  export function setupTestDatabase() { /* isolation */ }
  ```
- **Lazy infrastructure in tests**: Import db/logger only inside test blocks (in `describe()` or `beforeEach()`) when needed, not at module load time. This lets vitest substitute test doubles.
- **Create test doubles early**: For integration tests that need DB, use a dedicated test database (already present: `fitness_test` in `vitest.config.ts`). For unit tests, mock repositories and services rather than importing the real infrastructure.
- **Separate integration test markers**: Vitest config already excludes `*.integration.test.*` files—keep this pattern strict. Unit tests (`time.test.ts`, `strings.test.ts`) must never import server-side infrastructure.

---

### 3. E2E Test Selector Durability

**Problem**: Playwright selectors become stale when UI components change, causing silent test failures.

**Strategies**:
- **Prefer semantic selectors**: Use `getByRole()` and `getByLabel()` (accessible by default) instead of CSS selectors or data-testid. These survive minor styling changes.
  ```typescript
  // ✅ Resilient to UI changes
  await page.getByRole("button", { name: "Start Workout" }).click();

  // ❌ Brittle to refactoring
  await page.locator("[data-testid='start-btn']").click();
  ```
- **Semantic HTML is enforcement**: Follow WCAG patterns in components (proper button/link roles, labels). This makes selectors naturally stable and improves accessibility simultaneously.
- **E2E test reviews in PRs**: When UI components change, require reviewing affected `tests/e2e/*.spec.ts` files in code review. Failing selectors should be caught before merge.
- **Incremental selector assertions**: Don't assert entire page state in one shot. Chain assertions step-by-step, allowing granular failure messages that pinpoint which selector failed.
  ```typescript
  // ✅ Clear failure messages
  await expect(page.getByRole("heading")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create" })).toBeEnabled();

  // ❌ Single failure obscures which selector broke
  await expect(page.locator(".container")).toContainText("Expected...");
  ```

---

### 4. E2E Test Environment Schema Synchronization

**Problem**: E2E test database schema drifts from production schema when migrations run between test runs.

**Strategies**:
- **Deterministic E2E setup**: The `playwright.config.ts` webServer command should explicitly rebuild schema before seeds:
  ```typescript
  command: "bun run build && bun run db:dev && bun run db:seed && bun run start"
  // Ensure db:dev runs every time, not just on first CI run
  ```
- **Idempotent migrations**: All Drizzle migrations (in `drizzle/*.sql`) must be idempotent with `IF NOT EXISTS` or `ON CONFLICT` clauses. This allows safe re-running without errors.
  ```sql
  -- ✅ Safe to re-run
  alter table workouts add column if not exists template_id uuid;

  -- ❌ Fails if column exists
  alter table workouts add column template_id uuid;
  ```
- **Schema snapshot in test baseline**: Commit the generated migration files (`drizzle/` directory) to version control. When a test environment initializes, it uses the exact schema from the last committed migration—no drift.
- **E2E environment isolation**: Playwright uses `DATABASE_URL` for the server (currently `fitness` in local, should be `fitness_test_e2e` in CI). Keep test data isolated from development data to prevent false negatives from stale seed data.

---

### 5. Architecture Patterns for Test Resilience

**Patterns to enforce across the codebase**:

- **Dependency injection, not globals**: Pass database/logger as function parameters or constructor arguments. Avoid singletons at module level (`export const db = ...`). This lets tests swap implementations.
  ```typescript
  // Repository layer accepts db in function
  export function createWorkoutRepository(db: Database) {
    return {
      save: (workout) => db.insert(workouts).values(workout)
    };
  }
  // Tests can pass a mock db
  ```

- **Clear layer boundaries**: Domain layer (pure business logic) must never import infrastructure. Application layer imports domain but not infra. Infra layer imports application. This makes unit tests testable without spinning up a database.
  ```
  Routes → Application → Domain
     ↓
  Infra → (never imported by Domain)
  ```

- **Feature-level test organization**: Keep tests colocated with the code they test (e.g., `strong-import.service.server.integration.test.ts` next to `strong-import.service.server.ts`). This makes it obvious when a feature's tests need updating after changes.

---

## Validation Checklist

When merging changes to CI/test infrastructure:

- [ ] Unit tests do not import `app/db/index.ts` or `app/logger.server.ts`
- [ ] Unit tests do not import modules that re-export `env.server.ts`
- [ ] Integration tests use `*.integration.test.ts` naming and are excluded from unit test runs
- [ ] E2E tests use `getByRole()` selectors where possible; `data-testid` as fallback
- [ ] All Drizzle migrations use `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`
- [ ] Playwright config includes `db:dev` in `webServer.command` (schema always rebuilt)
- [ ] No server-side infrastructure in `vitest.setup.ts`
- [ ] Repositories accept db/tx as parameters (DI pattern)
