# Fitness

Fitness is a mobile Progressive Web App (PWA) that centralises nutrition, workouts, and habits.

As a mobile app, we *never* have to think about the desktop UI.

## Architecture
The web app is a server-rendered React Router v7 application in framework mode.
You can find more in `app/README.md`.

The database is PostgreSQL.
See [database conventions](docs/engineering/database.md) for modelling and migrations.

Architecture Decision Records (ADR) can be found in `docs/adr/`. You can list them with `ls -l docs/adr`.

## Start with the right context

Use the [documentation index](docs/README.md) to find guidance for your task:

- [Architecture](docs/engineering/architecture.md) and
  [features](docs/features/README.md) for feature work.
- [Database](docs/engineering/database.md) for modelling and persistence.
- [Frontend](docs/engineering/frontend.md) and
  [design system](docs/design/design-system.md) for UI work.
- [React Router](docs/engineering/react-router.md) for routes and request handling.
- [Testing](docs/engineering/testing.md) for test boundaries and environments.
- [Authentication](docs/operations/authentication.md) for login and OAuth setup.

## Run and verify the app

Install dependencies once with `bun i`.

Use `bun run dev` for local iteration. Check for a suitable running server first;
when working concurrently, choose a separate port with `PORT=5176 bun run dev`.

Before local E2E checks, configure and start a test server using a dedicated test
database and matching test credentials. Set `TEST_PORT` or `E2E_BASE_URL` to its
address; see the [testing guide](docs/engineering/testing.md). The local E2E
runner checks that the server is reachable; it does not start it or prepare its
database.

Use the smallest relevant check while iterating:

```shell
bun run tc       # React Router type generation and TypeScript
bun run test     # unit tests
bun run test:browser # component browser tests; no app server or database
bun run build    # production build
bun run test:e2e # Playwright end-to-end tests
```

Before hand-off, run `bun run gate` (typecheck, lint, unit tests, build, and
component browser tests).
Run `bun run gate:e2e` when the change affects a user workflow, Playwright
browsers are available, and a test server is correctly configured.
`bun run fmt` and `bun run lint` write changes, so
review their output before running them in a dirty worktree.

Use `bun run db:dev` while iterating on a database change. Generate a migration
only when the schema is final:

```shell
bun run db:dev
bun run db:generate
bun run db:migrate
bun run db:seed
```

Detailed conventions live in the guides above rather than being repeated here.
For production setup, see the [deployment guide](deploy/README.md).

## References
- Linear: https://linear.app/valentin-mouret/project/fitness-22f97be13373/issues

See [MCP tools](docs/mcp.md) for the API, SQL reader setup, and integration tests.
See the [local magic-link foundation](docs/operations/authentication.md#local-magic-link-foundation-enso-89)
for invitation-only auth development, local email capture and isolation gates.
