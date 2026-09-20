# Fitness

Fitness centralises nutrition, workouts, and habits for one person. It is
solo-ware, not a multi-user product. Read [README.md](README.md) before changing
the application, then use [docs/README.md](docs/README.md) to find relevant guidance.

## Read before changing a system

- Feature work: [architecture](docs/engineering/architecture.md) and the
  [feature index](docs/features/README.md).
- Routes: [React Router](docs/engineering/react-router.md).
- UI: [frontend conventions](docs/engineering/frontend.md) and
  [design system](docs/design/design-system.md).
- Modelling or persistence: [database](docs/engineering/database.md).
- Tests: [testing](docs/engineering/testing.md).
- Authentication configuration: [authentication](docs/operations/authentication.md).

These guides own the detailed conventions. Do not duplicate them here. Feature
proposals and historical incident fixes do not override current engineering rules.

## Stack and coding approach

React Router v7 framework mode, TypeScript, Bun, Drizzle/PostgreSQL, Zod,
neverthrow, Pino, Biome, Radix UI, Tailwind CSS, Lucide React, and Recharts.

- Adopt a functional approach unless performance or readability justifies otherwise.
- Use `readonly` types.
- Parse untrusted input with Zod at boundaries, including MCP handlers. Application
  operations and repositories receive explicit typed inputs; keep business
  invariants in domain and application code. See
  [boundary parsing](docs/engineering/architecture.md#parse-at-boundaries).
- Start with domain modelling, then move to infrastructure.
- Limit comments to the bare minimum, around data structures and main functions.
- Check `app/time.ts` and `app/strings.ts` before adding common helpers. Extract
  shared functionality used in two or more places; keep utilities pure, focused,
  and comprehensively tested.

## Agent workflow

- A development server is already running. Never start another instance. Ask the
  owner to check server logs or restart it when needed.
- Ask questions before proceeding when domain rules or requirements are unclear.
- Use the commands in [README.md](README.md). Before hand-off, run `bun run gate`;
  for changed user workflows also run `bun run gate:e2e` when Playwright browsers
  are available and the existing server is correctly configured.
- `bun run fmt` and `bun run lint` write changes. Account for a dirty working tree
  before running them and inspect their output afterwards.
- After changing frontend code, run the frontend engineer review for simplicity
  and conformance to guidelines.
- Use Playwright MCP to test UI changes.
