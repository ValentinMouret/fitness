# Auth acceptance tests

These Playwright tests define the browser-login and OAuth acceptance contract in `TODO.md`. OAuth is implemented in `app/modules/auth`. Missing endpoints and insecure behavior fail assertions; the tests do not use `test.fail()` to turn those failures green.

## Run against an existing test server

The auth runner never starts a server, migrates a database, or seeds data. Its preflight fails once if `/login` is unavailable. Use a disposable Fitness test database: the mutation tests attempt to create an exercise and remove their uniquely named record if an insecure action accepts it. OAuth tests create grants and revoke issued tokens where available.

```sh
# Browser login, direct server access, and mutation boundaries
bun run test:e2e:auth browser-session protected-routes mutation-boundary

# Override the default port, 5175
TEST_PORT=5180 bun run test:e2e:auth browser-session

# OAuth protocol, rotation, and revocation acceptance contract
bun run test:e2e:auth oauth.spec.ts

# List the complete contract without connecting to a server
bun run test:e2e:auth --list
```

`TEST_PORT` accepts an integer from 1 through 65535 and defaults to 5175. Both Playwright configurations use it; the existing general runner also passes it as `PORT` to its test server. `E2E_BASE_URL` overrides the complete URL, including the port, for an existing HTTPS deployment. The Secure-cookie assertion is explicitly skipped on HTTP; run it over HTTPS before signing off.

The test login defaults to `testuser` / `testpassword`. Override it with `E2E_AUTH_USERNAME` and `E2E_AUTH_PASSWORD`, matching the server's `AUTH_USERNAME` and `AUTH_PASSWORD`. These are test-runner settings; they do not change the credentials of an already running server.

The auth contract has its own command and runs in a separate CI project alongside product E2E tests. The product setup signs in through the real login form before saving browser state. Expiry profiles remain explicit. Saved state is gitignored. Auth traces, screenshots, and video are disabled to avoid retaining issued credentials in artifacts.

## Configure the OAuth test clients

Preconfigure these two clients on the test server, or override the corresponding test-runner settings:

| Client | Client ID | Secret | Exact callback |
| --- | --- | --- | --- |
| ChatGPT | `fitness-e2e-chatgpt` | `fitness-e2e-chatgpt-secret` | `https://chatgpt.example.invalid/callback` |
| Claude | `fitness-e2e-claude` | `fitness-e2e-claude-secret` | `https://claude.example.invalid/callback` |

Overrides are `E2E_CHATGPT_CLIENT_ID`, `E2E_CHATGPT_CLIENT_SECRET`, `E2E_CHATGPT_CALLBACK`, and the corresponding `E2E_CLAUDE_*` variables. These credentials are test fixtures, not real ChatGPT or Claude registrations. Only the callback navigation is intercepted; Fitness login, consent, code exchange, token validation, and revocation use the real server.

`E2E_MCP_URL` defaults to `/mcp` on the test origin. The test discovers protected-resource metadata from its 401 challenge, then authorization-server metadata. No authorization or token endpoint path is hardcoded.

The proposed contract makes these implementation choices explicit:

- One `fitness` scope, authorization-code and refresh-token grants, and S256 PKCE.
- Authorization server and MCP resource share the Fitness origin.
- Metadata advertises `revocation_endpoint`. Revoking a refresh token revokes its whole connection, including rotated credentials. Repeating revocation succeeds.
- Refresh-token replay invalidates the refresh-token family. A refresh/revoke race cannot leave a usable credential after revocation completes.
- Consent identifies the app by name, states “read and update your fitness data”, and uses a form with Allow/Allow access and Deny/Cancel buttons.
- Invalid callbacks produce a local HTTP 400 without redirecting. Invalid authorization parameters are rejected before login/consent. Cross-site consent and mutations are rejected: React Router rejects document POSTs with HTTP 400 before route execution; application guards return HTTP 403.
- Token errors follow the assertions in `oauth.spec.ts`: invalid grants, unsupported grants, invalid scopes, and invalid resources have distinct errors.

These are acceptance decisions, not claims that OAuth mandates every UI or storage detail. Adapt the small helpers if the established OAuth library exposes an equivalent contract.

## Verify expiration with short server lifetimes

The expiration tests use real server time. Changing the browser clock cannot expire server credentials. `E2E_EXPIRY_SECONDS` defaults to 2 and accepts 1–10; it controls the bounded test wait, not the server's lifetime configuration.

Run each profile after configuring the existing test server with the corresponding short lifetime:

| Command suffix | Server requirement |
| --- | --- |
| `--grep @session-expiry` | Session lifetime at most `E2E_EXPIRY_SECONDS` |
| `--grep @code-expiry` | Code lifetime at most `E2E_EXPIRY_SECONDS`; normal session lifetime |
| `--grep @access-expiry` | Access lifetime at most `E2E_EXPIRY_SECONDS`; refresh lifetime remains long |
| `--grep @refresh-expiry` | Refresh lifetime at most `E2E_EXPIRY_SECONDS` |

Prefix each suffix with `bun run test:e2e:auth`. Run ordinary tests with normal lifetimes. A single unfiltered run cannot exercise both long-refresh and short-refresh profiles correctly. Server-side lifetime controls are documented in [auth setup](../../../docs/operations/authentication.md); these tests do not add production clock-control endpoints.

## Inspect PostgreSQL storage

Run `bun run test:e2e:auth --grep @storage` with these environment variables pointing to the same disposable database used by the server:

- `E2E_DATABASE_URL`
- `E2E_CONNECTIONS_TABLE`
- `E2E_AUTHORIZATION_CODES_TABLE`
- `E2E_TOKENS_TABLE`

Table names use `schema.table` syntax. The inspection uses read-only transactions. It checks persistence of an issued code, presence of access/refresh token SHA-256 hex digests, and absence of raw bearer tokens across the three tables. SHA-256 hex is a proposed test contract; adjust this assertion if the implementation chooses another secure representation. Codes may be stored directly or as SHA-256 hex digests.

## Interpret the results

The protected-route matrix derives routes from `app/routes.ts` and exercises document requests, individual loader data requests, and direct actions with both missing and forged authentication. Empty action input checks that authentication runs before parsing; the separate valid exercise submission checks persisted effects. It does not prove absence of every possible external side effect.

The OAuth suite verifies rejection of tampered consent tickets and shows an actionable error. Domain/integration tests cover exact expiration boundaries, database rollback under injected failure, and token scope/resource filtering. Cleanup retention, randomness, restart durability, log redaction, and actual ChatGPT/Claude interoperability still require additional verification. No Connected apps page is assumed.
