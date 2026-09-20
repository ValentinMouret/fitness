# Application architecture

Use this guide when changing feature boundaries. Fitness is a server-rendered
React Router application for one person. Features live in `app/modules/` and
use domain-driven design to separate business rules from external systems.

## Keep dependencies explicit

- `domain/` contains pure entities, calculations, and business rules. It cannot
  import application or infrastructure code.
- `application/` contains use cases and depends on the domain, not infrastructure.
  Pass external capabilities as dependencies rather than importing adapters.
- `infra/` adapts persistence and external APIs. It may depend on application and
  domain code and composes services with concrete dependencies.
- `presentation/` contains feature components and UI-facing transformations.
  See [frontend conventions](frontend.md) for component boundaries.
- Routes orchestrate requests and navigation; they do not own business rules.

```text
app/modules/<feature>/
├── domain/
├── application/
├── infra/
└── presentation/
    ├── components/
    ├── hooks/
    ├── view-models/
    └── types/
```

These are conventions for changes, not a claim that every existing module has
already been brought into conformance.

## Parse at boundaries

Parse and validate untrusted data where it enters the application: HTML form
adapters, route parameters, MCP handlers, imports, and external API responses.
Use Zod to produce typed values, including defaults and transport conversions,
before calling application operations.

Application operations and repositories must accept explicit, readonly input
types. They must not accept `unknown`, raw `FormData`, or serialized request
bodies and parse them internally. Do not cast untrusted values into those types.
Shared schemas may define the input contract; execute them at the boundary.

Domain and application code still enforce business invariants, such as valid
workout times, exercise membership, and preserving completed sets. Return those
failures through `neverthrow`; the boundary translates them into a response.

## Preserve errors and server boundaries

Domain and application layers return errors as values with `neverthrow`. Compose
results with `.map` and `.andThen`; let infrastructure and route boundaries
translate failures into HTTP responses or safe UI data.

Shared domain code uses `.ts` files and must remain usable in the browser.
Server-only modules use `*.server.ts` or `*.server.tsx`; browser-only modules use
`*.client.ts` or `*.client.tsx`. Do not import database connections, environment
configuration, or external API clients into pure layers.

Use `env` from [env.server.ts](../../app/env.server.ts) for application server
configuration and `logger` from [logger.server.ts](../../app/logger.server.ts)
for logging. Configuration and test-runner entry points have their own environment
handling; they are not examples for domain or application code.

## Related guides

- [React Router](react-router.md): request validation, data loading, HTTP errors,
  and authentication boundaries.
- [Database](database.md): modelling and persistence conventions.
- [Testing](testing.md): pure tests and real infrastructure integration tests.
- [ADR 0001](../adr/0001-server-auth-middleware.md): why authentication uses server middleware.
