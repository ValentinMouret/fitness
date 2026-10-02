# Configure Fitness authentication

Fitness uses one owner login. Browser sessions use a signed, expiring HttpOnly cookie. Remote Model Context Protocol (MCP) clients use OAuth authorization code exchange with PKCE and one `fitness` scope for reads and writes. The MCP endpoint exposes workout tools and generic SQL reads over documented views. See [MCP tools and reader setup](mcp.md).

## Local magic-link foundation (ENSO-89)

The approved next authentication model is invitation-only email magic links with
Better Auth 1.7.7 and its native PostgreSQL adapter. Drizzle remains unchanged.
This first stage is a local development foundation: the existing owner login,
private app pages, OAuth and MCP authorization remain on their current boundary.
Native sessions do not authorize access to those surfaces. Production admission
stays closed until all enabled data, browser and agent paths have tested tenant
isolation and the owner's historical data migration has been reviewed.

Migration 0012 adds only auth users, sessions, accounts, verification records and
invitations. It does not assign ownership or change fitness records/catalogues.
The nullable account password field is part of Better Auth's core storage;
password authentication, password signup and SSO are disabled.

To exercise the foundation, create an explicitly named loopback test/dev database
and configure the existing test server credentials together with:

```sh
AUTH_FOUNDATION_ENABLED=true
AUTH_FOUNDATION_ORIGIN=http://127.0.0.1:5196
AUTH_FOUNDATION_OWNER_USER_ID=720cbf7c-67b5-4d6b-b026-c8e1099ff435
AUTH_LOCAL_DATABASE_URL=postgresql://localhost/fitness_magic_link_test
AUTH_LOCAL_INBOX=/tmp/fitness-auth-foundation/inbox.jsonl
```

Use the same database for `DATABASE_URL` and the test fixture connection. Run
`bun run auth:seed-local` to migrate and seed `owner@example.invalid`,
`first@example.invalid` and `second@example.invalid`. The command refuses
non-loopback databases and names without a `_test` or `_dev` suffix. It creates
no session cookies and does not mark email addresses verified. Request a link
through `/sign-in`, open the newest matching URL from the private local inbox,
then use **Manage invitations** as the owner. The inbox is outside public assets
and is written with mode 0600. Do not publish its contents.

`/sign-in`, `/account/invitations` and `/api/auth/*` return 404 by default.
Enabling this foundation in production is rejected by environment validation.
The owner bootstrap uses an explicit stable ID and rejects conflicting email/ID
assignments. Only that authenticated owner can list, create or revoke invitations.
If email delivery fails after creation, the invitation remains visible with an
inline error. **Resend email** retries delivery for an active, unaccepted
invitation. It does not renew expired invitations or reactivate revoked accounts.
Invitation expiry defaults to seven days (`AUTH_INVITATION_TTL_SECONDS`); accepted
accounts can request fresh sign-in links. Revocation removes existing sessions
and rejects outstanding links. Unknown addresses get the same response without
an email or an account. Magic links expire in five minutes, are stored as hashes,
and are single-use. Native session readers must use `getAdmittedSession`, which
rechecks admission; a raw library session is not sufficient authorization.

Better Auth's verification IDs use text because its concurrency reservations use
deterministic non-UUID primary keys. Ordinary user/session/account IDs remain
UUIDs. The adapter's custom UUID generator preserves supplied reservation IDs.
Origin and CSRF protection are explicitly enabled, including in test mode.

The standard server and Docker entry use a Morgan preload that logs request paths
without query strings. Better Auth's verbose library logger is disabled, so
rejected callback URLs cannot leak tokens into error logs. Status/path logging
remains available. The SMTP transport is exercised over real loopback SMTP;
production SMTP wiring is part of the later reviewed cutover, with TLS required.

Run `bun run test:auth:integration` with `AUTH_TEST_ADMIN_URL` pointing explicitly
to a disposable PostgreSQL admin connection. Its native-auth test creates and
drops its own uniquely named database. The SMTP test needs no database.
`tests/e2e/auth-foundation.spec.ts` verifies the built React Router flow against
the matching dedicated server and inbox. Set `E2E_SERVER_LOG` to that server's
log file to verify successful, rejected and replayed callbacks contain no tokens.
CI supplies these settings and exercises the owner invite flow, two independent
sessions, revocation, origin rejection, and denied private-app/OAuth/MCP access.

Before any production cutover: bind browser/OAuth/MCP execution to trusted user
identity; scope every enabled private read/write/aggregate and parent-child link;
rehearse and reconcile owner-history backfill; verify real reader-role two-user
negative tests; and configure production email delivery and recovery. Existing
public meal links remain an explicit read-only exception. Catalogue publication,
aliases and private fallback decisions are outside this foundation.

Session-protected pages and API routes inherit server authentication middleware from `ProtectedLayout`. See [ADR 0001](../adr/0001-server-auth-middleware.md) for route placement, client navigation, and the separate OAuth/MCP boundaries.

## Configure browser login

