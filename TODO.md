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

- [ ] Research how humans and agents would use Fitness through an MCP client, then determine the API surface.
- Cover habits, workouts, and measurements.
- Include reads and writes from the start.
- Key scenario: plan a workout in conversation, report performance progressively, and save the completed workout.
- Explore saving at the end versus saving progress along the way, including corrections and resuming a session.
- Tool names and granularity remain open; derive them from these workflows and reuse existing application logic.


# Chores
## Remove quick actions
