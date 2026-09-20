## MCP

Intent: connect Fitness to ChatGPT, Claude, and other MCP clients so humans and agents can read and update fitness data through conversation.

### Auth

Keep the existing solo-user model and username/password login. Implement auth in `app/modules/auth`; fitness entities need no user IDs or ownership changes.

- [x] Secure browser login first: replace the unsigned cookie with a signed, expiring, `HttpOnly` cookie, secure over HTTPS. Enforce authentication before protected loaders/actions through server middleware on `ProtectedLayout`; see [ADR 0001](docs/adr/0001-server-auth-middleware.md).
- [x] Preconfigure ChatGPT and Claude as two fixed OAuth clients, each with its own client ID, secret, and exact allowed callback URL. Define configuration through `app/env.server.ts`. Enter credentials once in each client's setup; no dynamic registration endpoint or client-management UI.
- [x] Implement remote MCP OAuth using an established OAuth library: discovery metadata, Fitness login, explicit consent to read and update fitness data, and authorization code exchange with PKCE. Bind tokens to the Fitness MCP resource.
- [x] Use one scope, `fitness`, covering all exposed reads and writes. Persist connections, temporary authorization codes, and hashed opaque tokens in PostgreSQL. Use short-lived access tokens and rotating refresh tokens.
- [x] Enforce token validity, scope, resource, and connection status on every MCP request. Keep connections revocable without building a Connected apps page. Tool annotations are hints, not permissions.
- [x] Test forged cookies, invalid callbacks, reused authorization codes, incorrect PKCE, expired tokens, refresh rotation, and revoked connections. Verify browser login with Playwright.

- [ ] Verify the Secure cookie on HTTPS and complete linking from actual ChatGPT and Claude clients after configuring a public deployment. Local tests use fixture clients.

Setup and verification commands: [authentication setup](docs/operations/authentication.md).

Delivery order: secure browser login, then OAuth storage and integration. Fitness tools remain a separate product task below.

### Product

- [x] Define the MCP boundary: a simple API that lets agents use Fitness on the owner's behalf. Preference learning, recommendations, and conversational behaviour belong to the external agent; see [ADR 0002](docs/adr/0002-mcp-as-app-api.md).
- [x] Scope the first version to workouts and exercise catalogue creation, with reads and writes from the start. Saving future workout plans and reusable templates is out of scope.
- [x] Choose explicit application operations for writes and generic read-only SQL over documented views for reads. The first exposed data covers workouts; nutrition, habits, and measurements will extend the schema without changing the query tool.
- [x] Agree on the initial tool surface and deferred operations below.

#### Initial tools

| Tool | Purpose |
|---|---|
| `describe_schema` | Document all exposed views, fields, relationships, identifiers, units, and metrics. |
| `query` | Run read-only SQL over any exposed data. |
| `create_exercise` | Create an exercise in the catalogue and return its ID. |
| `create_workout` | Create an empty, partial, or completed workout, including name, notes, timestamps, exercises, and sets. |
| `delete_workout` | Delete a workout. |
| `finish_workout` | Finish an ongoing workout. |
| `add_exercise_to_workout` | Add an existing catalogue exercise by ID. |
| `remove_exercise_from_workout` | Remove an exercise and its sets. |
| `replace_exercise_in_workout` | Substitute an exercise while preserving completed performance. |
| `save_workout_sets` | Record or correct explicitly numbered sets. |
| `delete_workout_sets` | Delete explicitly numbered sets. |

The agent discovers exercises through `query`, reuses an existing ID, or calls `create_exercise` before adding it to a workout. Catalogue creation enforces exercise domain rules, including muscle contributions totalling 100%.

Support both progressive recording and submitting a completed workout without prescribing the agent's logging cadence. Creating a workout with exercises and sets must be atomic. Set saves affect only the specified sets; repeating the same save must produce the same result. Return saved identifiers and values so the agent can continue using them.

Exercise order comes from creation. Additions append; replacements preserve position. Defer separate tools for editing workout names, notes, and timestamps after creation, editing exercise notes, and explicitly reordering exercises. `finish_workout` remains available to finish an ongoing session.

#### Implementation

Reuse the existing `/mcp` endpoint, stateless transport, and OAuth enforcement. Keep tool handlers thin: validate inputs with Zod, call shared application operations, and translate `neverthrow` results into structured tool responses. Fitness owns validation, persistence, and domain calculations. Implemented contracts and SQL reader setup: [docs/mcp.md](docs/mcp.md).

1. **Workout operations**
   - [x] Define exact input/output schemas, optional-value semantics, and errors for the agreed tools using the existing domain model and identifiers.
   - [x] Define how replacement preserves completed sets while transferring pending work, including replacement with an exercise already in the workout.
   - [x] Extract the required shared application operations from browser-oriented services. Keep form parsing and redirects at the browser boundary; inject repository dependencies into application operations.
   - [x] Implement missing capabilities, including catalogue creation through MCP, atomic completed-workout creation, and repeatable set saves. Reuse existing domain rules and soft-delete conventions.
2. **Generic SQL reads**
   - [x] Define the initial workout views and schema documentation: available data, relationships, identifiers, units, field meanings, and query examples. Handle soft-deleted records consistently and distinguish completed sets, targets, warm-ups, and muscle contribution percentages.
   - [x] Settle canonical metric definitions and share them with the app, including weighted set counts versus weight × reps and consistent warm-up/deletion filtering.
   - [x] Create a dedicated database reader role and connection limited to exposed views, with restricted function permissions. Enforce read-only transactions, query time limits, and row/byte limits. A read-only transaction setting alone is not the access boundary.
   - [x] Implement `describe_schema` and `query` for catalogue lookup, individual workouts, sessions to resume, date-range histories, and custom joins, aggregates, or time series, including volume per muscle group over time.
3. **MCP integration and verification**
   - [x] Register the agreed tools on the existing endpoint and enforce OAuth on every request.
   - [x] Test catalogue lookup/creation and complete workout flows: create, record sets, replace an exercise, correct/delete records, finish, and query history. Cover both progressive logging and completed-workout submission.
   - [x] Verify repeatable set saves, atomic rollback on failed writes, preservation of completed performance during replacement, and rejection of SQL outside the permitted boundary, including function access and query/result limits.
   - [x] Run `bun run gate`; use `bun run gate:e2e` and Playwright MCP for changed browser workflows. Verified 313 unit tests, 7 PostgreSQL integration tests, and 264 browser tests (one skipped); Playwright MCP verified recording and finishing a workout. Review loop completed with no remaining blockers.
   - [ ] Complete actual ChatGPT and Claude linking over HTTPS as tracked in Auth above, then verify tool discovery and reads/writes from both clients.

#### Later

- Nutrition: log meals, retrieve nutritional information, and create missing food catalogue items.
- Habits and measurements: read individual records and histories, log habit completion, and record measurements such as body weight.
- Embedded frontend components in chat clients. First support workout operations through the API without requiring a switch to the web app.


# Chores
## Remove quick actions