Set `AUTH_USERNAME`, `AUTH_PASSWORD`, and `AUTH_SESSION_SECRET` in the server environment or the ignored `.env`. Generate the session secret with `openssl rand -hex 32`. Keep it stable across restarts. Replacing it invalidates existing browser sessions. The default session lifetime is seven days; the server checks the signed expiry even if an expired cookie is sent manually.

The migration from unsigned cookies requires signing in again. Use HTTPS in production; production sessions always set Secure. The reverse proxy must preserve the public Host header. Production origin checks expect HTTPS for that host, even when TLS terminates at Caddy and the internal request uses HTTP. OAuth redirects use the configured public issuer.

The existing local server uses Vite's `PORT` setting (for example, `5175`). Do not start a second server in an agent session. Vite and the server launcher own `PORT`; Playwright owns `TEST_PORT`, validated in `tests/e2e/support/auth.ts`. Neither belongs to the application environment schema. Set test-only options on the test command. Restart the existing server after changing `.env`. Use `NODE_ENV=development` for local HTTP.

## Enable OAuth

1. Apply migrations with `bun run db:migrate` before enabling OAuth. Migration `0005_wise_bromley.sql` adds only the three OAuth tables. Drizzle applies migrations transactionally.
2. Set `OAUTH_ISSUER_URL` to the public HTTPS origin, with no path or trailing slash. Local development also accepts HTTP loopback origins, such as `http://localhost:5175`.
3. Set `OAUTH_CLIENTS` to a JSON array. Each entry has `name`, `id`, `secret`, and `redirectUri`. Create one entry for ChatGPT and one for Claude, using distinct IDs and randomly generated secrets. Copy each exact callback URL from that client's configuration. Callback comparison includes the scheme, host, port, path, and query.
4. Add the issuer's `/mcp` URL to each client. Choose a predefined OAuth client and enter its ID and secret. Both `client_secret_basic` and `client_secret_post` are accepted. Sign into Fitness and approve access.

Leave `OAUTH_ISSUER_URL` unset and `OAUTH_CLIENTS=[]` to disable MCP and its OAuth endpoints. No dynamic registration endpoint is provided.

The server publishes discovery at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`. It advertises issuer identification and includes `iss` in authorization responses. ChatGPT can therefore use its stable callback; use the exact callback shown by the client rather than guessing it. See the [OpenAI authentication guide](https://developers.openai.com/plugins/build/auth) and [Claude custom connector setup](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

## Revoke access

POST a token to `/oauth/revoke`, authenticating with the client ID and secret. Use form fields `token` and, optionally, `token_type_hint=refresh_token`. Revocation is idempotent and revokes the entire connection, including access tokens and previously rotated refresh tokens. Each MCP request checks connection status in PostgreSQL.

There is no Connected apps page. An operator can also revoke a connection by setting its `oauth_connections.revoked_at` to the current time. Removing a configured client disables its existing tokens. Reconnecting creates a new connection and cannot revive a revoked one.

Authorization codes and access/refresh tokens are random and persisted only as SHA-256 hashes. Rotation retains spent refresh-token hashes to detect replay and revoke the whole connection. Connection locking serializes code exchange, refresh, and revocation. A failed database write rolls back token consumption. Do not delete spent refresh-token records while their connection remains usable.

## Verify locally

Run the server against a local test database. The auth test commands never start another server. Set `E2E_BASE_URL=http://localhost:5175` if Vite listens on localhost rather than 127.0.0.1. Set `E2E_AUTH_USERNAME` and `E2E_AUTH_PASSWORD` to match the server.

Use the standard checks in the [project README](../../README.md), plus these
auth-specific suites against the configured test environment:

```sh
bun run test:auth:integration
bun run test:e2e:auth browser-session protected-routes mutation-boundary oauth.spec.ts
```

See [testing](../engineering/testing.md) for environment isolation and the
difference between local and CI server setup.

CI runs the ordinary auth contract and storage check alongside product E2E tests. HTTPS and short-lifetime browser profiles remain explicit.

The integration suite uses `DATABASE_URL` from `.env`, creates uniquely identified OAuth connections, and deletes only its own records. It checks persisted expiry and rollback after injected token-write failures.

OAuth browser tests use the two fixture clients documented in [the auth acceptance guide](../../tests/e2e/auth/README.md). Configure those fixtures only on the test server. The guide also describes storage inspection and short-lifetime expiry profiles. Do not run all expiry profiles together with ordinary lifetime settings.

Server lifetime controls, in seconds:

| Setting | Default |
| --- | ---: |
| `AUTH_SESSION_TTL_SECONDS` | 604800 |
| `OAUTH_CODE_TTL_SECONDS` | 300 |
| `OAUTH_ACCESS_TTL_SECONDS` | 900 |
| `OAUTH_REFRESH_TTL_SECONDS` | 2592000 |

Local fixtures verify the protocol, not actual ChatGPT/Claude connections. Complete linking from both real clients after configuring a publicly reachable HTTPS deployment. The browser suite's Secure-cookie test also requires HTTPS.
