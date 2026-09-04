# Fitness

Fitness centralises nutrition, workouts, measurements, and habits for one
person. It is a server-rendered React Router v7 application in framework mode.
This README is the source of truth for the application's architecture and
development workflow. It does not describe deployment or external integrations
in detail.

## Start with the right context

Read the documentation that applies to the change before editing code:

- [domain-driven-design.md](docs/domain-driven-design.md) for feature work.
- [database.md](docs/database.md) for data modelling or persistence changes.
- [frontend.md](docs/frontend.md) and
  [design-system.md](docs/design-system.md) for UI work.
- [features/README.md](docs/features/README.md) for product behaviour.
- [.claude/react-router-v7.md](.claude/react-router-v7.md) for React Router
  framework patterns.

## Run and verify the app

Install dependencies once with `bun i`. A development server is already running
for this workspace; do not start another one.

Use the smallest relevant check while iterating:

```shell
bun run tc       # React Router type generation and TypeScript
bun run test     # unit tests
bun run build    # production build
bun run test:e2e # Playwright end-to-end tests
```

Before hand-off, run `bun run gate` (typecheck, lint, unit tests, and build).
Run `bun run gate:e2e` when the change affects a user workflow and the Playwright
browsers are available. `bun run fmt` and `bun run lint` write changes, so
review their output before running them in a dirty worktree.

Use `bun run db:dev` while iterating on a database change. Generate a migration
only when the schema is final:

```shell
bun run db:dev
bun run db:generate
bun run db:migrate
bun run db:seed
```

## Build routes around the web platform

React Router is a thin layer over browser and server primitives. Prefer the
first option that fits the behaviour:

1. A URL path or search parameter for durable, addressable view state.
2. A server `loader` to read data for that URL.
3. A `<Form>` and `action` to perform a navigation-causing write.
4. A `useFetcher` mutation when a write must not navigate.
5. React state for ephemeral presentation state only.

Define every route explicitly in [app/routes.ts](app/routes.ts). Keep the
route file tree aligned with the URL tree. Give each screen an addressable URL
that can be reloaded, bookmarked, and shared.

Type route modules with their generated `Route` namespace and receive data
through `Route.ComponentProps`. After adding, moving, or renaming a route, run
`bun run tc` so generated route types match the route tree. Never edit generated
route types.

Keep durable selections, filters, tabs, and pagination in URL search
parameters. Validate route parameters, search parameters, and form data with
Zod at the loader or action boundary. Do not cast untrusted input.

Use links for navigation and buttons inside forms for actions. Give every input
a `name`: it is the contract between a form and its action. Redirect after a
successful navigation-causing write. Render expected validation failures as
safe user-facing data with an appropriate 4xx response. Use an `ErrorBoundary`
when the surrounding UI should survive an unexpected route failure.

## Keep boundaries explicit

Route modules orchestrate navigation, loaders, and actions. They do not contain
business rules. Feature components render view models; shared components accept
only UI-shaped props.

Domain and application layers return errors as values with `neverthrow`.
Infrastructure and route boundaries translate those errors into HTTP responses
or safe UI data. Do not hide domain failures in components.

Keep database access in a `loader`, an `action`, or a `*.server.ts` module.
Never query Drizzle from a React component. Server-only code must use the
`*.server.ts` suffix. Return JSON-serializable view models from loaders rather
than domain entities or non-serializable values.

Use `env` from [app/env.server.ts](app/env.server.ts), never `process.env`, and
use [logger.server.ts](app/logger.server.ts) for server logging.

## Structure the UI

The application uses Radix UI and Tailwind utilities, with component CSS kept
next to the component. Reuse existing primitives before creating a new one.
Keep static styles out of JSX; use an inline `style` only for a data-driven
value that CSS cannot express.

Use semantic HTML, ordered heading levels, labelled controls, and keyboard
operable interactions. Accessibility linting is a baseline, not a substitute
for testing the flow.

Put generic components in `app/components/`, feature components in
`app/modules/<feature>/presentation/components/`, and route orchestration in
`app/routes/`. Use view models between domain data and UI components. See
[frontend.md](docs/frontend.md) for the full component conventions.

Test pure helpers, parsers, and view-model mappers directly. Use Playwright to
exercise changed user workflows against the existing development server.

## Data model principles

Fitness has no `user_id`: it is solo-ware. Model concepts for people first,
then for the database. Names should be meaningful and history should remain
queryable.

The model must support linked records (for example, logging a weight habit can
create a measurement), incomplete historical data, imported records, backfill,
and a clear latest value without losing previous values. Keep integrations and
automation narrow until the base model is reliable.
