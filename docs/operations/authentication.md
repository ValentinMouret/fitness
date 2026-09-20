# Configure Fitness authentication

Fitness uses one owner login. Browser sessions use a signed, expiring HttpOnly cookie. Remote Model Context Protocol (MCP) clients use OAuth authorization code exchange with PKCE and one `fitness` scope for reads and writes. The MCP endpoint currently supports protocol initialization and an empty tool list; fitness tools are a separate task.

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
